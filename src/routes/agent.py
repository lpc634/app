# --- IMPORTS (Added boto3) ---
import os
import smtplib
import boto3
from botocore.client import Config
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
from email.utils import formataddr
from flask import Blueprint, jsonify, request, current_app, redirect, send_file, url_for

from flask_jwt_extended import jwt_required, get_jwt_identity
from src.models.user import User, Job, JobAssignment, AgentAvailability, Notification, Invoice, InvoiceJob, SupplierProfile, InvoiceLine, db
from src.utils.serialize import as_float, as_iso
from sqlalchemy.orm import selectinload
from sqlalchemy import select, union_all
from src.services.invoicing import build_supplier_invoice
from src.utils.finance import update_job_hours
from src.services.telegram_notifications import _send_admin_group
from src.utils.s3_client import s3_client
from datetime import datetime, date, time, timedelta
from decimal import Decimal, InvalidOperation
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from werkzeug.utils import secure_filename
import json
import logging

agent_bp = Blueprint('agent', __name__)

def allowed_file(filename):
    """Check if the file extension is allowed."""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in {'pdf', 'jpg', 'jpeg', 'png'}


def _admin_location_from_job(job) -> str:
    """Return a concise location for admin messages, preferring full address."""
    for cand in [getattr(job, 'address', None), getattr(job, 'full_address', None)]:
        if cand:
            return str(cand)
    pc = getattr(job, 'postcode', None)
    if pc:
        return str(pc)
    for cand in [getattr(job, 'town', None), getattr(job, 'city', None), getattr(job, 'county', None), getattr(job, 'region', None)]:
        if cand:
            return str(cand)
    return "Unknown"


@agent_bp.route('/agent/assignments/<int:assignment_id>/dismiss', methods=['POST'])
@jwt_required()
def dismiss_upcoming_assignment(assignment_id: int):
    """Allow an agent to hide/dismiss an upcoming shift from their dashboard.

    This does NOT delete the job; it simply marks the assignment as declined for this agent.
    """
    try:
        current_user_id = int(get_jwt_identity())
        assign = JobAssignment.query.get(assignment_id)
        if not assign or assign.agent_id != current_user_id:
            return jsonify({'error': 'Assignment not found'}), 404

        # Only allow dismiss/hide when still accepted/upcoming
        assign.status = 'declined'
        assign.response_time = datetime.utcnow()
        db.session.commit()
        return jsonify({'message': 'Assignment dismissed'}), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Dismiss assignment failed: {str(e)}")
        return jsonify({'error': 'Failed to dismiss assignment'}), 500


@agent_bp.route('/agent/report-submitted', methods=['POST'])
@jwt_required()
def agent_report_submitted():
    """Notify admins when an agent submits a job report.

    Expected JSON body:
    - job_id: int (required)
    - report_type: str (optional, e.g., 'Eviction Report')
    - report_url: str (optional link to the report or confirmation page)
    """
    try:
        current_user_id = int(get_jwt_identity())
        agent = User.query.get(current_user_id)
        if not agent or agent.role != 'agent':
            return jsonify({'error': 'Access denied. Agent role required.'}), 403

        data = request.get_json() or {}
        job_id = data.get('job_id')
        report_type = (data.get('report_type') or '').strip()
        report_url = (data.get('report_url') or '').strip()

        if not job_id:
            return jsonify({'error': 'job_id is required'}), 400

        job = Job.query.get(int(job_id))
        if not job:
            return jsonify({'error': 'Job not found'}), 404

        # Ensure this agent was assigned and accepted
        assignment = JobAssignment.query.filter_by(job_id=job.id, agent_id=agent.id, status='accepted').first()
        if not assignment:
            return jsonify({'error': 'You are not assigned to this job or have not accepted it'}), 403

        # Build admin message
        agent_name = f"{agent.first_name} {agent.last_name}".strip()
        location_text = _admin_location_from_job(job)
        parts = [
            "📝 <b>Job Report Submitted</b>",
            "",
            f"<b>Job:</b> #{job.id} — {job.title or job.job_type}",
            f"<b>Location:</b> {location_text}",
            f"<b>Agent:</b> {agent_name}"
        ]
        if report_type:
            parts.append(f"<b>Report:</b> {report_type}")
        if report_url:
            parts.append(f"<b>Link:</b> {report_url}")

        try:
            _send_admin_group("\n".join(parts))
        except Exception as _e:
            current_app.logger.warning(f"Admin report notify failed: {_e}")

        return jsonify({'message': 'Admin notified of report submission'})
    except Exception as e:
        current_app.logger.error(f"Error in report submitted notify: {str(e)}")
        return jsonify({'error': 'Failed to notify admin'}), 500


