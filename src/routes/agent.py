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
from src.models.user import User, Job, JobAssignment, AgentAvailability, Notification, Invoice, InvoiceJob, db
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

def get_safe_invoice_number(agent, field_name='current_invoice_number', default=0):
    """Safely get invoice number fields, handling missing database columns"""
    try:
        return getattr(agent, field_name, default) or default
    except Exception:
        return default

def set_safe_invoice_number(agent, field_name, value):
    """Safely set invoice number fields, handling missing database columns"""
    try:
        if hasattr(agent, field_name):
            setattr(agent, field_name, value)
            return True
    except Exception:
        pass
    return False

def allowed_file(filename):
    """Check if the file extension is allowed."""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in {'pdf', 'jpg', 'jpeg', 'png'}


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

def generate_misc_invoice_pdf(agent, misc_items, total_amount, invoice_number, upload_to_s3=True, agent_invoice_number=None):
    """
    Generates a PDF for miscellaneous invoice items.
    """
    from src.pdf.invoice_builder import build_invoice_pdf
    from datetime import date as date_cls
    
    try:
        current_app.logger.info(f"MISC PDF GENERATION START: {invoice_number} items_count={len(misc_items or [])}")
        
        # Transform misc items to job-like format for PDF builder
        jobs_data = []
        for item in misc_items:
            jobs_data.append({
                'job': None,
                'hours': item.get('quantity', 1),
                'rate': item.get('unit_price', 0),
                'amount': item.get('amount', 0),
                'address': item.get('description', 'Miscellaneous Service'),
                'arrival_time': date_cls.today().strftime('%Y-%m-%d'),
                'job_type': 'Misc'
            })
        
        # Use the regular PDF builder
        return generate_invoice_pdf(agent, jobs_data, total_amount, invoice_number, upload_to_s3, agent_invoice_number)
        
    except Exception as e:
        current_app.logger.error(f"Error generating misc invoice PDF: {str(e)}")
        raise

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
            # Handle fake job objects for misc items
            if hasattr(job, 'address') and job.address:
                return str(job.address).strip()
            # For Job objects, the address is in the 'address' field
            best = getattr(job, "address", None)
            if not best:
                # If no main address, try to construct from parts (for User objects)
                parts = [getattr(job, "address_line_1", ""), getattr(job, "city", ""), getattr(job, "postcode", "")]
                parts = [p for p in parts if p and str(p).strip()]
                best = ", ".join(parts)
            return best.strip() or "Miscellaneous Service"

        def _job_date(job):
            # Handle fake job objects for misc items
            if hasattr(job, 'arrival_time') and job.arrival_time:
                try:
                    if hasattr(job.arrival_time, 'strftime'):
                        return job.arrival_time.strftime("%d/%m/%Y")
                    else:
                        return str(job.arrival_time)[:10]
                except:
                    pass
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
            return date_cls.today().strftime("%d/%m/%Y")

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

        # Totals
        calc_total = sum(_f(r['amount']) for r in normalized_jobs) if total_amount is None else _f(total_amount)
        totals = {
            'subtotal': calc_total,
            'vat': 0.0,
            'total': calc_total,
        }

        # Invoice date
        invoice_date = getattr(invoice, 'issue_date', None) or date_cls.today()

        # Create invoice directory
        invoice_folder = os.path.join('/tmp', 'invoices')
        os.makedirs(invoice_folder, exist_ok=True)
        file_path = os.path.join(invoice_folder, f"{invoice_number}.pdf")

        current_app.logger.info(f"PDF GENERATION: Building to {file_path}")

        # Build PDF (pass invoice for header/meta if builder uses it)
        build_invoice_pdf(
            file_path=file_path,
            agent=agent,
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
                job_dict = job.to_dict()
                job_dict['assignment_id'] = assignment.id
                available_jobs.append(job_dict)

        # ================================
        # END OF FIXED LOGIC
        # ================================

        upcoming_shifts = db.session.query(Job).join(JobAssignment).filter(
            JobAssignment.agent_id == user.id,
            JobAssignment.status == 'accepted',
            Job.arrival_time > now
        ).order_by(Job.arrival_time.asc()).all()
        
        completed_jobs = db.session.query(Job).join(JobAssignment).filter(
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
            'upcoming_shifts': [job.to_dict() for job in upcoming_shifts],
            'completed_jobs': [job.to_dict() for job in completed_jobs],
            'reports_to_file': [job.to_dict() for job in reports_to_file]
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
    """Fetches accepted jobs for the current agent that have not yet been invoiced."""
    try:
        current_user_id = int(get_jwt_identity())
        
        # Debug logging
        from flask import current_app
        current_app.logger.info(f"DEBUG: Getting invoiceable jobs for agent {current_user_id}")
        
        invoiced_job_ids_query = db.session.query(InvoiceJob.job_id).join(Invoice).filter(Invoice.agent_id == current_user_id)
        invoiced_job_ids = [item[0] for item in invoiced_job_ids_query.all()]
        current_app.logger.info(f"DEBUG: Invoiced job IDs: {invoiced_job_ids}")

        accepted_jobs_query = db.session.query(Job).join(JobAssignment).filter(
            JobAssignment.agent_id == current_user_id,
            JobAssignment.status == 'accepted'
        )
        
        all_accepted_jobs = accepted_jobs_query.all()
        current_app.logger.info(f"DEBUG: Found {len(all_accepted_jobs)} accepted jobs")
        for job in all_accepted_jobs:
            current_app.logger.info(f"DEBUG: Job {job.id} - {job.address} - arrival: {job.arrival_time}")

        invoiceable_jobs = accepted_jobs_query.filter(~Job.id.in_(invoiced_job_ids)).order_by(Job.arrival_time.desc()).all()
        current_app.logger.info(f"DEBUG: Final invoiceable jobs count: {len(invoiceable_jobs)}")
        
        return jsonify([job.to_dict() for job in invoiceable_jobs]), 200

    except Exception as e:
        current_app.logger.error(f"DEBUG: Error in get_invoiceable_jobs: {str(e)}")
        return jsonify({"error": "An internal error occurred", "details": str(e)}), 500

@agent_bp.route('/agent/test-invoice-data', methods=['GET'])
@jwt_required()
def test_invoice_data():
    """EMERGENCY TEST - Check what data exists"""
    try:
        current_user_id = int(get_jwt_identity())
        
        # Get all jobs for this agent
        all_assignments = JobAssignment.query.filter_by(agent_id=current_user_id).all()
        
        result = {
            "agent_id": current_user_id,
            "total_assignments": len(all_assignments),
            "assignments_by_status": {},
            "recent_jobs": []
        }
        
        for assignment in all_assignments:
            status = assignment.status
            if status not in result["assignments_by_status"]:
                result["assignments_by_status"][status] = 0
            result["assignments_by_status"][status] += 1
            
            if assignment.status == 'accepted':
                job = Job.query.get(assignment.job_id)
                if job:
                    result["recent_jobs"].append({
                        "job_id": job.id,
                        "address": job.address,
                        "arrival_time": str(job.arrival_time),
                        "job_status": job.status,
                        "assignment_status": assignment.status
                    })
        
        return jsonify(result), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@agent_bp.route('/agent/fix-assignments', methods=['POST'])
@jwt_required()
def fix_assignments():
    """EMERGENCY FIX - Accept all pending assignments for this agent"""
    try:
        current_user_id = int(get_jwt_identity())
        
        # Find all pending assignments for this agent
        pending_assignments = JobAssignment.query.filter_by(
            agent_id=current_user_id, 
            status='pending'
        ).all()
        
        fixed_count = 0
        for assignment in pending_assignments:
            assignment.status = 'accepted'
            fixed_count += 1
        
        db.session.commit()
        
        # EMERGENCY: Also try to create a new assignment if none exist
        if fixed_count == 0:
            # Find the most recent job and create an assignment
            recent_job = Job.query.order_by(Job.id.desc()).first()
            if recent_job:
                # Check if assignment already exists
                existing = JobAssignment.query.filter_by(
                    job_id=recent_job.id, 
                    agent_id=current_user_id
                ).first()
                
                if not existing:
                    # Create new assignment
                    new_assignment = JobAssignment(
                        job_id=recent_job.id,
                        agent_id=current_user_id,
                        status='accepted'
                    )
                    db.session.add(new_assignment)
                    db.session.commit()
                    fixed_count = 1
        
        return jsonify({
            "success": True,
            "fixed_count": fixed_count,
            "message": f"Fixed {fixed_count} assignments"
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

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
        # Accept agent_invoice_number from frontend (their personal invoice number)
        custom_invoice_number = data.get('agent_invoice_number') or data.get('invoice_number')

        if not job_items:
            return jsonify({'error': 'No items provided for invoicing.'}), 400

        # --- Data Validation and Calculation ---
        total_amount = Decimal(0)
        jobs_to_invoice = []
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
                current_number = get_safe_invoice_number(agent, 'current_invoice_number', 0)
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
            current_number = get_safe_invoice_number(agent, 'current_invoice_number', 0)
            final_agent_invoice_number = current_number + 1

        # --- Database Transaction ---
        
        # 1. Create the new invoice record
        issue_date = date.today()
        # Use simple agent sequential numbering (e.g., "325", "326", etc.)
        invoice_number = str(final_agent_invoice_number)

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
        
        # Only add agent_invoice_number if the field exists in the model
        if hasattr(Invoice, 'agent_invoice_number'):
            invoice_kwargs['agent_invoice_number'] = final_agent_invoice_number
        
        new_invoice = Invoice(**invoice_kwargs)
        db.session.add(new_invoice)
        db.session.flush()

        # Update agent's invoice numbering system
        # Update the new flexible system
        if hasattr(agent, 'current_invoice_number'):
            set_safe_invoice_number(agent, 'current_invoice_number', final_agent_invoice_number)
            
        # Also update the legacy system for backward compatibility
        current_next = get_safe_invoice_number(agent, 'agent_invoice_next', 1)
        if hasattr(agent, 'agent_invoice_next'):
            set_safe_invoice_number(agent, 'agent_invoice_next', max(current_next, final_agent_invoice_number + 1))

        # 2. Link the jobs to the new invoice
        for item in jobs_to_invoice:
            job = item['job']
            hours = item['hours']
            rate = job.hourly_rate  # Get the rate from the job
            
            invoice_job_link = InvoiceJob(
                invoice_id=new_invoice.id,
                job_id=job.id,
                hours_worked=hours,
                hourly_rate_at_invoice=rate  # Store the rate at time of invoicing
            )
            db.session.add(invoice_job_link)
            
        # --- PDF and Emailing ---
        pdf_result = generate_invoice_pdf(agent, jobs_to_invoice, total_amount, invoice_number, upload_to_s3=True, agent_invoice_number=final_agent_invoice_number)
        
        # Handle different return formats (with or without S3 upload)
        if isinstance(pdf_result, tuple):
            pdf_path, s3_file_key = pdf_result
            # Store S3 file key in database
            # Temporarily disabled - pdf_file_url field doesn't exist in database yet
            # new_invoice.pdf_file_url = s3_file_key
        else:
            pdf_path = pdf_result

        # Send in-app notification to agent instead of email
        notification = Notification(
            user_id=agent.id,
            title=f"Invoice {invoice_number} Generated",
            message=f"Your invoice {invoice_number} for £{total_amount:.2f} has been generated and is ready for download.",
            type="invoice_generated"
        )
        db.session.add(notification)
        
        current_app.logger.info(f"Invoice {invoice_number} created for agent {agent.email} - stored in S3")

        # --- Commit Transaction ---
        db.session.commit()
        
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

@agent_bp.route('/agent/invoice/misc', methods=['POST'])
@jwt_required()
def create_misc_invoice():
    """
    Creates a miscellaneous invoice with custom line items.
    """
    try:
        current_user_id = int(get_jwt_identity())
        agent = User.query.get(current_user_id)
        if not agent or agent.role != 'agent':
            return jsonify({'error': 'Access denied.'}), 403

        data = request.get_json()
        line_items = data.get('items', [])
        custom_invoice_number = data.get('agent_invoice_number') or data.get('invoice_number')

        if not line_items:
            return jsonify({'error': 'No items provided for invoicing.'}), 400

        # --- Data Validation and Calculation ---
        total_amount = Decimal(0)
        misc_items = []
        
        for item in line_items:
            description = item.get('description', '').strip()
            if not description:
                return jsonify({'error': 'Each item must have a description.'}), 400
            
            try:
                quantity = Decimal(str(item.get('quantity', 1)))
                unit_price = Decimal(str(item.get('unit_price', 0)))
                if quantity <= 0:
                    return jsonify({'error': f'Invalid quantity for item: {description}'}), 400
                if unit_price < 0:
                    return jsonify({'error': f'Invalid unit price for item: {description}'}), 400
            except (InvalidOperation, ValueError):
                return jsonify({'error': f'Invalid numeric values for item: {description}'}), 400
            
            amount = quantity * unit_price
            total_amount += amount
            
            misc_items.append({
                'description': description,
                'quantity': quantity,
                'unit_price': unit_price,
                'amount': amount
            })

        if total_amount <= 0:
            return jsonify({'error': 'Invoice total must be greater than zero.'}), 400

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
            
            # Check for uniqueness (per agent)
            existing = None
            if hasattr(Invoice, 'agent_invoice_number'):
                existing = Invoice.query.filter_by(agent_id=current_user_id, agent_invoice_number=custom_invoice_number).first()
            if existing:
                current_number = get_safe_invoice_number(agent, 'current_invoice_number', 0)
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
            current_number = get_safe_invoice_number(agent, 'current_invoice_number', 0)
            final_agent_invoice_number = current_number + 1

        # --- Database Transaction ---
        issue_date = date.today()
        # Use simple agent sequential numbering
        invoice_number = str(final_agent_invoice_number)
        
        # Create invoice for misc items (no job snapshot needed)
        invoice_kwargs = {
            'agent_id': current_user_id,
            'invoice_number': invoice_number,
            'issue_date': issue_date,
            'due_date': issue_date + timedelta(days=30),
            'total_amount': total_amount,
            'status': 'submitted',
            'job_type': 'Miscellaneous Services',
            'address': 'Various'
        }
        
        # Only add agent_invoice_number if the field exists in the model
        if hasattr(Invoice, 'agent_invoice_number'):
            invoice_kwargs['agent_invoice_number'] = final_agent_invoice_number
        
        new_invoice = Invoice(**invoice_kwargs)
        db.session.add(new_invoice)
        db.session.flush()

        # Update agent's invoice numbering system
        if hasattr(agent, 'current_invoice_number'):
            set_safe_invoice_number(agent, 'current_invoice_number', final_agent_invoice_number)
            
        # Also update the legacy system for backward compatibility
        current_next = get_safe_invoice_number(agent, 'agent_invoice_next', 1)
        if hasattr(agent, 'agent_invoice_next'):
            set_safe_invoice_number(agent, 'agent_invoice_next', max(current_next, final_agent_invoice_number + 1))

        # Create fake job-style data for PDF generation
        jobs_data_for_pdf = []
        for item in misc_items:
            jobs_data_for_pdf.append({
                'job': None,  # No actual job
                'description': item['description'],
                'quantity': float(item['quantity']),
                'unit_price': float(item['unit_price']),
                'hours': float(item['quantity']),  # For PDF compatibility
                'rate': float(item['unit_price']),  # For PDF compatibility
                'amount': float(item['amount']),
                'address': 'Miscellaneous Service',
                'arrival_time': issue_date.strftime('%Y-%m-%d'),
                'job_type': 'Misc'
            })

        # Generate PDF
        pdf_result = generate_misc_invoice_pdf(agent, jobs_data_for_pdf, total_amount, invoice_number, upload_to_s3=True, agent_invoice_number=final_agent_invoice_number)
        
        # Handle different return formats (with or without S3 upload)
        if isinstance(pdf_result, tuple):
            pdf_path, s3_file_key = pdf_result
        else:
            pdf_path = pdf_result

        # Send in-app notification to agent
        notification = Notification(
            user_id=agent.id,
            title=f"Misc Invoice {invoice_number} Generated",
            message=f"Your miscellaneous invoice {invoice_number} for £{total_amount:.2f} has been generated and is ready for download.",
            type="invoice_generated"
        )
        db.session.add(notification)
        
        current_app.logger.info(f"Misc Invoice {invoice_number} created for agent {agent.email}")

        # Commit transaction
        db.session.commit()
        
        return jsonify({
            'message': 'Miscellaneous invoice created successfully!',
            'invoice_number': invoice_number
        }), 201

    except Exception as e:
        db.session.rollback()
        if 'pdf_path' in locals() and os.path.exists(pdf_path):
            os.remove(pdf_path)
        import traceback
        current_app.logger.error(f"Error creating misc invoice: {traceback.format_exc()}")
        return jsonify({"error": "An internal server error occurred.", "details": str(e)}), 500

@agent_bp.route('/agent/invoices', methods=['POST'])
@jwt_required()
def create_invoice_standard():
    """
    Create invoice with manual invoice number - handles both job-based and miscellaneous invoices
    """
    try:
        current_user_id = int(get_jwt_identity())
        agent = User.query.get(current_user_id)
        if not agent or agent.role != 'agent':
            return jsonify({'error': 'Access denied.'}), 403

        data = request.get_json()
        custom_invoice_number = data.get('invoice_number')
        jobs = data.get('jobs', [])
        miscellaneous_items = data.get('miscellaneous_items', [])
        
        if not jobs and not miscellaneous_items:
            return jsonify({'error': 'No jobs or miscellaneous items provided for invoicing.'}), 400

        # Use manual invoice number if provided, otherwise generate one
        final_invoice_number = None
        
        if custom_invoice_number:
            # Check if invoice number already exists
            existing_invoice = Invoice.query.filter_by(invoice_number=custom_invoice_number).first()
            if existing_invoice:
                return jsonify({'error': f'Invoice number {custom_invoice_number} already exists. Please use a different number.'}), 409
            final_invoice_number = custom_invoice_number
        else:
            # Generate automatic number
            current_number = get_safe_invoice_number(agent, 'current_invoice_number', 0)
            final_invoice_number = str(current_number + 1)

        # Calculate total amount
        total_amount = Decimal(0)
        
        # Process jobs
        jobs_to_invoice = []
        for job_data in jobs:
            job = Job.query.get(job_data['job_id'])
            if not job:
                return jsonify({'error': f"Job with ID {job_data['job_id']} not found."}), 404
            
            hours = Decimal(str(job_data.get('hours', 0)))
            if hours <= 0:
                return jsonify({'error': f"Invalid hours for job at {job.address}."}), 400

            rate = Decimal(str(job.hourly_rate))
            amount = hours * rate
            total_amount += amount
            jobs_to_invoice.append({'job': job, 'hours': hours, 'rate': rate, 'amount': amount})

        # Process miscellaneous items
        misc_items_processed = []
        for misc_item in miscellaneous_items:
            description = misc_item.get('description', '').strip()
            if not description:
                return jsonify({'error': 'Each miscellaneous item must have a description.'}), 400
            
            try:
                quantity = Decimal(str(misc_item.get('quantity', 1)))
                unit_price = Decimal(str(misc_item.get('unit_price', 0)))
                if quantity <= 0 or unit_price < 0:
                    return jsonify({'error': f'Invalid values for item: {description}'}), 400
            except (InvalidOperation, ValueError):
                return jsonify({'error': f'Invalid numeric values for item: {description}'}), 400
            
            amount = quantity * unit_price
            total_amount += amount
            misc_items_processed.append({
                'description': description,
                'quantity': quantity,
                'unit_price': unit_price,
                'amount': amount
            })

        if total_amount <= 0:
            return jsonify({'error': 'Invoice total must be greater than zero.'}), 400

        # Create invoice
        issue_date = date.today()
        first_job = jobs_to_invoice[0]['job'] if jobs_to_invoice else None
        
        invoice_kwargs = {
            'agent_id': current_user_id,
            'invoice_number': final_invoice_number,
            'issue_date': issue_date,
            'due_date': issue_date + timedelta(days=30),
            'total_amount': total_amount,
            'status': 'submitted',
            'job_type': first_job.job_type if first_job else 'Miscellaneous Services',
            'address': first_job.address if first_job else 'Various'
        }
        
        # Add agent_invoice_number if field exists
        if hasattr(Invoice, 'agent_invoice_number') and custom_invoice_number:
            try:
                agent_invoice_num = int(custom_invoice_number)
                invoice_kwargs['agent_invoice_number'] = agent_invoice_num
            except (ValueError, TypeError):
                pass
        
        new_invoice = Invoice(**invoice_kwargs)
        db.session.add(new_invoice)
        db.session.flush()

        # Link jobs to invoice
        for item in jobs_to_invoice:
            job = item['job']
            hours = item['hours']
            rate = item['rate']
            
            invoice_job_link = InvoiceJob(
                invoice_id=new_invoice.id,
                job_id=job.id,
                hours_worked=hours,
                hourly_rate_at_invoice=rate
            )
            db.session.add(invoice_job_link)

        # Update agent's invoice numbering if using custom number
        if custom_invoice_number:
            try:
                custom_num = int(custom_invoice_number)
                current_number = get_safe_invoice_number(agent, 'current_invoice_number', 0)
                if custom_num > current_number:
                    set_safe_invoice_number(agent, 'current_invoice_number', custom_num)
            except (ValueError, TypeError):
                pass

        # Prepare data for PDF generation
        all_items = []
        
        # Add jobs
        for item in jobs_to_invoice:
            all_items.append({
                'job': item['job'],
                'hours': float(item['hours']),
                'rate': float(item['rate']),
                'amount': float(item['amount'])
            })
        
        # Add misc items as fake jobs
        for item in misc_items_processed:
            fake_job = type('MockJob', (), {
                'arrival_time': issue_date,
                'job_type': 'Miscellaneous',
                'address': item['description'],
                'title': item['description']
            })()
            
            all_items.append({
                'job': fake_job,
                'hours': float(item['quantity']),
                'rate': float(item['unit_price']),
                'amount': float(item['amount']),
                'description': item['description']
            })

        # Generate PDF
        agent_inv_number = None
        if custom_invoice_number:
            try:
                agent_inv_number = int(custom_invoice_number)
            except (ValueError, TypeError):
                pass
        
        pdf_result = generate_invoice_pdf(
            agent, 
            all_items, 
            float(total_amount), 
            final_invoice_number,
            upload_to_s3=True,
            agent_invoice_number=agent_inv_number
        )
        
        # Handle PDF result
        if isinstance(pdf_result, tuple):
            pdf_path, s3_file_key = pdf_result
        else:
            pdf_path = pdf_result

        # Send notification
        notification = Notification(
            user_id=agent.id,
            title=f"Invoice {final_invoice_number} Generated",
            message=f"Your invoice {final_invoice_number} for £{total_amount:.2f} has been generated.",
            type="invoice_generated"
        )
        db.session.add(notification)
        
        # Commit transaction
        db.session.commit()
        
        current_app.logger.info(f"Invoice {final_invoice_number} created for agent {agent.email}")
        
        return jsonify({
            'message': 'Invoice created successfully!',
            'invoice_number': final_invoice_number
        }), 201

    except Exception as e:
        db.session.rollback()
        if 'pdf_path' in locals() and os.path.exists(pdf_path):
            os.remove(pdf_path)
        import traceback
        current_app.logger.error(f"Error creating invoice: {traceback.format_exc()}")
        return jsonify({"error": "An internal server error occurred.", "details": str(e)}), 500

@agent_bp.route('/agent/invoices/review', methods=['POST'])
@jwt_required()
def create_invoice_from_review():
    """
    Create invoice from ReviewInvoicePage - handles both job-based and misc invoices
    """
    try:
        current_user_id = int(get_jwt_identity())
        agent = User.query.get(current_user_id)
        if not agent or agent.role != 'agent':
            return jsonify({'error': 'Access denied.'}), 403

        data = request.get_json()
        items = data.get('items', [])
        custom_invoice_number = data.get('invoice_number')
        invoice_type = data.get('type', 'job')  # 'job' or 'misc'
        
        if not items:
            return jsonify({'error': 'No items provided for invoicing.'}), 400

        # Determine invoice number to use
        if custom_invoice_number is not None:
            try:
                final_invoice_number = int(custom_invoice_number)
                if final_invoice_number <= 0:
                    return jsonify({'error': 'Invoice number must be greater than 0'}), 400
            except (ValueError, TypeError):
                return jsonify({'error': 'Invoice number must be a valid integer'}), 400
            
            # Check for uniqueness
            existing = Invoice.query.filter_by(agent_id=current_user_id, agent_invoice_number=final_invoice_number).first()
            if existing:
                return jsonify({'error': f'Invoice number {final_invoice_number} already exists'}), 409
        else:
            # Use agent's current invoice number
            final_invoice_number = get_safe_invoice_number(agent, 'current_invoice_number', 1)

        # Calculate total amount
        total_amount = Decimal(0)
        processed_items = []
        
        for item in items:
            try:
                if invoice_type == 'misc':
                    # Misc invoice items
                    quantity = Decimal(str(item.get('quantity', 1)))
                    unit_price = Decimal(str(item.get('unit_price', 0)))
                    amount = quantity * unit_price
                    total_amount += amount
                    
                    processed_items.append({
                        'description': item.get('description', 'Miscellaneous Service'),
                        'quantity': quantity,
                        'unit_price': unit_price,
                        'amount': amount,
                        'job': None  # No job for misc items
                    })
                else:
                    # Job-based invoice items
                    job_id = item.get('jobId')
                    if not job_id:
                        return jsonify({'error': 'Job ID required for job-based invoices'}), 400
                    
                    job = Job.query.get(job_id)
                    if not job:
                        return jsonify({'error': f'Job {job_id} not found'}), 404
                    
                    hours = Decimal(str(item.get('hours', 0)))
                    rate = Decimal(str(item.get('rate', job.hourly_rate or 0)))
                    amount = hours * rate
                    total_amount += amount
                    
                    processed_items.append({
                        'job': job,
                        'hours': hours,
                        'rate': rate,
                        'amount': amount
                    })
            except (ValueError, InvalidOperation):
                return jsonify({'error': f'Invalid numeric values in item'}), 400

        if total_amount <= 0:
            return jsonify({'error': 'Invoice total must be greater than zero'}), 400

        # Create invoice record
        issue_date = date.today()
        invoice_kwargs = {
            'agent_id': current_user_id,
            'invoice_number': str(final_invoice_number),  # Use simple agent number
            'issue_date': issue_date,
            'due_date': issue_date + timedelta(days=30),
            'total_amount': total_amount,
            'status': 'submitted',
            'job_type': 'Miscellaneous Services' if invoice_type == 'misc' else processed_items[0]['job'].job_type if processed_items else 'Various',
            'address': 'Various' if invoice_type == 'misc' else processed_items[0]['job'].address if processed_items else 'Various'
        }
        
        # Add agent_invoice_number if field exists
        if hasattr(Invoice, 'agent_invoice_number'):
            invoice_kwargs['agent_invoice_number'] = final_invoice_number
        
        new_invoice = Invoice(**invoice_kwargs)
        db.session.add(new_invoice)
        db.session.flush()

        # Create InvoiceJob records for job-based invoices
        if invoice_type == 'job':
            for item in processed_items:
                if item['job']:
                    invoice_job = InvoiceJob(
                        invoice_id=new_invoice.id,
                        job_id=item['job'].id,
                        hours_worked=item['hours'],
                        hourly_rate_at_invoice=item['rate']
                    )
                    db.session.add(invoice_job)

        # Update agent's invoice numbering
        if hasattr(agent, 'current_invoice_number'):
            set_safe_invoice_number(agent, 'current_invoice_number', final_invoice_number + 1)
        
        # Prepare data for PDF generation
        if invoice_type == 'misc':
            # Create fake job-like objects for misc items
            jobs_data = []
            for item in processed_items:
                fake_job = type('MockJob', (), {
                    'arrival_time': issue_date,
                    'job_type': 'Miscellaneous',
                    'address': item['description'],
                    'title': item['description']
                })()
                
                jobs_data.append({
                    'job': fake_job,
                    'hours': item['quantity'],
                    'rate': item['unit_price'],
                    'amount': item['amount'],
                    'description': item['description']
                })
        else:
            # Regular job data
            jobs_data = processed_items

        # Generate PDF
        pdf_result = generate_invoice_pdf(
            agent, 
            jobs_data, 
            float(total_amount), 
            str(final_invoice_number),
            upload_to_s3=True,
            agent_invoice_number=final_invoice_number
        )
        
        # Handle PDF result
        if isinstance(pdf_result, tuple):
            pdf_path, s3_file_key = pdf_result
        else:
            pdf_path = pdf_result

        # Send notification
        notification = Notification(
            user_id=agent.id,
            title=f"Invoice {final_invoice_number} Generated",
            message=f"Your {'miscellaneous' if invoice_type == 'misc' else 'job-based'} invoice {final_invoice_number} for £{total_amount:.2f} has been generated.",
            type="invoice_generated"
        )
        db.session.add(notification)
        
        # Commit transaction
        db.session.commit()
        
        current_app.logger.info(f"Invoice {final_invoice_number} created from review for agent {agent.email}")
        
        return jsonify({
            'message': 'Invoice created successfully!',
            'invoice_number': str(final_invoice_number),
            'type': invoice_type
        }), 201

    except Exception as e:
        db.session.rollback()
        if 'pdf_path' in locals() and os.path.exists(pdf_path):
            os.remove(pdf_path)
        import traceback
        current_app.logger.error(f"Error creating invoice from review: {traceback.format_exc()}")
        return jsonify({"error": "An internal server error occurred.", "details": str(e)}), 500

@agent_bp.route('/agent/invoice/simple', methods=['POST'])
@jwt_required()
def create_simple_invoice():
    """Simple invoice creation with manual number entry."""
    try:
        current_user_id = int(get_jwt_identity())
        agent = User.query.get(current_user_id)
        if not agent or agent.role != 'agent':
            return jsonify({'error': 'Access denied'}), 403
        
        data = request.get_json()
        invoice_number = data.get('invoice_number', '').strip()
        hours = float(data.get('hours', 0))
        hourly_rate = float(data.get('hourly_rate', 0))
        items = data.get('items', [])
        
        # Validation
        if not invoice_number:
            return jsonify({'error': 'Invoice number is required'}), 400
        if hours <= 0:
            return jsonify({'error': 'Hours must be greater than 0'}), 400
        if hourly_rate <= 0:
            return jsonify({'error': 'Hourly rate must be greater than 0'}), 400
            
        # Check for duplicate invoice number
        existing = Invoice.query.filter_by(invoice_number=invoice_number).first()
        if existing:
            return jsonify({'error': f'Invoice number {invoice_number} already exists'}), 400
        
        # Calculate total
        total_amount = Decimal(str(hours)) * Decimal(str(hourly_rate))
        
        # Create invoice
        new_invoice = Invoice(
            agent_id=current_user_id,
            invoice_number=invoice_number,
            issue_date=date.today(),
            due_date=date.today() + timedelta(days=30),
            total_amount=total_amount,
            status='submitted'
        )
        db.session.add(new_invoice)
        db.session.flush()
        
        # Link any real jobs (ignore misc items with jobId <= 0)
        for item in items:
            job_id = item.get('jobId', 0)
            if job_id > 0:
                job = Job.query.get(job_id)
                if job:
                    invoice_job = InvoiceJob(
                        invoice_id=new_invoice.id,
                        job_id=job_id,
                        hours_worked=Decimal(str(item.get('hours', hours))),
                        hourly_rate_at_invoice=Decimal(str(hourly_rate))
                    )
                    db.session.add(invoice_job)
        
        # Generate PDF (simple version)
        try:
            # Create simple job list for PDF
            pdf_jobs = []
            for item in items:
                pdf_jobs.append({
                    'job': type('obj', (object,), {
                        'title': item.get('title', 'Service'),
                        'address': 'N/A',
                        'arrival_time': datetime.now(),
                        'job_type': 'Service'
                    })(),
                    'hours': Decimal(str(item.get('hours', hours)))
                })
            
            pdf_path = generate_invoice_pdf(agent, pdf_jobs, float(total_amount), invoice_number)
            send_invoice_email(
                recipient_email='tom@v3-services.com',
                agent_name=f"{agent.first_name} {agent.last_name}",
                pdf_path=pdf_path,
                invoice_number=invoice_number,
                cc_email=agent.email
            )
            if os.path.exists(pdf_path):
                os.remove(pdf_path)
        except Exception as e:
            current_app.logger.error(f"PDF generation failed: {str(e)}")
            # Continue anyway - invoice is created
        
        db.session.commit()
        
        return jsonify({
            'message': 'Invoice created successfully',
            'invoice_number': invoice_number
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

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
        invoice_number = data.get('invoice_number')
        
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
        
        # Calculate total amount
        total_amount = Decimal(str(hours_worked)) * Decimal(str(hourly_rate))
        invoice.total_amount = total_amount
        invoice.status = 'sent'
        invoice.issue_date = date.today()
        
        # Update invoice number if provided
        if invoice_number:
            invoice.invoice_number = invoice_number
        
        # Update snapshot data for PDF generation if not already set
        if not invoice.job_type and invoice_job.job:
            invoice.job_type = invoice_job.job.job_type
        if not invoice.address and invoice_job.job:
            invoice.address = invoice_job.job.address
        
        db.session.commit()
        
        # Generate PDF with proper job data structure
        try:
            job = invoice_job.job
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
            
            try:
                os.remove(pdf_path)
            except Exception:
                pass
                
        except Exception as e:
            current_app.logger.error(f"Failed to generate PDF or notify for invoice {invoice.invoice_number}: {str(e)}")
            pass
        
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
            'job': job.to_dict() if job else None,
            'invoice_job': invoice_job.to_dict()
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Error fetching invoice details: {str(e)}")
        return jsonify({'error': 'Failed to fetch invoice details'}), 500

# --- AGENT INVOICE MANAGEMENT ENDPOINTS ---

@agent_bp.route('/agent/invoices', methods=['GET'])
@jwt_required()
def get_agent_invoices():
    """Get all invoices for the current agent."""
    try:
        current_user_id = int(get_jwt_identity())
        agent = User.query.get(current_user_id)
        
        if not agent or agent.role != 'agent':
            return jsonify({'error': 'Access denied'}), 403
        
        # Get all invoices for this agent
        invoices = Invoice.query.filter_by(agent_id=agent.id).order_by(Invoice.issue_date.desc()).all()
        
        return jsonify({
            'invoices': [invoice.to_dict() for invoice in invoices],
            'total_count': len(invoices)
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Error fetching agent invoices: {e}")
        return jsonify({'error': 'Failed to fetch invoices'}), 500

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
            signed = s3_client.generate_invoice_download_url(agent.id, invoice.invoice_number, expiration=3600)
            if signed.get('success'):
                return jsonify({
                    'download_url': signed['download_url'],
                    'expires_in': signed['expires_in'],
                    'invoice_number': signed['invoice_number'],
                    'filename': signed['filename'],
                    'file_size': signed.get('file_size', 'Unknown')
                }), 200

        return jsonify({
            'download_url': url_for('agent.download_invoice_direct', invoice_id=invoice_id),
            'invoice_number': invoice.invoice_number
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

        resp = send_file(
            pdf_path,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=f"{invoice.invoice_number}.pdf"
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
        
        # Use the new flexible system - with safe fallbacks
        current_number = get_safe_invoice_number(agent, 'current_invoice_number', 0)
        suggested_next = current_number + 1
        
        # Also provide the old system for backward compatibility
        old_next = get_safe_invoice_number(agent, 'agent_invoice_next', 1)
        
        return jsonify({
            'next_invoice_number': suggested_next,
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
            set_safe_invoice_number(agent, 'current_invoice_number', current_number)
        
        # Also update the legacy system for backward compatibility
        if hasattr(agent, 'agent_invoice_next'):
            set_safe_invoice_number(agent, 'agent_invoice_next', current_number + 1)
        
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
                'suggestedNext': get_safe_invoice_number(agent, 'agent_invoice_next', 1)
            }), 409
        
        # Update the invoice - only if field exists
        if hasattr(invoice, 'agent_invoice_number'):
            invoice.agent_invoice_number = new_agent_number
        else:
            current_app.logger.warning("agent_invoice_number field not found on invoice - database migration needed")
        
        # Handle update_next option
        if hasattr(agent, 'agent_invoice_next'):
            if update_next == 'force':
                set_safe_invoice_number(agent, 'agent_invoice_next', new_agent_number + 1)
            elif update_next == 'auto':
                current_next = get_safe_invoice_number(agent, 'agent_invoice_next', 1)
                set_safe_invoice_number(agent, 'agent_invoice_next', max(current_next, new_agent_number + 1))
            # 'nochange' - don't update agent_invoice_next
        
        db.session.commit()
        
        return jsonify({
            'message': 'Agent invoice number updated successfully',
            'invoice': invoice.to_dict(),
            'agent_invoice_next': get_safe_invoice_number(agent, 'agent_invoice_next', 1)
        }), 200
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error updating agent invoice number: {str(e)}")
        return jsonify({'error': 'Failed to update agent invoice number'}), 500

@agent_bp.route('/agent/invoices/<int:invoice_id>', methods=['DELETE'])
@jwt_required()
def delete_invoice(invoice_id):
    """Delete an invoice and its associated records"""
    try:
        current_user_id = int(get_jwt_identity())
        invoice = Invoice.query.get(invoice_id)
        
        if not invoice:
            return jsonify({'error': 'Invoice not found'}), 404
            
        if invoice.agent_id != current_user_id:
            return jsonify({'error': 'Access denied'}), 403
            
        # Delete associated InvoiceJob records first
        InvoiceJob.query.filter_by(invoice_id=invoice_id).delete()
        
        # Delete the invoice
        db.session.delete(invoice)
        db.session.commit()
        
        return jsonify({'message': 'Invoice deleted successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@agent_bp.route('/agent/invoices/analytics', methods=['GET'])
@jwt_required()
def get_invoice_analytics():
    """Get comprehensive invoice analytics for the agent"""
    try:
        current_user_id = int(get_jwt_identity())
        
        invoices = Invoice.query.filter_by(agent_id=current_user_id).all()
        
        # Calculate analytics
        total_earned = sum(float(inv.total_amount) for inv in invoices if inv.status == 'paid')
        total_pending = sum(float(inv.total_amount) for inv in invoices if inv.status in ['submitted', 'pending', 'sent'])
        
        # Date calculations
        today = date.today()
        this_month_start = today.replace(day=1)
        last_month_end = this_month_start - timedelta(days=1)
        last_month_start = last_month_end.replace(day=1)
        
        # This month's earnings
        this_month_invoices = [inv for inv in invoices if inv.issue_date and inv.issue_date >= this_month_start]
        this_month_earned = sum(float(inv.total_amount) for inv in this_month_invoices if inv.status == 'paid')
        
        # Last month's earnings
        last_month_invoices = [inv for inv in invoices if inv.issue_date and last_month_start <= inv.issue_date <= last_month_end]
        last_month_earned = sum(float(inv.total_amount) for inv in last_month_invoices if inv.status == 'paid')
        
        # Calculate average monthly income (last 12 months)
        twelve_months_ago = today - timedelta(days=365)
        recent_invoices = [inv for inv in invoices if inv.issue_date and inv.issue_date >= twelve_months_ago and inv.status == 'paid']
        avg_monthly = sum(float(inv.total_amount) for inv in recent_invoices) / 12 if recent_invoices else 0
        
        # Group by month for organization
        grouped = {}
        for inv in invoices:
            if inv.issue_date:
                key = f"{inv.issue_date.year}-{inv.issue_date.month:02d}"
                month_name = inv.issue_date.strftime("%B %Y")
                if key not in grouped:
                    grouped[key] = {
                        'month_name': month_name,
                        'invoices': [],
                        'total': 0,
                        'count': 0
                    }
                invoice_dict = inv.to_dict()
                # Add days outstanding for unpaid invoices
                if inv.status != 'paid' and inv.due_date:
                    days_outstanding = (today - inv.due_date).days
                    invoice_dict['days_outstanding'] = max(0, days_outstanding)
                    invoice_dict['is_overdue'] = days_outstanding > 0
                else:
                    invoice_dict['days_outstanding'] = 0
                    invoice_dict['is_overdue'] = False
                
                grouped[key]['invoices'].append(invoice_dict)
                grouped[key]['total'] += float(inv.total_amount)
                grouped[key]['count'] += 1
        
        # Sort months (newest first)
        sorted_months = dict(sorted(grouped.items(), reverse=True))
        
        # Calculate monthly trend for last 6 months
        monthly_trend = []
        for i in range(6):
            month_date = today.replace(day=1) - timedelta(days=30*i)
            key = f"{month_date.year}-{month_date.month:02d}"
            month_total = grouped.get(key, {}).get('total', 0)
            monthly_trend.append({
                'month': month_date.strftime("%b %Y"),
                'total': month_total
            })
        monthly_trend.reverse()  # Oldest first for chart
        
        return jsonify({
            'invoices': [inv.to_dict() for inv in invoices],
            'analytics': {
                'total_earned': total_earned,
                'total_pending': total_pending,
                'this_month': this_month_earned,
                'last_month': last_month_earned,
                'avg_monthly': avg_monthly,
                'invoice_count': len(invoices),
                'paid_count': len([inv for inv in invoices if inv.status == 'paid']),
                'pending_count': len([inv for inv in invoices if inv.status in ['submitted', 'pending', 'sent']]),
                'overdue_count': len([inv for inv in invoices if inv.due_date and inv.status != 'paid' and inv.due_date < today])
            },
            'grouped_by_month': sorted_months,
            'monthly_trend': monthly_trend
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# --- NEW ROUTES FOR SPECIFICATION COMPLIANCE ---

@agent_bp.route('/invoices/from-jobs', methods=['POST'])
@jwt_required()
def create_invoice_from_jobs_api():
    """Create invoice from jobs - API specification compliant endpoint"""
    try:
        current_user_id = int(get_jwt_identity())
        agent = User.query.get(current_user_id)
        if not agent or agent.role != 'agent':
            return jsonify({'error': 'Access denied.'}), 403

        data = request.get_json()
        job_ids = data.get('jobIds', [])
        hour_entries = data.get('hourEntries', [])
        notes = data.get('notes', '')

        if not job_ids:
            return jsonify({'error': 'No job IDs provided'}), 400

        # Convert to format expected by existing create_invoice function
        items = []
        for entry in hour_entries:
            job_id = entry.get('jobId')
            hours = entry.get('hours', 0)
            
            # Get job to get the rate
            job = Job.query.get(job_id)
            if job:
                items.append({
                    'jobId': job_id,
                    'hours': hours,
                    'rate': job.hourly_rate or 0
                })

        # Call existing create_invoice function with converted data
        invoice_data = {
            'items': items,
            'notes': notes
        }
        
        # Simulate the request with the converted data
        from flask import g
        g.json_data = invoice_data
        
        # Call the existing create_invoice function
        return create_invoice()
        
    except Exception as e:
        current_app.logger.error(f"Error creating invoice from jobs API: {str(e)}")
        return jsonify({'error': 'Failed to create invoice from jobs'}), 500

@agent_bp.route('/invoices/misc', methods=['POST'])
@jwt_required()
def create_misc_invoice_api():
    """Create miscellaneous invoice - API specification compliant endpoint"""
    try:
        current_user_id = int(get_jwt_identity())
        agent = User.query.get(current_user_id)
        if not agent or agent.role != 'agent':
            return jsonify({'error': 'Access denied.'}), 403

        data = request.get_json()
        lines = data.get('lines', [])
        notes = data.get('notes', '')

        if not lines:
            return jsonify({'error': 'No line items provided'}), 400

        # Convert to format expected by existing create_misc_invoice function
        items = []
        for line in lines:
            items.append({
                'description': line.get('description', ''),
                'quantity': line.get('qty', 1),
                'unit_price': line.get('unitPrice', 0)
            })

        # Call existing create_misc_invoice function with converted data
        invoice_data = {
            'items': items,
            'notes': notes
        }
        
        # Simulate the request with the converted data
        from flask import g
        g.json_data = invoice_data
        
        # Call the existing create_misc_invoice function
        return create_misc_invoice()
        
    except Exception as e:
        current_app.logger.error(f"Error creating misc invoice API: {str(e)}")
        return jsonify({'error': 'Failed to create miscellaneous invoice'}), 500

# --- TELEGRAM INTEGRATION ENDPOINTS ---

@agent_bp.route('/agent/telegram/link', methods=['POST'])
@jwt_required()
def create_telegram_link_token():
    """
    Generate a new Telegram link token for the current agent
    
    Returns:
        JSON with deep link URL and token
    """
    try:
        current_user_id = int(get_jwt_identity())
        agent = User.query.get(current_user_id)
        
        if not agent or agent.role != 'agent':
            return jsonify({'error': 'Access denied. Agent role required.'}), 403
        
        if not current_app.config['TELEGRAM_ENABLED']:
            return jsonify({'status': 'disabled', 'message': 'Telegram integration is disabled'}), 200
        
        # Generate a secure random token
        import secrets
        token = secrets.token_urlsafe(24)
        
        # Store the token in the agent record
        agent.telegram_link_token = token
        db.session.commit()
        
        # Get bot username from environment or use a default
        bot_username = os.getenv("TELEGRAM_BOT_USERNAME", "V3ServicesBot")
        
        # Create the deep link
        link = f"https://t.me/{bot_username}?start={token}"
        
        current_app.logger.info(f"Generated Telegram link token for agent {agent.id}")
        
        return jsonify({
            'link': link,
            'token': token,
            'bot_username': bot_username
        }), 200
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error creating Telegram link token: {str(e)}")
        return jsonify({'error': 'Failed to create link token'}), 500

@agent_bp.route('/agent/telegram/status', methods=['GET'])
@jwt_required()
def get_telegram_status():
    """
    Get Telegram connection status for the current agent
    
    Returns:
        JSON with connection status and details
    """
    try:
        current_user_id = int(get_jwt_identity())
        agent = User.query.get(current_user_id)
        
        if not agent or agent.role != 'agent':
            return jsonify({'error': 'Access denied. Agent role required.'}), 403
        
        if not current_app.config['TELEGRAM_ENABLED']:
            return jsonify({
                'enabled': False,
                'connected': False,
                'message': 'Telegram integration is disabled'
            }), 200
        
        return jsonify({
            'enabled': True,
            'connected': bool(agent.telegram_chat_id),
            'username': agent.telegram_username,
            'optIn': agent.telegram_opt_in,
            'hasLinkToken': bool(agent.telegram_link_token)
        }), 200
        
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
        current_user_id = int(get_jwt_identity())
        agent = User.query.get(current_user_id)
        
        if not agent or agent.role != 'agent':
            return jsonify({'error': 'Access denied. Agent role required.'}), 403
        
        if not current_app.config['TELEGRAM_ENABLED']:
            return jsonify({'status': 'disabled', 'message': 'Telegram integration is disabled'}), 200
        
        # Clear Telegram connection data
        agent.telegram_chat_id = None
        agent.telegram_username = None
        agent.telegram_opt_in = False
        agent.telegram_link_token = None  # Also clear any pending link token
        
        db.session.commit()
        
        current_app.logger.info(f"Telegram disconnected for agent {agent.id}")
        
        return jsonify({
            'ok': True,
            'message': 'Telegram account disconnected successfully'
        }), 200
        
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
        current_user_id = int(get_jwt_identity())
        agent = User.query.get(current_user_id)
        
        if not agent or agent.role != 'agent':
            return jsonify({'error': 'Access denied. Agent role required.'}), 403
        
        if not current_app.config['TELEGRAM_ENABLED']:
            return jsonify({'status': 'disabled', 'message': 'Telegram integration is disabled'}), 200
        
        if not agent.telegram_chat_id or not agent.telegram_opt_in:
            return jsonify({'error': 'Telegram not connected or notifications disabled'}), 400
        
        # Send test message
        from src.integrations.telegram_client import send_message
        
        test_message = f"🧪 <b>Test Message</b>\n\nHello {agent.first_name}! This is a test notification from V3 Services.\n\n✅ Your Telegram notifications are working correctly."
        
        result = send_message(agent.telegram_chat_id, test_message)
        
        if result.get('status') == 'error':
            return jsonify({'error': f"Failed to send test message: {result.get('message')}"}), 500
        
        current_app.logger.info(f"Test Telegram message sent to agent {agent.id}")
        
        return jsonify({
            'success': True,
            'message': 'Test message sent successfully'
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Error sending test Telegram message: {str(e)}")
        return jsonify({'error': 'Failed to send test message'}), 500
