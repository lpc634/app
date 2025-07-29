# --- IMPORTS (Added boto3) ---
import os
import smtplib
import boto3
from botocore.client import Config
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
from email.utils import formataddr
from flask import Blueprint, jsonify, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from src.models.user import User, Job, JobAssignment, AgentAvailability, Notification, Invoice, InvoiceJob, db
from src.utils.s3_client import s3_client
from datetime import datetime, date, time, timedelta
from decimal import Decimal
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

def generate_invoice_pdf(agent, jobs_data, total_amount, invoice_number, upload_to_s3=True):
    """Generates a PDF invoice and uploads to S3 for in-app access."""
    # This function generates the PDF locally first, then uploads to S3
    invoice_folder = os.path.join('/tmp', 'invoices') # Use the /tmp directory
    os.makedirs(invoice_folder, exist_ok=True)
    file_path = os.path.join(invoice_folder, f"{invoice_number}.pdf")
    
    c = canvas.Canvas(file_path, pagesize=letter)
    width, height = letter

    # --- Header ---
    c.setFont("Helvetica-Bold", 16)
    c.drawString(inch, height - inch, "V3 Services Ltd.")
    c.setFont("Helvetica", 12)
    c.drawString(inch, height - inch - 20, "123 Innovation Drive, Tech Park, London, EC1V 2NX")
    
    c.setFont("Helvetica-Bold", 20)
    c.drawRightString(width - inch, height - inch, "INVOICE")

    # --- Agent and Invoice Details ---
    y_pos = height - 2 * inch
    c.setFont("Helvetica-Bold", 12)
    c.drawString(inch, y_pos, "Bill To:")
    c.setFont("Helvetica", 12)
    c.drawString(inch, y_pos - 20, f"{agent.first_name} {agent.last_name}")
    c.drawString(inch, y_pos - 35, agent.address_line_1)
    if agent.address_line_2:
        c.drawString(inch, y_pos - 50, agent.address_line_2)
    c.drawString(inch, y_pos - 65, f"{agent.city}, {agent.postcode}")

    c.setFont("Helvetica-Bold", 12)
    c.drawRightString(width - inch, y_pos, f"Invoice #: {invoice_number}")
    c.setFont("Helvetica", 12)
    c.drawRightString(width - inch, y_pos - 15, f"Date: {date.today().strftime('%d/%m/%Y')}")
    c.drawRightString(width - inch, y_pos - 30, f"Due: {(date.today() + timedelta(days=30)).strftime('%d/%m/%Y')}")


    # --- Table Header ---
    y_pos -= 100
    c.setFont("Helvetica-Bold", 11)
    c.drawString(inch, y_pos, "Job Date")
    c.drawString(inch * 2.5, y_pos, "Job Description")
    c.drawString(inch * 5.5, y_pos, "Hours")
    c.drawString(inch * 6.5, y_pos, "Rate")
    c.drawRightString(width - inch, y_pos, "Amount")
    c.line(inch, y_pos - 10, width - inch, y_pos - 10)

    # --- Table Rows ---
    y_pos -= 30
    c.setFont("Helvetica", 10)
    for job_item in jobs_data:
        job = job_item['job']
        hours = job_item['hours']
        rate = Decimal(job.hourly_rate)
        amount = Decimal(str(hours)) * rate
        
        c.drawString(inch, y_pos, job.arrival_time.strftime('%d/%m/%Y'))
        c.drawString(inch * 2.5, y_pos, job.title)
        c.drawString(inch * 5.5, y_pos, str(hours))
        c.drawString(inch * 6.5, y_pos, f"£{rate:.2f}")
        c.drawRightString(width - inch, y_pos, f"£{amount:.2f}")
        y_pos -= 20

    # --- Total ---
    y_pos -= 20
    c.line(inch * 5, y_pos, width - inch, y_pos)
    c.setFont("Helvetica-Bold", 12)
    c.drawRightString(width - inch - 80, y_pos + 10, "Total:")
    c.drawRightString(width - inch, y_pos + 10, f"£{total_amount:.2f}")

    # --- Footer ---
    c.setFont("Helvetica-Oblique", 9)
    c.drawString(inch, inch, "Thank you for your service. Please direct any questions to accounts@v3-services.com.")
    
    c.save()
    
    # Always upload to S3 for in-app access
    if upload_to_s3:
        try:
            # Upload PDF to S3 with proper organization: /invoices/{agent_id}/{invoice_number}.pdf
            upload_result = s3_client.upload_invoice_pdf(
                agent_id=agent.id,
                invoice_number=invoice_number,
                pdf_data=file_path,  # Pass file path directly
                filename=f"{invoice_number}.pdf"
            )
            
            if upload_result.get('success'):
                current_app.logger.info(f"Invoice PDF {invoice_number} uploaded to S3 successfully: {upload_result.get('file_key')}")
                # Clean up local file after successful upload
                try:
                    os.remove(file_path)
                except:
                    pass
                return file_path, upload_result.get('file_key')
            else:
                current_app.logger.error(f"Failed to upload invoice PDF to S3: {upload_result.get('error')}")
                return file_path  # Return local path as fallback
        except Exception as e:
            current_app.logger.error(f"Error uploading invoice PDF to S3: {str(e)}")
            return file_path  # Return local path as fallback
    
    return file_path

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
                return jsonify({'error': f"Invalid hours for job {job.title}."}), 400

            total_amount += hours * Decimal(job.hourly_rate)
            jobs_to_invoice.append({'job': job, 'hours': hours})

        # --- Database Transaction ---
        
        # 1. Create the new invoice record
        issue_date = date.today()
        last_invoice = Invoice.query.order_by(Invoice.id.desc()).first()
        new_invoice_id = (last_invoice.id + 1) if last_invoice else 1
        invoice_number = f"V3-{issue_date.year}-{new_invoice_id:04d}"

        new_invoice = Invoice(
            agent_id=current_user_id,
            invoice_number=invoice_number,
            issue_date=issue_date,
            due_date=issue_date + timedelta(days=30),
            total_amount=total_amount,
            status='submitted'
        )
        db.session.add(new_invoice)
        db.session.flush()

        # 2. Link the jobs to the new invoice
        for item in jobs_to_invoice:
            invoice_job_link = InvoiceJob(
                invoice_id=new_invoice.id,
                job_id=item['job'].id,
                hours_worked=item['hours']
            )
            db.session.add(invoice_job_link)
            
        # --- PDF and Emailing ---
        pdf_result = generate_invoice_pdf(agent, jobs_to_invoice, total_amount, invoice_number, upload_to_s3=True)
        
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
        
        # Generate PDF and send email
        try:
            # Get job details for the invoice
            job = invoice_job.job
            jobs_data = [{
                'job_id': job.id,
                'title': job.title,
                'address': job.address,
                'arrival_time': job.arrival_time,
                'hours_worked': float(hours_worked),
                'hourly_rate': float(hourly_rate),
                'subtotal': float(total_amount)
            }]
            
            # Generate PDF and upload to S3
            pdf_result = generate_invoice_pdf(user, jobs_data, float(total_amount), invoice.invoice_number, upload_to_s3=True)
            
            # Handle different return formats
            if isinstance(pdf_result, tuple):
                pdf_path, s3_file_key = pdf_result
                # Update invoice with S3 file key
                # Temporarily disabled - pdf_file_url field doesn't exist in database yet
                # invoice.pdf_file_url = s3_file_key
                db.session.commit()  # Save the S3 file key
            else:
                pdf_path = pdf_result
            
            # Send in-app notification to agent instead of email
            notification = Notification(
                user_id=user.id,
                title=f"Invoice {invoice.invoice_number} Updated",
                message=f"Your invoice {invoice.invoice_number} has been updated and is ready for download.",
                type="invoice_updated"
            )
            db.session.add(notification)
            
            # Clean up the temporary PDF file
            try:
                os.remove(pdf_path)
            except:
                pass  # Don't fail if cleanup fails
                
        except Exception as e:
            current_app.logger.error(f"Failed to generate PDF or send email for invoice {invoice.invoice_number}: {str(e)}")
            # Don't fail the invoice update if PDF/email fails
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
    try:
        current_user_id = int(get_jwt_identity())
        agent = User.query.get(current_user_id)
        
        if not agent or agent.role != 'agent':
            return jsonify({'error': 'Access denied'}), 403
        
        # Get the invoice and verify ownership
        invoice = Invoice.query.filter_by(id=invoice_id, agent_id=agent.id).first()
        if not invoice:
            return jsonify({'error': 'Invoice not found'}), 404
        
        # Check if invoice is ready for download (not draft)
        if invoice.status == 'draft':
            return jsonify({'error': 'Cannot download draft invoices. Please complete the invoice first.'}), 400
        
        # Try to find PDF in S3 first, generate if not found
        try:
            # First try to get existing PDF from S3
            s3_file_key = f"invoices/{agent.id}/{invoice.invoice_number}.pdf"
            download_result = s3_client.get_secure_document_url(
                s3_file_key,
                expiration=3600  # 1 hour
            )
            
            if download_result['success']:
                current_app.logger.info(f"Agent {agent.email} downloaded existing invoice {invoice.invoice_number}")
                return jsonify({
                    'download_url': download_result['url'],
                    'expires_in': download_result['expires_in'],
                    'invoice_number': invoice.invoice_number,
                    'filename': f"{invoice.invoice_number}.pdf"
                }), 200
            
            # PDF doesn't exist in S3, generate it on-demand
            current_app.logger.info(f"PDF not found in S3, generating on-demand for invoice {invoice.invoice_number}")
            
            # Get invoice jobs for PDF generation
            invoice_jobs = InvoiceJob.query.filter_by(invoice_id=invoice.id).all()
            jobs_data = []
            for invoice_job in invoice_jobs:
                if invoice_job.job:
                    jobs_data.append({
                        'job': invoice_job.job,
                        'hours': float(invoice_job.hours_worked or 0),
                        'rate': float(invoice_job.hourly_rate_at_invoice or 0)
                    })
            
            # Generate PDF and upload to S3
            pdf_result = generate_invoice_pdf(
                agent, 
                jobs_data, 
                float(invoice.total_amount), 
                invoice.invoice_number, 
                upload_to_s3=True
            )
            
            if isinstance(pdf_result, tuple):
                pdf_path, s3_file_key = pdf_result
                # Generate download URL for the newly created PDF
                download_result = s3_client.get_secure_document_url(
                    s3_file_key,
                    expiration=3600
                )
                
                if download_result['success']:
                    current_app.logger.info(f"Agent {agent.email} downloaded newly generated invoice {invoice.invoice_number}")
                    return jsonify({
                        'download_url': download_result['url'],
                        'expires_in': download_result['expires_in'],
                        'invoice_number': invoice.invoice_number,
                        'filename': f"{invoice.invoice_number}.pdf"
                    }), 200
                else:
                    return jsonify({'error': 'Failed to generate download URL'}), 500
            else:
                return jsonify({'error': 'Failed to generate PDF'}), 500
                
        except Exception as e:
            current_app.logger.error(f"Error generating invoice download for {invoice.invoice_number}: {str(e)}")
            return jsonify({'error': 'Failed to generate invoice download'}), 500
        
    except Exception as e:
        current_app.logger.error(f"Error generating invoice download: {e}")
        return jsonify({'error': 'Failed to generate download link'}), 500