# --- REPLACED FUNCTION: This now uploads to your computer ---
@agent_bp.route('/agent/upload-documents', methods=['POST'])
@jwt_required()
def upload_agent_documents():
    current_user_id = int(get_jwt_identity())
    user = User.query.get(current_user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    if 'id_document' not in request.files and 'sia_document' not in request.files:
        return jsonify({"error": "No file part in the request"}), 400

    import requests

    try:
        # Handle ID Document Upload
        if 'id_document' in request.files:
            id_file = request.files['id_document']
            if id_file and allowed_file(id_file.filename):
                # Send file to your computer
                agent_name = f"{user.first_name}_{user.last_name}" if user.first_name and user.last_name else f"user_{user.id}"
                files = {'file': (id_file.filename, id_file.stream, id_file.content_type)}
                data = {'user_id': user.id, 'file_type': 'id', 'agent_name': agent_name}
                
                response = requests.post('https://1b069dfae07e.ngrok-free.app/upload', 
                                       files=files, data=data)
                
                if response.status_code == 200:
                    user.id_document_url = f"user_{user.id}/id_{id_file.filename}"
                    user.verification_status = 'pending'

        # Handle SIA Document Upload
        if 'sia_document' in request.files:
            sia_file = request.files['sia_document']
            if sia_file and allowed_file(sia_file.filename):
                # Send file to your computer
                agent_name = f"{user.first_name}_{user.last_name}" if user.first_name and user.last_name else f"user_{user.id}"

                files = {'file': (sia_file.filename, sia_file.stream, sia_file.content_type)}

                data = {'user_id': user.id, 'file_type': 'sia', 'agent_name': agent_name}
                
                response = requests.post('https://1b069dfae07e.ngrok-free.app/upload', 
                                       files=files, data=data)
                
                if response.status_code == 200:
                    user.sia_document_url = f"user_{user.id}/sia_{sia_file.filename}"
                
        db.session.commit()
        return jsonify({"message": "Documents uploaded successfully"}), 200

    except Exception as e:
        current_app.logger.error(f"Upload Error: {e}")
        return jsonify({"error": "Failed to upload file."}), 500

# --- NEW S3-BASED FILE UPLOAD ENDPOINTS ---

@agent_bp.route('/agent/upload-document', methods=['POST'])
@jwt_required()
def upload_agent_document():
    """
    Upload agent identification documents to S3 (GDPR compliant)
    Supports PDF, JPG, PNG files for ID cards, passports, driver licenses, etc.
    """
    try:
        current_user_id = int(get_jwt_identity())
        user = User.query.get(current_user_id)
        
        if not user or user.role != 'agent':
            return jsonify({"error": "Access denied. Agent role required."}), 403

        # Check if S3 is properly configured
        if not s3_client.is_configured():
            return jsonify({
                "error": "File upload service not available", 
                "details": "S3 storage not configured properly"
            }), 503

        if 'file' not in request.files:
            return jsonify({"error": "No file provided"}), 400

        file = request.files['file']
        document_type = request.form.get('document_type', 'general')

        if file.filename == '':
            return jsonify({"error": "No file selected"}), 400

        if not allowed_file(file.filename):
            return jsonify({"error": "File type not allowed. Only PDF, JPG, JPEG, PNG files are accepted."}), 400

        # Validate document type
        valid_document_types = ['id_card', 'passport', 'driver_license', 'sia_license', 'other']
        if document_type not in valid_document_types:
            document_type = 'other'

        # Upload to S3
        upload_result = s3_client.upload_agent_document(
            agent_id=user.id,
            file=file,
            file_type=document_type
        )

        if not upload_result.get('success'):
            error_msg = upload_result.get('error', 'Upload failed')
            current_app.logger.error(f"S3 upload failed for user {user.id}: {error_msg}")
            return jsonify({"error": error_msg}), 500

        # S3 document storage temporarily disabled - field removed from database
        user.verification_status = 'pending'  # Reset verification status
        
        db.session.commit()

        # Extract document metadata from upload result
        document_metadata = {
            'filename': upload_result.get('filename'),
            'original_filename': upload_result.get('original_filename'),
            'document_type': document_type,
            'upload_date': upload_result.get('upload_date'),
            'file_size': upload_result.get('file_size')
        }

        return jsonify({
            "message": "Document uploaded successfully",
            "document": document_metadata
        }), 200

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error uploading agent document: {str(e)}")
        return jsonify({"error": "Failed to upload document"}), 500

@agent_bp.route('/agent/s3-status', methods=['GET'])
@jwt_required()
def check_s3_status():
    """
    Check S3 configuration status for debugging
    """
    try:
        current_user_id = int(get_jwt_identity())
        user = User.query.get(current_user_id)
        
        if not user or user.role != 'agent':
            return jsonify({"error": "Access denied. Agent role required."}), 403
        
        if s3_client.is_configured():
            connection_test = s3_client.test_connection()
            return jsonify({
                "configured": True,
                "connection_test": connection_test,
                "bucket": s3_client.bucket_name
            }), 200
        else:
            return jsonify({
                "configured": False,
                "error": s3_client.get_configuration_error()
            }), 200
            
    except Exception as e:
        current_app.logger.error(f"Error checking S3 status: {str(e)}")
        return jsonify({"error": "Failed to check S3 status"}), 500

@agent_bp.route('/agent/documents', methods=['GET'])
@jwt_required()
def get_agent_documents():
    """
    Get list of all documents uploaded by the current agent
    Returns secure temporary URLs for document access
    """
    try:
        current_user_id = int(get_jwt_identity())
        user = User.query.get(current_user_id)
        
        if not user or user.role != 'agent':
            return jsonify({"error": "Access denied. Agent role required."}), 403

        # Document files functionality is now available

        documents = []
        
        # S3 document storage temporarily disabled
        if False:  # user.document_files:
            document_files = user.document_files
            if isinstance(document_files, str):
                document_files = json.loads(document_files)
            
            for doc in document_files:
                # Generate temporary signed URL for secure access
                signed_url = s3_client.generate_presigned_url(
                    doc['file_key'], 
                    expiration=3600  # 1 hour expiration
                )
                
                if signed_url:
                    documents.append({
                        'filename': doc.get('filename'),
                        'original_filename': doc.get('original_filename'),
                        'document_type': doc.get('document_type'),
                        'upload_date': doc.get('upload_date'),
                        'file_size': doc.get('file_size'),
                        'download_url': signed_url  # Temporary signed URL
                    })

        return jsonify({
            "documents": documents,
            "total_count": len(documents)
        }), 200

    except Exception as e:
        current_app.logger.error(f"Error fetching agent documents: {str(e)}")
        return jsonify({"error": "Failed to fetch documents"}), 500

@agent_bp.route('/agent/documents/<document_type>', methods=['DELETE'])
@jwt_required()
def delete_agent_document(document_type):
    """
    Delete a specific document type (GDPR compliance)
    """
    try:
        current_user_id = int(get_jwt_identity())
        user = User.query.get(current_user_id)
        
        if not user or user.role != 'agent':
            return jsonify({"error": "Access denied. Agent role required."}), 403

        # Document files functionality is now available

        # S3 document storage temporarily disabled
        if True:  # not user.document_files:
            return jsonify({"error": "No documents found"}), 404

        document_files = user.document_files
        if isinstance(document_files, str):
            document_files = json.loads(document_files)

        # Find and remove the document
        document_to_delete = None
        updated_documents = []
        
        for doc in document_files:
            if doc.get('document_type') == document_type:
                document_to_delete = doc
            else:
                updated_documents.append(doc)

        if not document_to_delete:
            return jsonify({"error": "Document not found"}), 404

        # Delete from S3
        delete_success = s3_client.delete_file(document_to_delete['file_key'])
        
        if delete_success:
            # Update user's document list
            # user.document_files = updated_documents
            db.session.commit()
            
            return jsonify({
                "message": f"Document of type '{document_type}' deleted successfully"
            }), 200
        else:
            return jsonify({"error": "Failed to delete document from storage"}), 500

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error deleting agent document: {str(e)}")
        return jsonify({"error": "Failed to delete document"}), 500

# --- PDF AND EMAIL HELPER FUNCTIONS ---

def generate_invoice_pdf(agent,
                         jobs_data,
                         total_amount,
                         invoice_number,
                         upload_to_s3=True,
                         agent_invoice_number=None):
    """
    Generates a professional PDF invoice using Platypus layout and uploads to S3.

    Hardened to accept both shapes of jobs_data:
      1) [{'job': <Job>, 'hours': number, 'rate'?: number}, ...]
      2) [{'address': str,
           'arrival_time'|'date': date|str,
           'hours_worked'|'hours': number,
           'hourly_rate'|'rate': number,
           'amount'?: number}, ...]
    Falls back to invoice/job data if fields are missing, so the PDF
    always has a services row with a date and an address.
    """
    import traceback
    from datetime import date as date_cls
    from decimal import Decimal
    from sqlalchemy.orm import joinedload
    from src.pdf.invoice_builder import build_invoice_pdf

    try:
        current_app.logger.info(f"PDF GENERATION START: {invoice_number} jobs_count={len(jobs_data or [])}")

        # Resolve invoice from DB (for fallbacks) - handle cases where DB is not available
        invoice = None
        try:
            invoice = Invoice.query.options(joinedload(Invoice.jobs)).filter_by(invoice_number=invoice_number).first()
        except Exception as db_error:
            current_app.logger.warning(f"Could not query invoice from DB: {db_error}")
            # Use the provided invoice parameter instead if available
            pass
        
        # Use the provided invoice parameter as fallback (passed as function parameter)
        if not invoice and 'invoice' in locals() and locals()['invoice'] is not None:
            # The invoice parameter from function args is already in scope
            pass

        # Helper: safe float
        def _f(x, default=0.0):
            try:
                return float(x)
            except Exception:
                try:
                    return float(Decimal(str(x)))
                except Exception:
                    return default

        # Helper functions for reliable date and address handling
        def _first_non_empty(*vals):
            for v in vals:
                if v is not None and str(v).strip():
                    return str(v).strip()
            return ""

        def _one_line_address(job):
            # For Job objects, the address is in the 'address' field
            best = getattr(job, "address", None)
            if not best:
                # If no main address, try to construct from parts (for User objects)
                parts = [getattr(job, "address_line_1", ""), getattr(job, "city", ""), getattr(job, "postcode", "")]
                parts = [p for p in parts if p and str(p).strip()]
                best = ", ".join(parts)
            return best.strip() or "Address not provided"

        def _job_date(job):
            # For Job objects, the main date field is 'arrival_time'
            for field in ("arrival_time", "created_at", "updated_at"):
                if hasattr(job, field) and getattr(job, field):
                    try:
                        date_val = getattr(job, field)
                        if hasattr(date_val, 'strftime'):
                            return date_val.strftime("%d/%m/%Y")
                        else:
                            return str(date_val)[:10]
                    except Exception:
                        continue
            return "N/A"

        # Build a map of first linked job (for fallback address/date)
        first_invoice_job = None
        first_job = None
        try:
            if invoice:
                first_invoice_job = InvoiceJob.query.filter_by(invoice_id=invoice.id).first()
                if first_invoice_job:
                    first_job = first_invoice_job.job
        except Exception as db_error:
            current_app.logger.warning(f"Could not query invoice jobs from DB: {db_error}")
            first_job = None

        # Ensure PDF builder has a job type and address to show in header/section
        try:
            if invoice is not None:
                if not getattr(invoice, 'job_type', None) and first_job is not None:
                    invoice.job_type = getattr(first_job, 'job_type', None)
                if not getattr(invoice, 'address', None) and first_job is not None:
                    invoice.address = _one_line_address(first_job)
        except Exception:
            pass

        normalized_jobs = []
        for item in (jobs_data or []):
            if not isinstance(item, dict):
                continue

            job_obj = item.get('job')
            # numbers
            hours = _f(item.get('hours', item.get('hours_worked', 0)))
            rate = _f(item.get('rate', item.get('hourly_rate', getattr(job_obj, 'hourly_rate', 0) if job_obj else 0)))
            amount = _f(item.get('amount', hours * rate))

            # date + address - use helper functions for reliable extraction
            when = item.get('date', item.get('arrival_time'))
            addr = item.get('address')

            if job_obj is not None:
                when = when or _job_date(job_obj)
                addr = addr or _one_line_address(job_obj)

            # fallbacks from DB invoice/job if still missing
            if not addr and first_job is not None:
                addr = _one_line_address(first_job)
            if not when and invoice is not None:
                when = getattr(invoice, 'issue_date', None) or getattr(invoice, 'created_at', None)

            normalized_jobs.append({
                'job': job_obj,
                'date': when,
                'address': addr or '',
                'hours': hours,
                'rate': rate,
                'amount': amount,
                'service': getattr(job_obj, 'job_type', None) if job_obj is not None else None,
            })

        # If nothing made it through (e.g., update flows with odd payloads), synthesize one row
        if not normalized_jobs:
            current_app.logger.info("PDF: jobs_data empty after normalization, synthesizing from DB")
            hours = _f(getattr(first_invoice_job, 'hours_worked', getattr(invoice, 'hours_worked', 0)))
            rate = _f(getattr(first_invoice_job, 'hourly_rate_at_invoice',
                              getattr(first_job, 'hourly_rate', getattr(invoice, 'hourly_rate', 0))))
            amount = _f(hours * rate)
            when = getattr(invoice, 'issue_date', None) or getattr(invoice, 'created_at', None)
            addr = _one_line_address(first_job) if first_job else getattr(invoice, 'address', '')
            normalized_jobs = [{
                'date': when,
                'address': addr or '',
                'hours': hours,
                'rate': rate,
                'amount': amount,
            }]

        # Totals with VAT logic
        calc_total = sum(_f(r['amount']) for r in normalized_jobs) if total_amount is None else _f(total_amount)
        # Determine VAT rate
        vat_rate_val = 0.0
        try:
            # Prefer invoice.vat_rate when available
            if invoice and getattr(invoice, 'vat_rate', None) is not None:
                vat_rate_val = float(invoice.vat_rate)
            else:
                # Supplier invoice: if invoice has supplier_id, use default VAT if supplier is registered
                if invoice and getattr(invoice, 'supplier_id', None):
                    sup = SupplierProfile.query.get(invoice.supplier_id)
                    if sup and sup.vat_registered:
                        vat_rate_val = float(current_app.config.get('VAT_DEFAULT_RATE', 0.20))
                # Agent VAT
                elif getattr(agent, 'vat_number', None):
                    vat_rate_val = float(current_app.config.get('VAT_DEFAULT_RATE', 0.20))
        except Exception:
            vat_rate_val = 0.0

        vat_amount = round(calc_total * vat_rate_val, 2) if vat_rate_val and calc_total else 0.0
        totals = {
            'subtotal': calc_total,
            'vat': vat_amount,
            'total': round(calc_total + vat_amount, 2),
            'vat_rate': vat_rate_val,
        }

        # Invoice date
        invoice_date = getattr(invoice, 'issue_date', None) or date_cls.today()

        # Create invoice directory
        invoice_folder = os.path.join('/tmp', 'invoices')
        os.makedirs(invoice_folder, exist_ok=True)
        file_path = os.path.join(invoice_folder, f"{invoice_number}.pdf")

        current_app.logger.info(f"PDF GENERATION: Building to {file_path}")

        # If supplier invoice, override agent display name and VAT number from supplier profile
        pdf_agent = agent
        try:
            if invoice and getattr(invoice, 'supplier_id', None):
                sup = SupplierProfile.query.get(invoice.supplier_id)
                if sup:
                    class AgentView:
                        pass
                    av = AgentView()
                    # Name: use supplier display_name
                    setattr(av, 'first_name', getattr(sup, 'display_name', '') or getattr(agent, 'first_name', ''))
                    setattr(av, 'last_name', '')
                    # VAT number from supplier if present, else fall back to agent
                    setattr(av, 'vat_number', getattr(sup, 'vat_number', None) or getattr(agent, 'vat_number', None))
                    # Copy other fields from agent
                    for attr in ['address_line_1','address_line_2','city','postcode','email','phone','utr_number','bank_name','bank_account_number','bank_sort_code']:
                        setattr(av, attr, getattr(agent, attr, None))
                    pdf_agent = av
        except Exception:
            pdf_agent = agent

        # Build PDF (pass invoice for header/meta if builder uses it)
        build_invoice_pdf(
            file_path=file_path,
            agent=pdf_agent,
            jobs=normalized_jobs,
            totals=totals,
            invoice_number=invoice_number,
            invoice_date=invoice_date,
            agent_invoice_number=agent_invoice_number,
            invoice=invoice
        )

        current_app.logger.info(f"PDF GENERATION SUCCESS: {file_path}")

        # Upload to S3
        if upload_to_s3:
            try:
                upload_result = s3_client.upload_invoice_pdf(
                    agent_id=agent.id,
                    invoice_number=invoice_number,
                    pdf_data=file_path,
                    filename=f"{invoice_number}.pdf"
                )
                if upload_result.get('success'):
                    current_app.logger.info(f"PDF S3 upload OK: {upload_result.get('file_key')}")
                    try:
                        os.remove(file_path)
                        current_app.logger.info(f"PDF local cleanup OK: {file_path}")
                    except Exception as cleanup_error:
                        current_app.logger.warning(f"PDF cleanup failed: {cleanup_error}")
                    return file_path, upload_result.get('file_key')
                else:
                    current_app.logger.error(f"PDF S3 upload failed: {upload_result.get('error')}")
                    return file_path
            except Exception as s3_error:
                current_app.logger.error(f"PDF S3 exception: {s3_error}")
                current_app.logger.error(traceback.format_exc())
                return file_path

        return file_path

    except Exception as e:
        current_app.logger.error(f"PDF GENERATION ERROR: {e}")
        import traceback as _tb
        current_app.logger.error(_tb.format_exc())
        # Return None to indicate failure instead of Flask response
        return None


def send_invoice_email(recipient_email, agent_name, pdf_path, invoice_number, cc_email=None):
    """Sends the invoice PDF via email."""
    try:
        msg = MIMEMultipart()
        mail_sender = current_app.config['MAIL_DEFAULT_SENDER']
        msg['From'] = formataddr(mail_sender) if isinstance(mail_sender, tuple) else mail_sender
        msg['To'] = recipient_email
        if cc_email:
            msg['Cc'] = cc_email
        msg['Subject'] = f"New Invoice Submitted: {invoice_number} from {agent_name}"
        
        body = f"Hello,\n\nPlease find attached the invoice {invoice_number} from {agent_name}.\n\nThank you,\nV3 Services"
        msg.attach(MIMEText(body, 'plain'))
        
        with open(pdf_path, 'rb') as f:
            attach = MIMEApplication(f.read(), _subtype="pdf")
            attach.add_header('Content-Disposition', 'attachment', filename=os.path.basename(pdf_path))
            msg.attach(attach)
            
        server = smtplib.SMTP(current_app.config['MAIL_SERVER'], current_app.config['MAIL_PORT'])
        if current_app.config['MAIL_USE_TLS']:
            server.starttls()
        server.login(current_app.config['MAIL_USERNAME'], current_app.config['MAIL_PASSWORD'])
        server.send_message(msg)
        server.quit()
        return True
    except Exception as e:
        current_app.logger.error(f"Failed to send email: {e}")
        return False


# --- EXISTING AGENT ROUTES ---

@agent_bp.route('/agent/dashboard', methods=['GET'])
@jwt_required()
def get_agent_dashboard_data():
    """
    Get all necessary data for the agent dashboard in a single request.
    """
    try:
        current_user_id = int(get_jwt_identity())
        user = User.query.get(current_user_id)

        if not user or user.role not in ['agent', 'admin']:
            return jsonify({'error': 'Access denied.'}), 403

        now = datetime.utcnow()
        today = date.today()

        availability_today = AgentAvailability.query.filter_by(agent_id=user.id, date=today).first()
        today_status = 'unavailable'
        if availability_today and availability_today.is_available:
            today_status = 'available'

        # ================================
        # FIXED LOGIC: Show pending assigned jobs instead of unassigned jobs
        # ================================
        
        # Get pending job assignments for this agent
        pending_assignments = JobAssignment.query.filter_by(
            agent_id=user.id, 
            status='pending'
        ).all()

        available_jobs = []
        for assignment in pending_assignments:
            job = Job.query.get(assignment.job_id)
            if job and job.status == 'open':
                # Add assignment ID to job data so frontend can respond to it
                job_dict = job.to_dict_agent_safe()
                job_dict['assignment_id'] = assignment.id
                available_jobs.append(job_dict)

        # ================================
        # END OF FIXED LOGIC
        # ================================

        upcoming_assignments = db.session.query(JobAssignment).join(Job).filter(
            JobAssignment.agent_id == user.id,
            JobAssignment.status == 'accepted',
            Job.arrival_time > now
        ).order_by(Job.arrival_time.asc()).all()
        
        completed_assignments = db.session.query(JobAssignment).join(Job).filter(
            JobAssignment.agent_id == user.id,
            JobAssignment.status == 'accepted',
            Job.arrival_time <= now
        ).order_by(Job.arrival_time.desc()).limit(10).all()

        full_name = f"{user.first_name} {user.last_name}"
        reports_to_file = db.session.query(Job).filter(
            Job.lead_agent_name == full_name,
            Job.arrival_time <= now
        ).order_by(Job.arrival_time.desc()).all()

        dashboard_data = {
            'agent_name': full_name,
            'today_status': today_status,
            'available_jobs': available_jobs,
            'upcoming_shifts': [
                dict(assign.job.to_dict_agent_safe(), assignment_id=assign.id) for assign in upcoming_assignments if assign.job
            ],
            'completed_jobs': [assign.job.to_dict_agent_safe() for assign in completed_assignments if assign.job],
            'reports_to_file': [job.to_dict_agent_safe() for job in reports_to_file]
        }
        
        return jsonify(dashboard_data), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@agent_bp.route('/agent/availability/today', methods=['POST'])
@jwt_required()
def toggle_today_availability():
    """Toggle agent's availability for the current day."""
    try:
        current_user_id = int(get_jwt_identity())
        data = request.get_json()
        new_status = data.get('status') 

        if new_status not in ['available', 'unavailable']:
            return jsonify({'error': 'Invalid status provided.'}), 400

        today = date.today()
        is_available = new_status == 'available'
        
        availability = AgentAvailability.query.filter_by(agent_id=current_user_id, date=today).first()
        
        if availability:
            availability.is_available = is_available
            availability.is_away = not is_available
            availability.notes = f"Status set to {new_status} via dashboard toggle."
            availability.updated_at = datetime.utcnow()
        else:
            availability = AgentAvailability(
                agent_id=current_user_id,
                date=today,
                is_available=is_available,
                is_away=not is_available,
                notes=f"Status set to {new_status} via dashboard toggle."
            )
            db.session.add(availability)
        
        db.session.commit()

        return jsonify({'message': f'Availability for today set to {new_status}.', 'new_status': new_status}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# --- UPDATED AND NEW ROUTES ---

@agent_bp.route('/agent/profile', methods=['GET'])
@jwt_required()
def get_agent_profile():
    """Fetches the full profile for the currently logged-in agent."""
    current_user_id = int(get_jwt_identity())
    user = User.query.get(current_user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    
    return jsonify(user.to_dict()), 200

@agent_bp.route('/agent/profile', methods=['POST'])
@jwt_required()
def update_agent_profile():
    """Updates the profile for the currently logged-in agent."""
    current_user_id = int(get_jwt_identity())
    user = User.query.get(current_user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body must be JSON"}), 400

    new_email = data.get('email', user.email).lower().strip()
    if new_email != user.email:
        if User.query.filter_by(email=new_email).first():
            return jsonify({"error": "This email address is already in use."}), 409
        user.email = new_email

    user.first_name = data.get('first_name', user.first_name)
    user.last_name = data.get('last_name', user.last_name)
    user.phone = data.get('phone', user.phone)
    user.address_line_1 = data.get('address_line_1', user.address_line_1)
    user.address_line_2 = data.get('address_line_2', user.address_line_2)
    user.city = data.get('city', user.city)
    user.postcode = data.get('postcode', user.postcode)
    user.bank_name = data.get('bank_name', user.bank_name)
    user.bank_account_number = data.get('bank_account_number', user.bank_account_number)
    user.bank_sort_code = data.get('bank_sort_code', user.bank_sort_code)
    user.utr_number = data.get('utr_number', user.utr_number)

    db.session.commit()
    return jsonify({"message": "Profile updated successfully"}), 200


# --- The rest of your invoice routes ---


@agent_bp.route('/agent/invoiceable-jobs', methods=['GET'])
@jwt_required()
def get_invoiceable_jobs():
    """Fetches completed jobs for the current agent that have not yet been invoiced."""
    try:
        current_user_id = int(get_jwt_identity())
        
        invoiced_job_ids_query = db.session.query(InvoiceJob.job_id).join(Invoice).filter(Invoice.agent_id == current_user_id)
        invoiced_job_ids = [item[0] for item in invoiced_job_ids_query.all()]

        completed_jobs_query = db.session.query(Job).join(JobAssignment).filter(
            JobAssignment.agent_id == current_user_id,
            JobAssignment.status == 'accepted',
            Job.arrival_time < datetime.utcnow()
        )

        invoiceable_jobs = completed_jobs_query.filter(~Job.id.in_(invoiced_job_ids)).order_by(Job.arrival_time.desc()).all()
        
        return jsonify([job.to_dict_agent_safe() for job in invoiceable_jobs]), 200

    except Exception as e:
        return jsonify({"error": "An internal error occurred", "details": str(e)}), 500

@agent_bp.route('/me/supplier/pending-assignments', methods=['GET'])
@jwt_required()
def get_my_supplier_pending_assignments():
    current_user_id = int(get_jwt_identity())
    user = User.query.get(current_user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    # Find supplier profile by user email
    supplier = SupplierProfile.find_by_email(user.email)
    if not supplier:
        return jsonify({'error': 'Not a supplier account'}), 403
    # Uninvoiced = assignments with no invoice_line and supplied_by_email == supplier.email
    subq = db.session.query(InvoiceLine.job_assignment_id)
    assignments = (
        JobAssignment.query
        .join(Job)
        .filter(
            JobAssignment.supplied_by_email == supplier.email,
            ~JobAssignment.id.in_(subq)
        )
        .order_by(Job.arrival_time.desc())
        .all()
    )
    def row(a):
        return {
            'job_assignment_id': a.id,
            'job_id': a.job_id,
            'date': getattr(a.job, 'arrival_time', None).isoformat() if getattr(a.job, 'arrival_time', None) else None,
            'address': getattr(a.job, 'address', None),
            'headcount': getattr(a, 'supplier_headcount', None),
        }
    return jsonify({'assignments': [row(a) for a in assignments]}), 200


@agent_bp.route('/suppliers/<path:email>/pending-assignments', methods=['GET'])
@jwt_required()
def get_supplier_pending_assignments_admin(email):
    current_user_id = int(get_jwt_identity())
    actor = User.query.get(current_user_id)
    if not actor or actor.role != 'admin':
        return jsonify({'error': 'Admin only'}), 403
    supplier = SupplierProfile.find_by_email(email)
    if not supplier:
        return jsonify({'error': 'Supplier not found'}), 404
    subq = db.session.query(InvoiceLine.job_assignment_id)
    assignments = (
        JobAssignment.query
        .join(Job)
        .filter(
            JobAssignment.supplied_by_email == supplier.email,
            ~JobAssignment.id.in_(subq)
        )
        .order_by(Job.arrival_time.desc())
        .all()
    )
    def row(a):
        return {
            'job_assignment_id': a.id,
            'job_id': a.job_id,
            'date': getattr(a.job, 'arrival_time', None).isoformat() if getattr(a.job, 'arrival_time', None) else None,
            'address': getattr(a.job, 'address', None),
            'headcount': getattr(a, 'supplier_headcount', None),
        }
    return jsonify({'assignments': [row(a) for a in assignments]}), 200


@agent_bp.route('/supplier-profiles', methods=['GET'])
@jwt_required()
def list_supplier_profiles():
    current_user_id = int(get_jwt_identity())
    actor = User.query.get(current_user_id)
    if not actor or actor.role != 'admin':
        return jsonify({'error': 'Admin only'}), 403
    suppliers = SupplierProfile.query.order_by(SupplierProfile.email.asc()).all()
    return jsonify({'suppliers': [
        {
            'id': s.id,
            'email': s.email,
            'display_name': s.display_name,
            'vat_registered': bool(s.vat_registered),
        } for s in suppliers
    ]}), 200


@agent_bp.route('/me/supplier/invoices', methods=['POST'])
@jwt_required()
def create_my_supplier_invoice():
    current_user_id = int(get_jwt_identity())
    user = User.query.get(current_user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    supplier = SupplierProfile.find_by_email(user.email)
    if not supplier:
        return jsonify({'error': 'Not a supplier account'}), 403
    data = request.get_json() or {}
    items = data.get('items') or []
    try:
        inv, _conflicts_unused = build_supplier_invoice(supplier, items, current_user_id)
    except IntegrityError:
        # Determine conflicts
        ids = [int(it.get('job_assignment_id')) for it in (items or []) if it.get('job_assignment_id') is not None]
        existing = db.session.query(InvoiceLine.job_assignment_id).filter(InvoiceLine.job_assignment_id.in_(ids)).all()
        return jsonify({'error': 'duplicate_assignments', 'conflicts': [row[0] for row in existing]}), 409
    except PermissionError as pe:
        return jsonify({'error': str(pe)}), 403
    except ValueError as ve:
        return jsonify({'error': str(ve)}), 400
    except Exception as e:
        return jsonify({'error': 'Failed to create supplier invoice', 'details': str(e)}), 500
    return jsonify({'invoice_number': inv.invoice_number, 'invoice_id': inv.id}), 201


@agent_bp.route('/suppliers/<path:email>/invoices', methods=['POST'])
@jwt_required()
def create_supplier_invoice_admin(email):
    current_user_id = int(get_jwt_identity())
    actor = User.query.get(current_user_id)
    if not actor or actor.role != 'admin':
        return jsonify({'error': 'Admin only'}), 403
    supplier = SupplierProfile.find_by_email(email)
    if not supplier:
        return jsonify({'error': 'Supplier not found'}), 404
    data = request.get_json() or {}
    items = data.get('items') or []
    try:
        inv, _conflicts_unused = build_supplier_invoice(supplier, items, current_user_id)
    except IntegrityError:
        ids = [int(it.get('job_assignment_id')) for it in (items or []) if it.get('job_assignment_id') is not None]
        existing = db.session.query(InvoiceLine.job_assignment_id).filter(InvoiceLine.job_assignment_id.in_(ids)).all()
        return jsonify({'error': 'duplicate_assignments', 'conflicts': [row[0] for row in existing]}), 409
    except PermissionError as pe:
        return jsonify({'error': str(pe)}), 403
    except ValueError as ve:
        return jsonify({'error': str(ve)}), 400
    except Exception as e:
        return jsonify({'error': 'Failed to create supplier invoice', 'details': str(e)}), 500
    return jsonify({'invoice_number': inv.invoice_number, 'invoice_id': inv.id}), 201


@agent_bp.route('/agent/invoice', methods=['POST'])
@jwt_required()
def create_invoice():
    """
    Creates an invoice from selected jobs, saves it, generates a PDF, and emails it.
    """
    try:
        current_user_id = int(get_jwt_identity())
        agent = User.query.get(current_user_id)
        if not agent or agent.role != 'agent':
            return jsonify({'error': 'Access denied.'}), 403

        data = request.get_json()
        job_items = data.get('items')
        time_entries = data.get('time_entries')  # New multi-day structure
        # Accept agent_invoice_number from frontend (their personal invoice number)
        custom_invoice_number = data.get('agent_invoice_number') or data.get('invoice_number')
        # Optional supplier invoicing flow
        # Disallow client-provided supplier spoofing on this agent endpoint
        supplier_email = ''

        # Support both old (job_items) and new (time_entries) formats
        if not job_items and not time_entries:
            return jsonify({'error': 'No items or time entries provided for invoicing.'}), 400

        # --- Branch: Supplier invoice vs Agent invoice ---
        is_supplier_invoice = False
        supplier = None
        if supplier_email:
            supplier = SupplierProfile.find_by_email(supplier_email)
            if not supplier:
                return jsonify({'error': 'Supplier not found'}), 404
            # Security: only admins or that supplier account can generate supplier invoices
            is_admin = (agent.role == 'admin')
            is_supplier_user = (agent.email or '').lower() == supplier.email.lower()
            if not (is_admin or is_supplier_user):
                return jsonify({'error': 'Access denied for supplier invoicing'}), 403
            is_supplier_invoice = True

        # --- Data Validation and Calculation ---
        total_amount = Decimal('0')
        jobs_to_invoice = []
        time_entries_to_invoice = []
        supplier_assignment_lines = []

        if is_supplier_invoice:
            # items: { job_assignment_id, hours, rate_per_hour }
            from decimal import Decimal as D
            for item in job_items:
                ja_id = int(item.get('job_assignment_id'))
                hours = D(str(item.get('hours', '0')))
                rate = D(str(item.get('rate_per_hour', '0')))
                if hours <= 0 or rate <= 0:
                    return jsonify({'error': 'Hours and Rate/hour must be > 0 for each line'}), 400
                assignment = JobAssignment.query.get(ja_id)
                if not assignment:
                    return jsonify({'error': f'Assignment {ja_id} not found'}), 404
                if (assignment.supplied_by_email or '').lower() != supplier.email.lower():
                    return jsonify({'error': f'Assignment {ja_id} is not supplied by {supplier.email}'}), 400
                headcount = int(getattr(assignment, 'supplier_headcount', 0) or 0)
                if headcount < 1:
                    return jsonify({'error': f'Assignment {ja_id} missing supplier headcount'}), 400
                line_total = (hours * rate * D(str(headcount))).quantize(D('0.01'))
                supplier_assignment_lines.append({
                    'assignment': assignment,
                    'hours': hours,
                    'rate': rate,
                    'headcount': headcount,
                    'line_total': line_total,
                })
                total_amount += line_total
        elif time_entries:
            # New multi-day time entries format: { jobId, entries: [{ work_date, hours, rate_net, notes }] }
            from decimal import Decimal as D
            from datetime import datetime
            for job_entry in time_entries:
                job_id = job_entry.get('jobId')
                entries = job_entry.get('entries', [])
                if not job_id or not entries:
                    return jsonify({'error': 'Each time entry must have jobId and entries'}), 400

                job = Job.query.get(job_id)
                if not job:
                    return jsonify({'error': f"Job with ID {job_id} not found."}), 404

                for entry in entries:
                    work_date_str = entry.get('work_date')
                    hours = D(str(entry.get('hours', '0')))
                    rate_net = D(str(entry.get('rate_net', '0')))
                    notes = entry.get('notes', '')

                    if not work_date_str:
                        return jsonify({'error': 'Each time entry must have work_date'}), 400
                    if hours <= 0:
                        return jsonify({'error': 'Hours must be > 0 for each time entry'}), 400
                    if rate_net <= 0:
                        return jsonify({'error': 'Rate must be > 0 for each time entry'}), 400

                    try:
                        work_date = datetime.strptime(work_date_str, '%Y-%m-%d').date()
                    except ValueError:
                        return jsonify({'error': f'Invalid work_date format: {work_date_str}. Use YYYY-MM-DD'}), 400

                    line_net = (hours * rate_net).quantize(D('0.01'))
                    total_amount += line_net

                    time_entries_to_invoice.append({
                        'job': job,
                        'work_date': work_date,
                        'hours': hours,
                        'rate_net': rate_net,
                        'line_net': line_net,
                        'notes': notes
                    })
        else:
            # Legacy single-day job_items format
            for item in job_items:
                job = Job.query.get(item['jobId'])
                if not job:
                    return jsonify({'error': f"Job with ID {item['jobId']} not found."}), 404
                hours = Decimal(item.get('hours', 0))
                if hours <= 0:
                    return jsonify({'error': f"Invalid hours for job at {job.address}."}), 400
                rate = Decimal(job.hourly_rate)
                amount = hours * rate
                total_amount += amount
                jobs_to_invoice.append({'job': job, 'hours': hours, 'rate': rate, 'amount': amount})

        # --- Flexible Agent Invoice Number Handling ---
        final_agent_invoice_number = None
        
        if custom_invoice_number is not None:
            # Validate the provided custom invoice number
            try:
                custom_invoice_number = int(custom_invoice_number)
                if custom_invoice_number <= 0:
                    return jsonify({'error': 'Invoice number must be greater than 0'}), 400
                if custom_invoice_number > 999999999:  # Max 9 digits
                    return jsonify({'error': 'Invoice number cannot exceed 9 digits'}), 400
            except (ValueError, TypeError):
                return jsonify({'error': 'Invoice number must be a valid integer'}), 400
            
            # Check for uniqueness (per agent) - only if field exists
            existing = None
            if hasattr(Invoice, 'agent_invoice_number'):
                existing = Invoice.query.filter_by(agent_id=current_user_id, agent_invoice_number=custom_invoice_number).first()
            if existing:
                # Get current number for suggestion
                current_number = getattr(agent, 'current_invoice_number', 0) or 0
                suggested_next = current_number + 1
                return jsonify({
                    'message': 'Invoice number already used',
                    'error': f'Invoice number {custom_invoice_number} has already been used',
                    'suggested': suggested_next,
                    'current': current_number
                }), 409
            
            final_agent_invoice_number = custom_invoice_number
        else:
            # Auto-generate next number based on current sequence
            current_number = getattr(agent, 'current_invoice_number', 0) or 0
            final_agent_invoice_number = current_number + 1

        # --- Database Transaction ---
        
        # 1. Create the new invoice record
        issue_date = date.today()
        last_invoice = Invoice.query.order_by(Invoice.id.desc()).first()
        new_invoice_id = (last_invoice.id + 1) if last_invoice else 1
        if is_supplier_invoice and supplier is not None:
            invoice_number = f"{supplier.invoice_prefix}{issue_date.year}-{new_invoice_id:04d}"
        else:
            invoice_number = f"V3-{issue_date.year}-{new_invoice_id:04d}"

        # Snapshot job details from the first job for PDF generation
        first_job = jobs_to_invoice[0]['job'] if jobs_to_invoice else None
        job_type_snapshot = getattr(first_job, 'job_type', None) if first_job else None
        address_snapshot = getattr(first_job, 'address', None) if first_job else None
        
        # Create invoice - only set agent_invoice_number if field exists
        invoice_kwargs = {
            'agent_id': current_user_id,
            'invoice_number': invoice_number,
            'issue_date': issue_date,
            'due_date': issue_date + timedelta(days=30),
            'total_amount': total_amount,
            'status': 'submitted',
            'job_type': job_type_snapshot,
            'address': address_snapshot
        }
        # VAT rate decision
        from decimal import Decimal as D
        vat_rate = D('0')
        if is_supplier_invoice and supplier and supplier.vat_registered:
            vat_rate = D(str(current_app.config.get('VAT_DEFAULT_RATE', 0.20)))
        elif (getattr(agent, 'vat_number', None) or '').strip():
            vat_rate = D(str(current_app.config.get('VAT_DEFAULT_RATE', 0.20)))
        if hasattr(Invoice, 'vat_rate'):
            invoice_kwargs['vat_rate'] = vat_rate
        if is_supplier_invoice and hasattr(Invoice, 'supplier_id'):
            invoice_kwargs['supplier_id'] = supplier.id
        
        # Only add agent_invoice_number if the field exists in the model
        if hasattr(Invoice, 'agent_invoice_number'):
            invoice_kwargs['agent_invoice_number'] = final_agent_invoice_number
        
        new_invoice = Invoice(**invoice_kwargs)
        db.session.add(new_invoice)
        db.session.flush()

        # Update agent's invoice numbering system
        # Update the new flexible system
        if hasattr(agent, 'current_invoice_number'):
            agent.current_invoice_number = final_agent_invoice_number
            
        # Also update the legacy system for backward compatibility
        current_next = getattr(agent, 'agent_invoice_next', None) or 1
        if hasattr(agent, 'agent_invoice_next'):
            agent.agent_invoice_next = max(current_next, final_agent_invoice_number + 1)

        # 2. Link items to invoice
        if is_supplier_invoice:
            for ln in supplier_assignment_lines:
                db.session.add(InvoiceLine(
                    invoice_id=new_invoice.id,
                    job_assignment_id=ln['assignment'].id,
                    work_date=datetime.utcnow().date(),  # Default work date for supplier invoices
                    hours=ln['hours'],
                    rate_net=ln['rate'],
                    line_net=ln['line_total'],
                    headcount=ln['headcount']
                ))
        elif time_entries_to_invoice:
            # New multi-day time entries - create InvoiceLine entries
            for entry in time_entries_to_invoice:
                db.session.add(InvoiceLine(
                    invoice_id=new_invoice.id,
                    work_date=entry['work_date'],
                    hours=entry['hours'],
                    rate_net=entry['rate_net'],
                    line_net=entry['line_net'],
                    notes=entry['notes']
                ))
        else:
            # Legacy job_items format - keep InvoiceJob for backward compatibility
            for item in jobs_to_invoice:
                job = item['job']
                hours = item['hours']
                rate = job.hourly_rate
                db.session.add(InvoiceJob(
                    invoice_id=new_invoice.id,
                    job_id=job.id,
                    hours_worked=hours,
                    hourly_rate_at_invoice=rate
                ))
            
        # --- PDF and Emailing ---
        # Prepare jobs data for PDF and totals with VAT
        if is_supplier_invoice:
            jobs_pdf = []
            for ln in supplier_assignment_lines:
                job = ln['assignment'].job
                jobs_pdf.append({
                    'job': job,
                    'date': getattr(job, 'arrival_time', None),
                    'hours': float(ln['hours']),
                    'rate': float(ln['rate']),
                    'amount': float(ln['line_total']),
                    'job_type': getattr(job, 'job_type', None),
                })
            from decimal import Decimal as D
            subtotal = sum((D(str(x['amount'])) for x in jobs_pdf), D('0'))
            vat_amount = (subtotal * vat_rate).quantize(D('0.01')) if vat_rate and vat_rate > 0 else D('0')
            grand_total = (subtotal + vat_amount).quantize(D('0.01'))
            totals_override = {
                'subtotal': float(subtotal),
                'vat': float(vat_amount),
                'total': float(grand_total),
            }
            # Temporarily pass grand_total to original function; it recomputes totals but we give exact lines
            pdf_result = generate_invoice_pdf(agent, jobs_pdf, float(grand_total), invoice_number, upload_to_s3=True, agent_invoice_number=final_agent_invoice_number)
        elif time_entries_to_invoice:
            # Format time entries for PDF generation
            entries_pdf = []
            for entry in time_entries_to_invoice:
                # Build description: job_type + notes (if any)
                job_type = getattr(entry['job'], 'job_type', None)
                notes = entry.get('notes', '').strip()
                description = job_type or 'Service'
                if notes:
                    description += f" - {notes}"

                entries_pdf.append({
                    'job': entry['job'],
                    'date': entry['work_date'],  # PDF builder expects 'date'
                    'work_date': entry['work_date'],  # Keep both for compatibility
                    'hours': float(entry['hours']),
                    'rate': float(entry['rate_net']),
                    'amount': float(entry['line_net']),
                    'job_type': getattr(entry['job'], 'job_type', None),
                    'description': description,  # Combined job type and notes
                    'notes': entry['notes']
                })
            pdf_result = generate_invoice_pdf(agent, entries_pdf, total_amount, invoice_number, upload_to_s3=True, agent_invoice_number=final_agent_invoice_number)
        else:
            pdf_result = generate_invoice_pdf(agent, jobs_to_invoice, total_amount, invoice_number, upload_to_s3=True, agent_invoice_number=final_agent_invoice_number)
        
        # Handle different return formats (with or without S3 upload)
        if isinstance(pdf_result, tuple):
            pdf_path, s3_file_key = pdf_result
            # Store S3 file key in database
            # Temporarily disabled - pdf_file_url field doesn't exist in database yet
            # new_invoice.pdf_file_url = s3_file_key
        else:
            pdf_path = pdf_result

        # Send in-app notification to agent
        notification = Notification(
            user_id=agent.id,
            title=f"Invoice {invoice_number} Generated",
            message=f"Your invoice {invoice_number} for £{total_amount:.2f} has been generated and is ready for download.",
            type="invoice_generated"
        )
        db.session.add(notification)
        # Skip Telegram notification (agent already knows they created it)
        
        current_app.logger.info(f"Invoice {invoice_number} created for agent {agent.email} - stored in S3")

        # --- Admin Telegram: notify invoice submission (agent name + invoice number) ---
        try:
            agent_name = f"{agent.first_name} {agent.last_name}".strip()
            _send_admin_group(
                (
                    "📄 <b>Invoice Submitted</b>\n\n"
                    f"<b>Agent:</b> {agent_name}\n"
                    f"<b>Invoice #:</b> {getattr(new_invoice, 'agent_invoice_number', None) or new_invoice.invoice_number}"
                )
            )
        except Exception as _e:
            current_app.logger.warning(f"Admin invoice notify failed: {_e}")

        # --- Commit Transaction ---
        db.session.commit()
        
        # Trigger hours aggregation for all linked jobs
        for item in jobs_to_invoice:
            try:
                update_job_hours(item['job'].id)
            except Exception as e:
                current_app.logger.warning(f"Failed to update hours for job {item['job'].id}: {e}")

        # --- Admin Telegram: if all agents linked to each job have invoiced, remind admin to complete job ---
        try:
            for item in jobs_to_invoice:
                job = item['job']
                # agents required for job
                required = int(getattr(job, 'agents_required', 1) or 1)
                # agent_ids who accepted the job
                accepted_assignments = JobAssignment.query.filter_by(job_id=job.id, status='accepted').all()
                accepted_agent_ids = [a.agent_id for a in accepted_assignments]
                # invoices for this job
                invoice_jobs = InvoiceJob.query.filter_by(job_id=job.id).all()
                invoiced_agent_ids = []
                for ij in invoice_jobs:
                    try:
                        inv = Invoice.query.get(ij.invoice_id)
                        if inv and inv.agent_id not in invoiced_agent_ids:
                            invoiced_agent_ids.append(inv.agent_id)
                    except Exception:
                        continue
                # Check if all accepted up to required count have invoiced
                accepted_unique = list(dict.fromkeys(accepted_agent_ids))
                if len(invoiced_agent_ids) >= min(required, len(accepted_unique)) and len(invoiced_agent_ids) > 0:
                    # Compose agent name list
                    names = []
                    for uid in invoiced_agent_ids:
                        u = User.query.get(uid)
                        if u:
                            names.append(f"{u.first_name} {u.last_name}".strip())
                    agents_list = "\n".join([f"• {n}" for n in names]) if names else "(names unavailable)"
                    _send_admin_group(
                        (
                            "🧾 <b>All Invoices Submitted</b>\n\n"
                            f"<b>Job:</b> #{job.id} — {job.title or job.job_type}\n"
                            f"<b>Location:</b> {_admin_location_from_job(job)}\n"
                            f"<b>Agents ({len(names)}):</b>\n{agents_list}\n\n"
                            "Please review and mark the job as complete."
                        )
                    )
        except Exception as _e:
            current_app.logger.warning(f"Admin all-invoiced notify failed: {_e}")
        
        return jsonify({
            'message': 'Invoice created and sent successfully!',
            'invoice_number': invoice_number
        }), 201

    except Exception as e:
        db.session.rollback()
        if 'pdf_path' in locals() and os.path.exists(pdf_path):
            os.remove(pdf_path)
        import traceback
        return jsonify({"error": "An internal server error occurred.", "details": traceback.format_exc()}), 500

@agent_bp.route('/agent/invoices/<int:invoice_id>', methods=['PUT'])
@jwt_required()
def update_invoice(invoice_id):
    """Update a draft invoice with hours and rate, then finalize and send it."""
    try:
        current_user_id = int(get_jwt_identity())
        user = User.query.get(current_user_id)
        if not user or user.role != 'agent':
            return jsonify({'error': 'Access denied. Agent role required.'}), 403
        
        data = request.get_json()
        hours_worked = data.get('hours_worked')
        hourly_rate = data.get('hourly_rate')
        first_hour_rate = data.get('first_hour_rate')
        agent_invoice_number_payload = data.get('agent_invoice_number') or data.get('invoice_number')
        
        if not hours_worked or not hourly_rate:
            return jsonify({'error': 'Hours worked and hourly rate are required'}), 400
        
        # Find the invoice
        invoice = Invoice.query.get(invoice_id)
        if not invoice:
            return jsonify({'error': 'Invoice not found'}), 404
        
        # Security check: agents can only update their own invoices
        if invoice.agent_id != current_user_id:
            return jsonify({'error': 'Access denied. You can only update your own invoices.'}), 403
        
        # Check if invoice is in draft status
        if invoice.status != 'draft':
            return jsonify({'error': 'Only draft invoices can be updated'}), 400
        
        # Update the invoice job with hours and rate
        invoice_job = InvoiceJob.query.filter_by(invoice_id=invoice.id).first()
        if not invoice_job:
            return jsonify({'error': 'Invoice job not found'}), 404
        
        invoice_job.hours_worked = Decimal(str(hours_worked))
        invoice_job.hourly_rate_at_invoice = Decimal(str(hourly_rate))
        
        # Calculate total amount (special first-hour logic only for Lpc634@gmail.com)
        total_amount = Decimal(str(hours_worked)) * Decimal(str(hourly_rate))
        try:
            if (user.email or '').lower() == 'lpc634@gmail.com' and first_hour_rate is not None and Decimal(str(hours_worked)) > 0:
                fh = Decimal(str(first_hour_rate))
                remaining = max(Decimal('0'), Decimal(str(hours_worked)) - Decimal('1'))
                total_amount = fh + remaining * Decimal(str(hourly_rate))
        except InvalidOperation:
            pass
        
        # Persist agent's own invoice number if provided and valid
        try:
            if agent_invoice_number_payload is not None and hasattr(invoice, 'agent_invoice_number'):
                ain = int(agent_invoice_number_payload)
                if ain > 0:
                    invoice.agent_invoice_number = ain
        except (ValueError, TypeError):
            current_app.logger.warning('Invalid agent invoice number provided; skipping update')

        invoice.total_amount = total_amount
        invoice.status = 'sent'
        invoice.issue_date = date.today()
        
        # Update snapshot data for PDF generation if not already set
        if not invoice.job_type and invoice_job.job:
            invoice.job_type = invoice_job.job.job_type
        if not invoice.address and invoice_job.job:
            invoice.address = invoice_job.job.address
        
        db.session.commit()
        
        # Generate PDF with proper job data structure
        try:
            job = invoice_job.job
            # If special agent used first-hour rate, include two line items for PDF clarity
            jobs_data = []
            try:
                is_special = (user.email or '').lower() == 'lpc634@gmail.com'
                fh = data.get('first_hour_rate')
                if is_special and fh is not None and float(hours_worked) > 0:
                    first_amount = float(fh)
                    remaining_hours = max(0.0, float(hours_worked) - 1.0)
                    remaining_amount = remaining_hours * float(hourly_rate)
                    jobs_data.append({'job': job, 'hours': 1.0, 'rate': float(fh), 'amount': first_amount})
                    if remaining_hours > 0:
                        jobs_data.append({'job': job, 'hours': remaining_hours, 'rate': float(hourly_rate), 'amount': remaining_amount})
                else:
                    jobs_data.append({'job': job, 'hours': float(hours_worked), 'rate': float(hourly_rate), 'amount': float(total_amount)})
            except Exception:
                jobs_data = [{
                    'job': job,
                    'hours': float(hours_worked),
                    'rate': float(hourly_rate),
                    'amount': float(total_amount)
                }]
            
            # Get agent invoice number safely
            agent_inv_number = getattr(invoice, 'agent_invoice_number', None) if hasattr(invoice, 'agent_invoice_number') else None
            
            pdf_result = generate_invoice_pdf(
                user,
                jobs_data,
                float(total_amount),
                invoice.invoice_number,
                upload_to_s3=True,
                agent_invoice_number=agent_inv_number
            )
            
            if isinstance(pdf_result, tuple):
                pdf_path, s3_file_key = pdf_result
                # Optional: persist file key if schema supports it
                # invoice.pdf_file_url = s3_file_key
                db.session.commit()
            else:
                pdf_path = pdf_result
            
            notification = Notification(
                user_id=user.id,
                title=f"Invoice {invoice.invoice_number} Updated",
                message=f"Your invoice {invoice.invoice_number} has been updated and is ready for download.",
                type="invoice_updated"
            )
            db.session.add(notification)
            
            # Send Telegram notification if enabled
            try:
                from src.services.notifications import notify_job_update
                notify_job_update(
                    user.id,
                    f"Invoice {invoice.invoice_number}",
                    f"✅ Your invoice {invoice.invoice_number} has been updated and is ready for download."
                )
            except Exception as e:
                current_app.logger.warning(f"Failed to send Telegram invoice update notification: {str(e)}")
            
            try:
                os.remove(pdf_path)
            except Exception:
                pass
                
        except Exception as e:
            current_app.logger.error(f"Failed to generate PDF or notify for invoice {invoice.invoice_number}: {str(e)}")
            pass
        
        # Trigger hours aggregation for the linked job
        try:
            update_job_hours(invoice_job.job_id)
        except Exception as e:
            current_app.logger.warning(f"Failed to update hours for job {invoice_job.job_id}: {e}")
        
        return jsonify({
            'message': 'Invoice updated and sent successfully',
            'invoice': invoice.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error updating invoice: {str(e)}")
        return jsonify({'error': 'Failed to update invoice'}), 500

@agent_bp.route('/agent/invoices/<int:invoice_id>', methods=['GET'])
@jwt_required()
def get_invoice_details(invoice_id):
    """Get specific invoice details for updating."""
    try:
        current_user_id = int(get_jwt_identity())
        user = User.query.get(current_user_id)
        if not user or user.role != 'agent':
            return jsonify({'error': 'Access denied. Agent role required.'}), 403
        
        # Find the invoice
        invoice = Invoice.query.get(invoice_id)
        if not invoice:
            return jsonify({'error': 'Invoice not found'}), 404
        
        # Security check: agents can only view their own invoices
        if invoice.agent_id != current_user_id:
            return jsonify({'error': 'Access denied. You can only view your own invoices.'}), 403
        
        # Get the invoice job details
        invoice_job = InvoiceJob.query.filter_by(invoice_id=invoice.id).first()
        if not invoice_job:
            return jsonify({'error': 'Invoice job not found'}), 404
        
        # Get job details
        job = invoice_job.job
        
        return jsonify({
            'invoice': invoice.to_dict(),
            'job': job.to_dict_agent_safe() if job else None,
            'invoice_job': invoice_job.to_dict()
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Error fetching invoice details: {str(e)}")
        return jsonify({'error': 'Failed to fetch invoice details'}), 500

# --- AGENT INVOICE MANAGEMENT ENDPOINTS ---

def _serialize_line(ln: InvoiceLine):
    """Safely serialize an invoice line to JSON-compatible dict."""
    # Handle both old and new column names for backward compatibility
    rate_value = None
    if hasattr(ln, 'rate_net') and ln.rate_net is not None:
        rate_value = ln.rate_net
    elif hasattr(ln, 'rate_per_hour') and ln.rate_per_hour is not None:
        rate_value = ln.rate_per_hour

    line_total_value = None
    if hasattr(ln, 'line_net') and ln.line_net is not None:
        line_total_value = ln.line_net
    elif hasattr(ln, 'line_total') and ln.line_total is not None:
        line_total_value = ln.line_total

    return {
        "id": ln.id,
        "work_date": as_iso(ln.work_date),
        "hours": as_float(ln.hours),
        "rate_net": as_float(rate_value),
        "line_net": as_float(line_total_value),
        "notes": getattr(ln, 'notes', None) or ""
    }

def _serialize_invoice(inv: Invoice):
    """Safely serialize an invoice to JSON-compatible dict with eager-loaded relationships."""
    # Ensure relationships are loaded and handle legacy invoices without lines
    lines = list(inv.lines or [])
    if not lines:
        # Synthesize a single line for legacy invoices if they have old fields
        if hasattr(inv, 'total_amount') and inv.total_amount:
            # Create a fake line for compatibility
            fake_line = type('FakeLine', (), {
                'id': None,
                'work_date': getattr(inv, 'issue_date', None),
                'hours': Decimal('8.0'),  # Default 8 hours
                'rate_net': inv.total_amount / Decimal('8.0') if inv.total_amount else Decimal('0'),
                'line_net': inv.total_amount,
                'notes': "Legacy invoice entry"
            })()
            lines = [fake_line]

    # Get job information safely
    job_info = None
    try:
        # First try to get job from invoice_jobs relationship
        if hasattr(inv, 'jobs') and inv.jobs:
            invoice_job = inv.jobs[0]  # Get first job
            if hasattr(invoice_job, 'job') and invoice_job.job:
                job = invoice_job.job
                job_info = {
                    "id": job.id,
                    "title": getattr(job, "title", None),
                    "address": getattr(job, "address", None),
                }

        # Fallback to snapshotted data in invoice
        if not job_info:
            job_info = {
                "id": None,
                "title": getattr(inv, "job_type", None),
                "address": getattr(inv, "address", None),
            }
    except Exception:
        job_info = {"id": None, "title": None, "address": None}

    return {
        "id": inv.id,
        "number": getattr(inv, 'invoice_number', None),
        "status": getattr(inv, 'status', 'draft'),
        "issue_date": as_iso(getattr(inv, "issue_date", None)),
        "due_date": as_iso(getattr(inv, "due_date", None)),
        "total_hours": as_float(sum(as_float(ln.hours) or 0 for ln in lines)),
        "subtotal_net": as_float(sum(as_float(ln.line_net) or 0 for ln in lines)),
        "vat_rate": as_float(getattr(inv, "vat_rate", None)),
        "vat_amount": as_float((sum(as_float(ln.line_net) or 0 for ln in lines)) * (as_float(getattr(inv, "vat_rate", None)) or 0)),
        "total_gross": as_float(getattr(inv, "total_amount", None)),
        "job": job_info,
        "lines": [_serialize_line(ln) for ln in lines]
    }

def _current_agent_id():
    """Helper function to resolve the current agent's User.id from JWT."""
    user_id = int(get_jwt_identity())
    if not user_id:
        current_app.logger.warning("No user ID in JWT token")
        return None

    agent = User.query.filter(User.id == user_id, User.role == 'agent').first()
    if not agent:
        current_app.logger.warning(f"No Agent found for user_id={user_id}")
        return None

    return agent.id

@agent_bp.route('/agent/invoices', methods=['GET'])
@jwt_required()
def get_agent_invoices():
    """Get all invoices for the current agent with safe serialization and no 500 errors."""
    try:
        agent_id = _current_agent_id()
        if not agent_id:
            return jsonify([])

        # Path A: invoices.agent_id == agent_id
        sub_a = select(Invoice.id).where(Invoice.agent_id == agent_id)

        # Path B (legacy): invoice_lines → job_assignments.agent_id == agent_id
        sub_b = (
            select(InvoiceLine.invoice_id)
            .select_from(InvoiceLine)
            .join(JobAssignment, JobAssignment.id == InvoiceLine.job_assignment_id)
            .where(JobAssignment.agent_id == agent_id)
        )

        # Union and dedupe ids
        inv_ids_union = union_all(sub_a, sub_b).subquery()
        inv_ids = select(db.func.distinct(inv_ids_union.c[0])).subquery()

        # Get limit
        limit = min(int(request.args.get("limit", 100)), 500)

        # Fetch invoices by the calculated IDs with eager loading
        q = (
            db.session.query(Invoice)
            .filter(Invoice.id.in_(select(inv_ids)))
            .options(
                selectinload(Invoice.lines),
                selectinload(Invoice.jobs)
            )
            .order_by(Invoice.issue_date.desc())
            .limit(limit)
        )
        invoices = q.all()

        # DEBUG (remove after verifying once)
        current_app.logger.info(
            "Agent invoices resolved: user_id=%s agent_id=%s count=%s",
            get_jwt_identity(), agent_id, len(invoices)
        )

        # Safely serialize each invoice
        serialized_invoices = []
        for inv in invoices:
            try:
                serialized_invoices.append(_serialize_invoice(inv))
            except Exception as e:
                current_app.logger.error(f"Error serializing invoice {inv.id}: {e}")
                # Continue with other invoices instead of failing entirely
                continue

        return jsonify(serialized_invoices), 200

    except Exception as e:
        current_app.logger.exception(f"Error fetching agent invoices: {e}")
        # NEVER return 500 - always return empty array on error
        return jsonify([]), 200

@agent_bp.route('/agent/invoices/summary', methods=['GET'])
@jwt_required()
def invoices_summary():
    """Get invoice summary statistics for the current agent."""
    try:
        agent_id = _current_agent_id()
        if not agent_id:
            return jsonify({"total_invoiced":0,"total_paid":0,"amount_owed":0,"earned_since_first_invoice":0})

        # Use same union logic as the list endpoint
        sub_a = select(Invoice.id).where(Invoice.agent_id == agent_id)
        sub_b = (
            select(InvoiceLine.invoice_id)
            .select_from(InvoiceLine)
            .join(JobAssignment, JobAssignment.id == InvoiceLine.job_assignment_id)
            .where(JobAssignment.agent_id == agent_id)
        )
        inv_ids_union = union_all(sub_a, sub_b).subquery()
        inv_ids = select(db.func.distinct(inv_ids_union.c[0])).subquery()

        base = db.session.query(Invoice).filter(Invoice.id.in_(select(inv_ids)))

        total_invoiced = base.filter(Invoice.status.in_(["sent","paid"])) \
                             .with_entities(db.func.coalesce(db.func.sum(Invoice.total_amount), 0)).scalar() or 0
        total_paid     = base.filter(Invoice.status == "paid") \
                             .with_entities(db.func.coalesce(db.func.sum(Invoice.total_amount), 0)).scalar() or 0

        return jsonify({
            "total_invoiced": float(total_invoiced),
            "total_paid": float(total_paid),
            "amount_owed": float(total_invoiced - total_paid),
            "earned_since_first_invoice": float(total_paid),
        })
    except Exception as e:
        current_app.logger.exception(f"invoices_summary failed: {e}")
        return jsonify({"total_invoiced":0,"total_paid":0,"amount_owed":0,"earned_since_first_invoice":0})

@agent_bp.route('/agent/invoices/<int:invoice_id>', methods=['DELETE'])
@jwt_required()
def delete_agent_invoice(invoice_id):
    """Delete an invoice owned by the current agent (including links)."""
    try:
        agent_id = _current_agent_id()
        if not agent_id:
            return jsonify({'error': 'Access denied'}), 403

        invoice = Invoice.query.filter_by(id=invoice_id, agent_id=agent_id).first()
        if not invoice:
            return jsonify({'error': 'Invoice not found'}), 404

        # Remove links and invoice
        InvoiceJob.query.filter_by(invoice_id=invoice.id).delete()
        db.session.delete(invoice)
        db.session.commit()
        return jsonify({'message': 'Invoice deleted'}), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error deleting agent invoice {invoice_id}: {e}")
        return jsonify({'error': 'Failed to delete invoice'}), 500

@agent_bp.route('/agent/invoices/<int:invoice_id>/download', methods=['GET'])
@jwt_required()
def download_agent_invoice(invoice_id):
    """
    Return a URL the frontend can use to download the PDF.
    If S3 works -> signed S3 URL.
    Otherwise -> our own /download-direct route which streams the PDF.
    """
    try:
        current_user_id = int(get_jwt_identity())
        agent = User.query.get(current_user_id)
        if not agent or agent.role != 'agent':
            return jsonify({'error': 'Access denied'}), 403

        invoice = Invoice.query.filter_by(id=invoice_id, agent_id=agent.id).first()
        if not invoice:
            return jsonify({'error': 'Invoice not found'}), 404
        if invoice.status == 'draft':
            return jsonify({'error': 'Cannot download draft invoices. Please complete the invoice first.'}), 400

        if s3_client.is_configured():
            # Prefer agent's own invoice number for filename when available
            filename = None
            try:
                if hasattr(invoice, 'agent_invoice_number') and invoice.agent_invoice_number:
                    filename = f"{invoice.agent_invoice_number}.pdf"
            except Exception:
                filename = None
            signed = s3_client.generate_invoice_download_url(agent.id, invoice.invoice_number, expiration=3600)
            if signed.get('success'):
                return jsonify({
                    'download_url': signed['download_url'],
                    'expires_in': signed['expires_in'],
                    'invoice_number': signed['invoice_number'],
                    'filename': filename or signed['filename'],
                    'file_size': signed.get('file_size', 'Unknown')
                }), 200

        return jsonify({
            'download_url': url_for('agent.download_invoice_direct', invoice_id=invoice_id),
            'invoice_number': invoice.invoice_number,
            'filename': (str(getattr(invoice, 'agent_invoice_number', '')) + '.pdf') if getattr(invoice, 'agent_invoice_number', None) else None
        }), 200

    except Exception as e:
        current_app.logger.error(f"DOWNLOAD JSON ERROR for invoice {invoice_id}: {e}")
        return jsonify({'error': 'Failed to generate download URL'}), 500

@agent_bp.route('/agent/invoices/<int:invoice_id>/download-direct', methods=['GET'])
@jwt_required()
def download_invoice_direct(invoice_id):
    """
    If S3 works, redirect to signed URL.
    Otherwise generate the PDF now and stream it; then delete the temp file.
    """
    try:
        current_user_id = int(get_jwt_identity())
        agent = User.query.get(current_user_id)
        if not agent or agent.role != 'agent':
            return jsonify({'error': 'Access denied'}), 403

        invoice = Invoice.query.filter_by(id=invoice_id, agent_id=agent.id).first()
        if not invoice:
            return jsonify({'error': 'Invoice not found'}), 404
        if invoice.status == 'draft':
            return jsonify({'error': 'Cannot download draft invoices'}), 400

        if s3_client.is_configured():
            signed = s3_client.generate_invoice_download_url(agent.id, invoice.invoice_number, expiration=300)
            if signed.get('success'):
                return redirect(signed['download_url'])

        invoice_jobs = InvoiceJob.query.filter_by(invoice_id=invoice.id).all()
        if not invoice_jobs:
            return jsonify({'error': 'No invoice jobs found for PDF'}), 404

        jobs_data = []
        for ij in invoice_jobs:
            job = ij.job
            if not job:
                continue
            hours = float(ij.hours_worked or 0)
            rate = float(ij.hourly_rate_at_invoice or job.hourly_rate or 0)
            amount = hours * rate
            jobs_data.append({'job': job, 'hours': hours, 'rate': rate, 'amount': amount})
        if not jobs_data:
            return jsonify({'error': 'No valid job data to render PDF'}), 500

        total_amount_float = float(invoice.total_amount or 0)
        pdf_result = generate_invoice_pdf(
            agent,
            jobs_data,
            total_amount_float,
            invoice.invoice_number,
            upload_to_s3=False,
            agent_invoice_number=getattr(invoice, 'agent_invoice_number', None)
        )
        
        # Handle PDF generation failure
        if pdf_result is None:
            return jsonify({'error': 'PDF generation failed'}), 500
            
        pdf_path = pdf_result[0] if isinstance(pdf_result, tuple) else pdf_result
        if not pdf_path or not os.path.exists(pdf_path):
            return jsonify({'error': 'PDF generation failed'}), 500

        # Prefer agent's own invoice number for the filename when present
        preferred_name = f"{getattr(invoice, 'agent_invoice_number', None)}.pdf" if getattr(invoice, 'agent_invoice_number', None) else f"{invoice.invoice_number}.pdf"
        resp = send_file(
            pdf_path,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=preferred_name
        )
        @resp.call_on_close
        def _cleanup():
            try:
                os.remove(pdf_path)
            except Exception:
                pass
        return resp

    except Exception as e:
        current_app.logger.error(f"DIRECT DOWNLOAD ERROR for invoice {invoice_id}: {e}")
        return jsonify({'error': 'Download failed'}), 500

@agent_bp.route('/agent/s3-diagnosis/<int:invoice_id>', methods=['GET'])
@jwt_required()
def diagnose_s3_invoice(invoice_id):
    """Diagnose S3 permissions for a specific invoice (admin/debugging endpoint)."""
    try:
        current_user_id = int(get_jwt_identity())
        agent = User.query.get(current_user_id)
        
        if not agent or agent.role != 'agent':
            return jsonify({'error': 'Access denied'}), 403
        
        # Get the invoice and verify ownership
        invoice = Invoice.query.filter_by(id=invoice_id, agent_id=agent.id).first()
        
        if not invoice:
            return jsonify({'error': 'Invoice not found'}), 404
        
        # Run S3 diagnosis for this specific invoice file
        file_key = f"invoices/{agent.id}/{invoice.invoice_number}.pdf"
        diagnosis = s3_client.diagnose_s3_permissions(file_key)
        
        return jsonify({
            'invoice_id': invoice_id,
            'invoice_number': invoice.invoice_number,
            'agent_id': agent.id,
            'file_key': file_key,
            'diagnosis': diagnosis
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"S3 diagnosis failed for invoice {invoice_id}: {str(e)}")
        return jsonify({'error': 'Diagnosis failed', 'details': str(e)}), 500

# --- AGENT INVOICE NUMBERING ENDPOINTS ---

@agent_bp.route('/agent/next-invoice-number', methods=['GET'])
@jwt_required()
def get_next_invoice_number():
    """Get the suggested next invoice number for the current agent (flexible system)."""
    try:
        current_user_id = int(get_jwt_identity())
        agent = User.query.get(current_user_id)
        
        if not agent or agent.role != 'agent':
            return jsonify({'error': 'Access denied'}), 403
        
        # Use the new flexible system
        current_number = getattr(agent, 'current_invoice_number', 0) or 0
        suggested_next = current_number + 1
        
        # Also provide the old system for backward compatibility
        old_next = getattr(agent, 'agent_invoice_next', None) or 1
        
        return jsonify({
            'suggested': suggested_next,
            'current': current_number,
            'legacy_next': old_next  # For backward compatibility
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Error fetching next invoice number: {str(e)}")
        return jsonify({'error': 'Failed to fetch next invoice number'}), 500

@agent_bp.route('/agent/validate-invoice-number', methods=['POST'])
@jwt_required()
def validate_invoice_number():
    """Validate if an invoice number is available for the current agent."""
    try:
        current_user_id = int(get_jwt_identity())
        agent = User.query.get(current_user_id)
        
        if not agent or agent.role != 'agent':
            return jsonify({'error': 'Access denied'}), 403
        
        data = request.get_json()
        invoice_number = data.get('invoice_number')
        
        if not invoice_number:
            return jsonify({'error': 'Invoice number is required'}), 400
        
        # Validate format
        try:
            invoice_number = int(invoice_number)
            if invoice_number <= 0:
                return jsonify({
                    'valid': False,
                    'error': 'Invoice number must be greater than 0'
                }), 200
            if invoice_number > 999999999:
                return jsonify({
                    'valid': False,
                    'error': 'Invoice number cannot exceed 9 digits'
                }), 200
        except (ValueError, TypeError):
            return jsonify({
                'valid': False,
                'error': 'Invoice number must be a valid integer'
            }), 200
        
        # Check for uniqueness (per agent)
        existing = None
        if hasattr(Invoice, 'agent_invoice_number'):
            existing = Invoice.query.filter_by(
                agent_id=current_user_id, 
                agent_invoice_number=invoice_number
            ).first()
        
        if existing:
            return jsonify({
                'valid': False,
                'error': f'Invoice number {invoice_number} has already been used',
                'existing_invoice': existing.invoice_number
            }), 200
        
        return jsonify({
            'valid': True,
            'message': f'Invoice number {invoice_number} is available'
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Error validating invoice number: {str(e)}")
        return jsonify({'error': 'Failed to validate invoice number'}), 500

@agent_bp.route('/agent/numbering', methods=['PATCH'])
@jwt_required()
def update_agent_numbering():
    """Update the agent's current invoice number (flexible system)."""
    try:
        current_user_id = int(get_jwt_identity())
        agent = User.query.get(current_user_id)
        
        if not agent or agent.role != 'agent':
            return jsonify({'error': 'Access denied'}), 403
        
        data = request.get_json()
        if not data or 'current' not in data:
            return jsonify({'error': 'Current invoice number is required'}), 400
        
        current_number = data['current']
        
        # Validate integer >= 0 (0 means starting fresh)
        try:
            current_number = int(current_number)
            if current_number < 0:
                return jsonify({'error': 'Current number must be 0 or greater'}), 400
            if current_number > 999999999:  # Max 9 digits
                return jsonify({'error': 'Current number cannot exceed 9 digits'}), 400
        except (ValueError, TypeError):
            return jsonify({'error': 'Current number must be a valid integer'}), 400
        
        # Update agent's current number in the flexible system
        if hasattr(agent, 'current_invoice_number'):
            agent.current_invoice_number = current_number
        
        # Also update the legacy system for backward compatibility
        if hasattr(agent, 'agent_invoice_next'):
            agent.agent_invoice_next = current_number + 1
        
        db.session.commit()
        
        return jsonify({
            'message': 'Invoice numbering updated successfully',
            'current': current_number,
            'suggested_next': current_number + 1
        }), 200
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error updating agent numbering: {str(e)}")
        return jsonify({'error': 'Failed to update numbering'}), 500

@agent_bp.route('/agent/invoices/<int:invoice_id>/agent-number', methods=['PATCH'])
@jwt_required()
def update_invoice_agent_number(invoice_id):
    """Update the agent invoice number for an existing invoice."""
    try:
        current_user_id = int(get_jwt_identity())
        agent = User.query.get(current_user_id)
        
        if not agent or agent.role != 'agent':
            return jsonify({'error': 'Access denied'}), 403
        
        # Find the invoice
        invoice = Invoice.query.filter_by(id=invoice_id, agent_id=agent.id).first()
        if not invoice:
            return jsonify({'error': 'Invoice not found'}), 404
        
        data = request.get_json()
        if not data or 'agent_invoice_number' not in data:
            return jsonify({'error': 'Agent invoice number is required'}), 400
        
        new_agent_number = data['agent_invoice_number']
        update_next = data.get('update_next', 'auto')
        
        # Validate integer > 0
        try:
            new_agent_number = int(new_agent_number)
            if new_agent_number <= 0:
                return jsonify({'error': 'Agent invoice number must be greater than 0'}), 400
            if new_agent_number > 999999999:  # Max 9 digits
                return jsonify({'error': 'Agent invoice number cannot exceed 9 digits'}), 400
        except (ValueError, TypeError):
            return jsonify({'error': 'Agent invoice number must be a valid integer'}), 400
        
        # Check for uniqueness (per agent) - only if field exists
        existing = None
        if hasattr(Invoice, 'agent_invoice_number'):
            existing = Invoice.query.filter(
                Invoice.agent_id == agent.id,
                Invoice.agent_invoice_number == new_agent_number,
                Invoice.id != invoice_id
            ).first()
        
        if existing:
            return jsonify({
                'message': 'Duplicate agent invoice number',
                'suggestedNext': getattr(agent, 'agent_invoice_next', None) or 1
            }), 409
        
        # Update the invoice - only if field exists
        if hasattr(invoice, 'agent_invoice_number'):
            invoice.agent_invoice_number = new_agent_number
        else:
            current_app.logger.warning("agent_invoice_number field not found on invoice - database migration needed")
        
        # Handle update_next option
        if hasattr(agent, 'agent_invoice_next'):
            if update_next == 'force':
                agent.agent_invoice_next = new_agent_number + 1
            elif update_next == 'auto':
                current_next = getattr(agent, 'agent_invoice_next', None) or 1
                agent.agent_invoice_next = max(current_next, new_agent_number + 1)
            # 'nochange' - don't update agent_invoice_next
        
        db.session.commit()
        
        return jsonify({
            'message': 'Agent invoice number updated successfully',
            'invoice': invoice.to_dict(),
            'agent_invoice_next': getattr(agent, 'agent_invoice_next', None) or 1
        }), 200
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error updating agent invoice number: {str(e)}")
        return jsonify({'error': 'Failed to update agent invoice number'}), 500

# --- TELEGRAM INTEGRATION ENDPOINTS ---

@agent_bp.route('/agent/telegram/link/start', methods=['POST'])
@jwt_required()
def create_telegram_link_token():
    """
    Generate a one-time code for Telegram linking
    
    Returns:
        JSON with code and bot_username
    """
    try:
        agent_id = get_jwt_identity()
        agent = User.query.get(agent_id)
        
        if not agent or agent.role != 'agent':
            return jsonify({'error': 'Access denied. Agent role required.'}), 403
        
        if not current_app.config.get('TELEGRAM_ENABLED', False):
            return jsonify({'error': 'Telegram integration is disabled'}), 400
        
        # Generate random 6-8 character code
        import string
        import random
        code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
        
        # Store code and reset opt-in
        agent.telegram_link_code = code
        agent.telegram_opt_in = False
        
        db.session.commit()
        current_app.logger.info(f"Generated Telegram link code for agent {agent.id}")
        
        # Get bot username from API
        bot_username = "V3JobsBot"  # default fallback
        try:
            from src.integrations.telegram_client import get_bot_info
            bot_info = get_bot_info()
            if bot_info.get("ok") and "result" in bot_info:
                bot_username = bot_info["result"].get("username", "V3JobsBot")
        except Exception as e:
            current_app.logger.warning(f"Could not get bot username: {str(e)}")
        
        return jsonify({
            'code': code,
            'bot_username': bot_username
        })
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error creating Telegram link code: {str(e)}")
        return jsonify({'error': 'Failed to generate link code'}), 500

@agent_bp.route('/agent/telegram/status', methods=['GET'])
@jwt_required()
def get_telegram_status():
    """
    Get Telegram integration status for current user
    
    Returns:
        JSON with enabled, linked, and bot_username status
    """
    try:
        agent_id = get_jwt_identity()
        agent = User.query.get(agent_id)
        
        if not agent or agent.role != 'agent':
            return jsonify({'error': 'Access denied. Agent role required.'}), 403
        
        enabled = current_app.config.get("TELEGRAM_ENABLED", False)
        linked = bool(agent.telegram_chat_id) if agent else False
        
        bot_username = None
        if enabled:
            try:
                from src.integrations.telegram_client import get_bot_info
                bot_info = get_bot_info()
                if bot_info.get("ok") and "result" in bot_info:
                    bot_username = bot_info["result"].get("username")
            except Exception as e:
                current_app.logger.warning(f"Could not get bot username: {str(e)}")
        
        return jsonify({
            "enabled": enabled,
            "linked": linked,
            "bot_username": bot_username
        })
        
    except Exception as e:
        current_app.logger.error(f"Error getting Telegram status: {str(e)}")
        return jsonify({'error': 'Failed to get status'}), 500

@agent_bp.route('/agent/telegram/disconnect', methods=['POST'])
@jwt_required()
def disconnect_telegram():
    """
    Disconnect Telegram account for the current agent
    
    Returns:
        JSON with success status
    """
    try:
        agent_id = get_jwt_identity()
        agent = User.query.get(agent_id)
        
        if not agent or agent.role != 'agent':
            return jsonify({'error': 'Access denied. Agent role required.'}), 403
        
        if not current_app.config['TELEGRAM_ENABLED']:
            return jsonify({'status': 'disabled', 'message': 'Telegram integration is disabled'}), 200
        
        # Clear Telegram connection data
        agent.telegram_chat_id = None
        agent.telegram_username = None
        agent.telegram_opt_in = False
        agent.telegram_link_code = None  # Clear any pending link code
        
        db.session.commit()
        
        current_app.logger.info(f"Telegram disconnected for agent {agent.id}")
        
        return jsonify({"message": "Telegram account disconnected successfully"})
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error disconnecting Telegram: {str(e)}")
        return jsonify({'error': 'Failed to disconnect Telegram'}), 500

@agent_bp.route('/agent/telegram/test', methods=['POST'])
@jwt_required()
def send_test_telegram():
    """
    Send a test message to the agent's linked Telegram
    
    Returns:
        JSON with send status
    """
    try:
        agent_id = get_jwt_identity()
        agent = User.query.get(agent_id)
        
        if not agent or agent.role != 'agent':
            return jsonify({'error': 'Access denied. Agent role required.'}), 403
        
        if not current_app.config.get('TELEGRAM_ENABLED', False):
            return jsonify({'error': 'Telegram integration is disabled'}), 400
        
        # Respect global notifications mute
        try:
            from src.models.user import Setting
            default_enabled = str(current_app.config.get('NOTIFICATIONS_ENABLED', 'true')).lower() in ('1','true','yes','on')
            if not Setting.get_bool('notifications_enabled', default_enabled):
                current_app.logger.info("Notification skipped (muted)", extra={"event": "agent_test_telegram", "agent_id": agent.id})
                return jsonify({'status': 'skipped', 'message': 'Notifications are disabled by admin'}), 200
        except Exception:
            pass

        if not agent.telegram_chat_id or not agent.telegram_opt_in:
            return jsonify({'error': 'Telegram not connected or notifications disabled'}), 400
        
        # Send test message
        from src.integrations.telegram_client import send_message
        
        test_message = f"🧪 <b>Test Message</b>\n\nHello {agent.first_name}! This is a test notification from V3 Services.\n\n✅ Your Telegram notifications are working correctly."
        
        result = send_message(agent.telegram_chat_id, test_message)
        
        if result.get('status') == 'error' or not result.get('ok'):
            return jsonify({'error': f"Failed to send test message: {result.get('message', 'Unknown error')}"}), 500
        
        current_app.logger.info(f"Test Telegram message sent to agent {agent.id}")
        
        return jsonify({'message': 'Test message sent successfully'})
        
    except Exception as e:
        current_app.logger.error(f"Error sending test Telegram message: {str(e)}")
        return jsonify({'error': 'Failed to send test message'}), 500
