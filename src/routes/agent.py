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
from datetime import datetime, date, time, timedelta
from decimal import Decimal
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from werkzeug.utils import secure_filename

agent_bp = Blueprint('agent', __name__)

def allowed_file(filename):
    """Check if the file extension is allowed."""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in {'pdf', 'jpg', 'jpeg', 'png'}


# --- REPLACED FUNCTION: This now uploads to Amazon S3 ---
@agent_bp.route('/agent/upload-documents', methods=['POST'])
@jwt_required()
def upload_agent_documents():
    current_user_id = int(get_jwt_identity())
    user = User.query.get(current_user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    if 'id_document' not in request.files and 'sia_document' not in request.files:
        return jsonify({"error": "No file part in the request"}), 400

    # Get S3 config from Heroku environment variables
    S3_BUCKET = os.environ.get("S3_BUCKET")
    S3_KEY = os.environ.get("S3_KEY")
    S3_SECRET = os.environ.get("S3_SECRET")
    S3_REGION = os.environ.get("S3_REGION")

    # Check if all S3 configurations are present
    if not all([S3_BUCKET, S3_KEY, S3_SECRET, S3_REGION]):
        current_app.logger.error("S3 configuration is missing from environment variables.")
        return jsonify({"error": "Server configuration error for file uploads."}), 500
        
    # --- CHANGE: Added region_name to the client connection ---
    s3 = boto3.client(
   "s3",
   region_name=S3_REGION,
   aws_access_key_id=S3_KEY,
   aws_secret_access_key=S3_SECRET,
   config=Config(signature_version='s3v4')  # <-- This line is essential
)

    try:
        # Handle ID Document Upload
        if 'id_document' in request.files:
            id_file = request.files['id_document']
            if id_file and allowed_file(id_file.filename):
                # Create a secure, unique filename in a user-specific folder
                id_filename = f"user_{user.id}/id_{secure_filename(id_file.filename)}"
                
                # Upload to S3
                s3.upload_fileobj(id_file, S3_BUCKET, id_filename, ExtraArgs={"ContentType": id_file.content_type})
                
                # Construct the public URL
                id_url = f"https://{S3_BUCKET}.s3.{S3_REGION}.amazonaws.com/{id_filename}"

                # Save the permanent URL to the database
                user.id_document_url = id_url
                user.verification_status = 'pending' # Set to pending for admin review

        # Handle SIA Document Upload
        if 'sia_document' in request.files:
            sia_file = request.files['sia_document']
            if sia_file and allowed_file(sia_file.filename):
                sia_filename = f"user_{user.id}/sia_{secure_filename(sia_file.filename)}"
                s3.upload_fileobj(sia_file, S3_BUCKET, sia_filename, ExtraArgs={"ContentType": sia_file.content_type})
                sia_url = f"https://{S3_BUCKET}.s3.{S3_REGION}.amazonaws.com/{sia_filename}"
                user.sia_document_url = sia_url
                
        db.session.commit()
        return jsonify({"message": "Documents uploaded successfully"}), 200

    except Exception as e:
        current_app.logger.error(f"S3 Upload Error: {e}")
        return jsonify({"error": "Failed to upload file to storage."}), 500


# --- PDF AND EMAIL HELPER FUNCTIONS ---

def generate_invoice_pdf(agent, jobs_data, total_amount, invoice_number):
    """Generates a PDF invoice."""
    # This function uses a local 'INVOICE_FOLDER', which is temporary on Heroku.
    # For now this is okay for generating the PDF before emailing it.
    # A future improvement would be to save these to S3 as well.
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
        amount = hours * rate
        
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

        available_dates_records = AgentAvailability.query.filter_by(
            agent_id=user.id, 
            is_available=True, 
            is_away=False
        ).all()
        available_dates = [record.date for record in available_dates_records]

        available_jobs = []
        if available_dates:
            assigned_job_ids = [
                assignment.job_id for assignment in 
                JobAssignment.query.filter_by(agent_id=user.id).all()
            ]
            
            available_jobs = Job.query.filter(
                Job.status == 'open',
                db.func.date(Job.arrival_time).in_(available_dates),
                ~Job.id.in_(assigned_job_ids)
            ).order_by(Job.arrival_time.asc()).all()

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
            'available_jobs': [job.to_dict() for job in available_jobs],
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

@agent_bp.route('/agent/invoices', methods=['GET'])
@jwt_required()
def get_agent_invoices():
    """Fetches a list of all invoices for the current agent."""
    try:
        current_user_id = int(get_jwt_identity())
        
        invoices = Invoice.query.filter_by(agent_id=current_user_id).order_by(Invoice.issue_date.desc()).all()
        
        invoice_list = [{
            "id": inv.id,
            "invoice_number": inv.invoice_number,
            "issue_date": inv.issue_date.isoformat(),
            "due_date": inv.due_date.isoformat(),
            "total_amount": float(inv.total_amount),
            "status": inv.status,
            "pdf_url": f"/api/invoices/{inv.invoice_number}.pdf"
        } for inv in invoices]
        
        return jsonify(invoice_list), 200

    except Exception as e:
        return jsonify({"error": "An internal error occurred", "details": str(e)}), 500

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
        pdf_path = generate_invoice_pdf(agent, jobs_to_invoice, total_amount, invoice_number)

        # Assume MAIL_DEFAULT_SENDER[1] is the accounts email
        accounts_email = current_app.config['MAIL_DEFAULT_SENDER'][1] if isinstance(current_app.config['MAIL_DEFAULT_SENDER'], tuple) else current_app.config['MAIL_DEFAULT_SENDER']
        email_sent = send_invoice_email(
            recipient_email=accounts_email,
            agent_name=f"{agent.first_name} {agent.last_name}",
            pdf_path=pdf_path,
            invoice_number=invoice_number,
            cc_email=agent.email
        )

        if not email_sent:
            db.session.rollback()
            if os.path.exists(pdf_path):
                os.remove(pdf_path)
            return jsonify({'error': 'Failed to send invoice email. The transaction has been rolled back.'}), 500

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