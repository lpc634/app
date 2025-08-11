# --- IMPORTS (Added boto3) ---
import os
import smtplib
import boto3
from botocore.client import Config
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
from email.utils import formataddr
from flask import Blueprint, jsonify, request, current_app, redirect
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

        # Resolve invoice from DB (for fallbacks)
        invoice = Invoice.query.options(joinedload(Invoice.jobs)).filter_by(invoice_number=invoice_number).first()
        # In some schemas, Invoice.jobs relationship is named differently; that's fine if None.

        # Helper: safe float
        def _f(x, default=0.0):
            try:
                return float(x)
            except Exception:
                try:
                    return float(Decimal(str(x)))
                except Exception:
                    return default

        # Build a map of first linked job (for fallback address/date)
        first_invoice_job = None
        first_job = None
        try:
            if invoice:
                first_invoice_job = InvoiceJob.query.filter_by(invoice_id=invoice.id).first()
                if first_invoice_job:
                    first_job = first_invoice_job.job
        except Exception:
            first_job = None

        normalized_jobs = []
        for item in (jobs_data or []):
            if not isinstance(item, dict):
                continue

            job_obj = item.get('job')
            # numbers
            hours = _f(item.get('hours', item.get('hours_worked', 0)))
            rate = _f(item.get('rate', item.get('hourly_rate', getattr(job_obj, 'hourly_rate', 0) if job_obj else 0)))
            amount = _f(item.get('amount', hours * rate))

            # date + address
            when = item.get('date', item.get('arrival_time'))
            addr = item.get('address')

            if job_obj is not None:
                when = when or getattr(job_obj, 'arrival_time', None)
                addr = addr or getattr(job_obj, 'address', None)

            # fallbacks from DB invoice/job if still missing
            if not addr and first_job is not None:
                addr = getattr(first_job, 'address', None)
            if not when and invoice is not None:
                when = getattr(invoice, 'issue_date', None) or getattr(invoice, 'created_at', None)

            normalized_jobs.append({
                'date': when,
                'address': addr or '',
                'hours': hours,
                'rate': rate,
                'amount': amount,
            })

        # If nothing made it through (e.g., update flows with odd payloads), synthesize one row
        if not normalized_jobs:
            current_app.logger.info("PDF: jobs_data empty after normalization, synthesizing from DB")
            hours = _f(getattr(first_invoice_job, 'hours_worked', getattr(invoice, 'hours_worked', 0)))
            rate = _f(getattr(first_invoice_job, 'hourly_rate_at_invoice',
                              getattr(first_job, 'hourly_rate', getattr(invoice, 'hourly_rate', 0))))
            amount = _f(hours * rate)
            when = getattr(invoice, 'issue_date', None) or getattr(invoice, 'created_at', None)
            addr = getattr(first_job, 'address', None) if first_job else getattr(invoice, 'address', '')
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
            jobs_rows=normalized_jobs,
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
        return jsonify({"error": "Failed to generate invoice PDF"}), 500


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
        
        return jsonify([job.to_dict() for job in invoiceable_jobs]), 200

    except Exception as e:
        return jsonify({"error": "An internal error occurred", "details": str(e)}), 500

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
        # Accept both agent_invoice_number and invoice_number (alias)
        agent_invoice_number = data.get('agent_invoice_number') or data.get('invoice_number')

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

            total_amount += hours * Decimal(job.hourly_rate)
            jobs_to_invoice.append({'job': job, 'hours': hours})

        # --- Agent Invoice Number Handling ---
        final_agent_invoice_number = None
        
        if agent_invoice_number is not None:
            # Validate the provided agent invoice number
            try:
                agent_invoice_number = int(agent_invoice_number)
                if agent_invoice_number <= 0:
                    return jsonify({'error': 'Agent invoice number must be greater than 0'}), 400
                if agent_invoice_number > 999999999:  # Max 9 digits
                    return jsonify({'error': 'Agent invoice number cannot exceed 9 digits'}), 400
            except (ValueError, TypeError):
                return jsonify({'error': 'Agent invoice number must be a valid integer'}), 400
            
            # Check for uniqueness (per agent) - only if field exists
            existing = None
            if hasattr(Invoice, 'agent_invoice_number'):
                existing = Invoice.query.filter_by(agent_id=current_user_id, agent_invoice_number=agent_invoice_number).first()
            if existing:
                return jsonify({
                    'message': 'Duplicate agent invoice number',
                    'suggestedNext': getattr(agent, 'agent_invoice_next', None) or 1
                }), 409
            
            final_agent_invoice_number = agent_invoice_number
        else:
            # Use the agent's next number
            final_agent_invoice_number = getattr(agent, 'agent_invoice_next', None) or 1

        # --- Database Transaction ---
        
        # 1. Create the new invoice record
        issue_date = date.today()
        last_invoice = Invoice.query.order_by(Invoice.id.desc()).first()
        new_invoice_id = (last_invoice.id + 1) if last_invoice else 1
        invoice_number = f"V3-{issue_date.year}-{new_invoice_id:04d}"

        # Create invoice - only set agent_invoice_number if field exists
        invoice_kwargs = {
            'agent_id': current_user_id,
            'invoice_number': invoice_number,
            'issue_date': issue_date,
            'due_date': issue_date + timedelta(days=30),
            'total_amount': total_amount,
            'status': 'submitted'
        }
        
        # Only add agent_invoice_number if the field exists in the model
        if hasattr(Invoice, 'agent_invoice_number'):
            invoice_kwargs['agent_invoice_number'] = final_agent_invoice_number
        
        new_invoice = Invoice(**invoice_kwargs)
        db.session.add(new_invoice)
        db.session.flush()

        # Update agent's next invoice number
        current_next = getattr(agent, 'agent_invoice_next', None) or 1
        if hasattr(agent, 'agent_invoice_next'):
            agent.agent_invoice_next = max(current_next, final_agent_invoice_number + 1)

        # 2. Link the jobs to the new invoice
        for item in jobs_to_invoice:
            invoice_job_link = InvoiceJob(
                invoice_id=new_invoice.id,
                job_id=item['job'].id,
                hours_worked=item['hours']
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
        
        db.session.commit()
        
        # Generate PDF (no title usage; we rely on job/address/date)
        try:
            job = invoice_job.job
            jobs_data = [{
                'job': job,
                'hours': float(hours_worked),
                'rate': float(hourly_rate)
            }]
            
            pdf_result = generate_invoice_pdf(
                user,
                jobs_data,
                float(total_amount),
                invoice.invoice_number,
                upload_to_s3=True,
                agent_invoice_number=invoice.agent_invoice_number
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
    """Generate download URL for agent's invoice."""
    import traceback
    
    try:
        current_app.logger.info(f"STEP 1: Starting invoice download for ID {invoice_id}")
        
        # Step 1: Verify user permissions
        current_app.logger.info("STEP 2: Verifying user permissions")
        current_user_id = int(get_jwt_identity())
        agent = User.query.get(current_user_id)
        
        if not agent:
            current_app.logger.error(f"STEP 2 FAILED: User not found for ID {current_user_id}")
            return jsonify({'error': 'User not found'}), 404
            
        if agent.role != 'agent':
            current_app.logger.error(f"STEP 2 FAILED: Access denied - user role is {agent.role}, expected 'agent'")
            return jsonify({'error': 'Access denied'}), 403
        
        current_app.logger.info(f"STEP 2 SUCCESS: User verified - {agent.email} (ID: {agent.id})")
        
        # Step 2: Get the invoice and verify ownership
        current_app.logger.info("STEP 3: Fetching invoice data")
        invoice = Invoice.query.filter_by(id=invoice_id, agent_id=agent.id).first()
        
        if not invoice:
            current_app.logger.error(f"STEP 3 FAILED: Invoice {invoice_id} not found for agent {agent.id}")
            return jsonify({'error': 'Invoice not found'}), 404
        
        current_app.logger.info(f"STEP 3 SUCCESS: Invoice found - {invoice.invoice_number}, status: {invoice.status}, amount: {invoice.total_amount}")
        
        # Step 3: Check if invoice is ready for download
        current_app.logger.info("STEP 4: Checking invoice status")
        if invoice.status == 'draft':
            current_app.logger.error(f"STEP 4 FAILED: Invoice {invoice.invoice_number} is in draft status")
            return jsonify({'error': 'Cannot download draft invoices. Please complete the invoice first.'}), 400
        
        current_app.logger.info(f"STEP 4 SUCCESS: Invoice {invoice.invoice_number} is ready for download")
        
        # Step 4: Check S3 configuration
        current_app.logger.info("STEP 5: Checking S3 configuration")
        if not s3_client.is_configured():
            error_msg = s3_client.get_configuration_error()
            current_app.logger.error(f"STEP 5 FAILED: S3 not configured - {error_msg}")
            return jsonify({'error': 'File storage service unavailable', 'details': 'S3 not configured'}), 503
        
        current_app.logger.info("STEP 5 SUCCESS: S3 client is configured")
        
        # Step 5: Try to find existing PDF in S3 using the improved method
        current_app.logger.info("STEP 6: Checking for existing PDF in S3")
        
        download_result = s3_client.generate_invoice_download_url(
            agent.id,
            invoice.invoice_number,
            expiration=3600  # 1 hour
        )
        
        if download_result['success']:
            current_app.logger.info(f"STEP 6 SUCCESS: Found existing PDF in S3 for invoice {invoice.invoice_number}")
            current_app.logger.info(f"Agent {agent.email} downloaded existing invoice {invoice.invoice_number}")
            return jsonify({
                'download_url': download_result['download_url'],
                'expires_in': download_result['expires_in'],
                'invoice_number': download_result['invoice_number'],
                'filename': download_result['filename'],
                'file_size': download_result.get('file_size', 'Unknown')
            }), 200
        
        current_app.logger.info(f"STEP 6: PDF not found in S3 ({download_result.get('error', 'Unknown error')}), will generate on-demand")
        
        # Step 6: Generate PDF on-demand
        current_app.logger.info("STEP 7: Generating PDF on-demand")
        
        # Get invoice jobs for PDF generation
        current_app.logger.info("STEP 7.1: Fetching invoice jobs")
        invoice_jobs = InvoiceJob.query.filter_by(invoice_id=invoice.id).all()
        current_app.logger.info(f"STEP 7.1 SUCCESS: Found {len(invoice_jobs)} invoice jobs")
        
        jobs_data = []
        for i, invoice_job in enumerate(invoice_jobs):
            current_app.logger.info(f"STEP 7.2: Processing invoice job {i+1}/{len(invoice_jobs)} - ID: {invoice_job.id}")
            
            if not invoice_job.job:
                current_app.logger.error(f"STEP 7.2 ERROR: Invoice job {invoice_job.id} has no associated job")
                continue
            
            # Handle potential None values and convert to proper types
            hours_worked = invoice_job.hours_worked or 0
            hourly_rate = invoice_job.hourly_rate_at_invoice or invoice_job.job.hourly_rate or 0
            
            current_app.logger.info(f"STEP 7.2: Job details - hours: {hours_worked}, rate: {hourly_rate}")
            
            try:
                hours_float = float(hours_worked)
                rate_float = float(hourly_rate)
                current_app.logger.info(f"STEP 7.2 SUCCESS: Converted to float - hours: {hours_float}, rate: {rate_float}")
                
                jobs_data.append({
                    'job': invoice_job.job,
                    'hours': hours_float,
                    'rate': rate_float
                })
            except (ValueError, TypeError) as convert_error:
                current_app.logger.error(f"STEP 7.2 ERROR: Failed to convert data types - {str(convert_error)}")
                current_app.logger.error(f"STEP 7.2 ERROR: Original values - hours: {hours_worked} (type: {type(hours_worked)}), rate: {hourly_rate} (type: {type(hourly_rate)})")
                return jsonify({'error': 'Invalid invoice data - cannot convert amounts'}), 500
        
        if not jobs_data:
            current_app.logger.error("STEP 7.2 FAILED: No valid job data found for PDF generation")
            return jsonify({'error': 'No valid job data found for invoice'}), 500
        
        current_app.logger.info(f"STEP 7.2 SUCCESS: Prepared {len(jobs_data)} jobs for PDF generation")
        
        # Step 7: Generate PDF
        current_app.logger.info("STEP 8: Calling generate_invoice_pdf function")
        try:
            total_amount_float = float(invoice.total_amount)
            current_app.logger.info(f"STEP 8: Total amount converted to float: {total_amount_float}")
            
            pdf_result = generate_invoice_pdf(
                agent, 
                jobs_data, 
                total_amount_float, 
                invoice.invoice_number, 
                upload_to_s3=True,
                agent_invoice_number=invoice.agent_invoice_number
            )
            current_app.logger.info(f"STEP 8 SUCCESS: PDF generation completed, result type: {type(pdf_result)}")
            
        except Exception as pdf_error:
            current_app.logger.error(f"STEP 8 FAILED: PDF generation error - {str(pdf_error)}")
            current_app.logger.error(f"STEP 8 FAILED: PDF generation traceback: {traceback.format_exc()}")
            return jsonify({'error': 'Failed to generate PDF document'}), 500
        
        # Step 8: Process PDF result
        current_app.logger.info("STEP 9: Processing PDF generation result")
        if isinstance(pdf_result, tuple):
            pdf_path, s3_file_key = pdf_result
            current_app.logger.info(f"STEP 9: PDF uploaded to S3 with key: {s3_file_key}")
            
            # Generate download URL for the newly created PDF using the improved method
            current_app.logger.info("STEP 10: Generating download URL for new PDF")
            download_result = s3_client.generate_invoice_download_url(
                agent.id,
                invoice.invoice_number,
                expiration=3600
            )
            
            if download_result['success']:
                current_app.logger.info(f"STEP 10 SUCCESS: Download URL generated for invoice {invoice.invoice_number}")
                current_app.logger.info(f"Agent {agent.email} downloaded newly generated invoice {invoice.invoice_number}")
                return jsonify({
                    'download_url': download_result['download_url'],
                    'expires_in': download_result['expires_in'],
                    'invoice_number': download_result['invoice_number'],
                    'filename': download_result['filename'],
                    'file_size': download_result.get('file_size', 'Unknown')
                }), 200
            else:
                current_app.logger.error(f"STEP 10 FAILED: Failed to generate download URL - {download_result.get('error', 'Unknown error')}")
                return jsonify({'error': 'Failed to generate download URL', 'details': download_result.get('error')}), 500
        else:
            current_app.logger.error(f"STEP 9 FAILED: PDF generation returned unexpected result type: {type(pdf_result)}")
            current_app.logger.error(f"STEP 9 FAILED: PDF result value: {pdf_result}")
            return jsonify({'error': 'Failed to generate PDF - unexpected result format'}), 500
                
    except Exception as e:
        current_app.logger.error(f"DETAILED ERROR in invoice download {invoice_id}: {str(e)}")
        current_app.logger.error(f"Error type: {type(e).__name__}")
        current_app.logger.error(f"Full traceback: {traceback.format_exc()}")
        return jsonify({'error': 'Download failed - internal server error'}), 500

@agent_bp.route('/agent/invoices/<int:invoice_id>/download-direct', methods=['GET'])
@jwt_required()
def download_invoice_direct(invoice_id):
    """Direct download route that redirects to signed S3 URL for immediate download."""
    import traceback
    
    try:
        current_app.logger.info(f"DIRECT DOWNLOAD: Starting direct download for invoice {invoice_id}")
        
        # Step 1: Verify user permissions
        current_user_id = int(get_jwt_identity())
        agent = User.query.get(current_user_id)
        
        if not agent:
            current_app.logger.error(f"DIRECT DOWNLOAD FAILED: User not found for ID {current_user_id}")
            return jsonify({'error': 'User not found'}), 404
            
        if agent.role != 'agent':
            current_app.logger.error(f"DIRECT DOWNLOAD FAILED: Access denied - user role is {agent.role}")
            return jsonify({'error': 'Access denied'}), 403
        
        # Step 2: Get the invoice and verify ownership
        invoice = Invoice.query.filter_by(id=invoice_id, agent_id=agent.id).first()
        
        if not invoice:
            current_app.logger.error(f"DIRECT DOWNLOAD FAILED: Invoice {invoice_id} not found for agent {agent.id}")
            return jsonify({'error': 'Invoice not found'}), 404
        
        # Step 3: Check if invoice is ready for download
        if invoice.status == 'draft':
            current_app.logger.error(f"DIRECT DOWNLOAD FAILED: Invoice {invoice.invoice_number} is in draft status")
            return jsonify({'error': 'Cannot download draft invoices'}), 400
        
        # Step 4: Generate signed URL and redirect
        current_app.logger.info(f"DIRECT DOWNLOAD: Generating signed URL for invoice {invoice.invoice_number}")
        
        download_result = s3_client.generate_invoice_download_url(
            agent.id,
            invoice.invoice_number,
            expiration=300  # 5 minutes for direct download
        )
        
        if download_result['success']:
            current_app.logger.info(f"DIRECT DOWNLOAD SUCCESS: Redirecting to signed URL for invoice {invoice.invoice_number}")
            # Direct redirect to S3 signed URL for immediate download
            return redirect(download_result['download_url'])
        else:
            current_app.logger.error(f"DIRECT DOWNLOAD FAILED: Could not generate signed URL - {download_result.get('error')}")
            return jsonify({
                'error': 'Download temporarily unavailable', 
                'details': download_result.get('error', 'Could not generate download link')
            }), 503
            
    except Exception as e:
        current_app.logger.error(f"DIRECT DOWNLOAD FAILED: Unexpected error for invoice {invoice_id}: {str(e)}")
        current_app.logger.error(f"DIRECT DOWNLOAD FAILED: Traceback: {traceback.format_exc()}")
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
    """Get the suggested next invoice number for the current agent."""
    try:
        current_user_id = int(get_jwt_identity())
        agent = User.query.get(current_user_id)
        
        if not agent or agent.role != 'agent':
            return jsonify({'error': 'Access denied'}), 403
        
        return jsonify({
            'next': getattr(agent, 'agent_invoice_next', None) or 1
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Error fetching next invoice number: {str(e)}")
        return jsonify({'error': 'Failed to fetch next invoice number'}), 500

@agent_bp.route('/agent/numbering', methods=['PATCH'])
@jwt_required()
def update_agent_numbering():
    """Update the agent's default next invoice number."""
    try:
        current_user_id = int(get_jwt_identity())
        agent = User.query.get(current_user_id)
        
        if not agent or agent.role != 'agent':
            return jsonify({'error': 'Access denied'}), 403
        
        data = request.get_json()
        if not data or 'next' not in data:
            return jsonify({'error': 'Next number is required'}), 400
        
        next_number = data['next']
        
        # Validate integer > 0
        try:
            next_number = int(next_number)
            if next_number <= 0:
                return jsonify({'error': 'Next number must be greater than 0'}), 400
            if next_number > 999999999:  # Max 9 digits
                return jsonify({'error': 'Next number cannot exceed 9 digits'}), 400
        except (ValueError, TypeError):
            return jsonify({'error': 'Next number must be a valid integer'}), 400
        
        # Update agent's next number (safely handle if field doesn't exist yet)
        if hasattr(agent, 'agent_invoice_next'):
            agent.agent_invoice_next = next_number
        else:
            # Field doesn't exist yet - migration needed
            current_app.logger.warning("agent_invoice_next field not found - database migration needed")
        db.session.commit()
        
        return jsonify({
            'message': 'Next invoice number updated successfully',
            'next': next_number
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
