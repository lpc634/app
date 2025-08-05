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

def generate_invoice_pdf(agent, jobs_data, total_amount, invoice_number, upload_to_s3=True):
    """Generates a professional PDF invoice with enhanced V3 Services template layout and uploads to S3."""
    import traceback
    from reportlab.lib.colors import HexColor, black
    from reportlab.lib.units import inch
    from reportlab.lib.styles import getSampleStyleSheet
    
    try:
        current_app.logger.info(f"PDF GENERATION START: Creating professional V3 Services invoice PDF for {invoice_number}")
        current_app.logger.info(f"PDF GENERATION: Agent ID {agent.id}, jobs count: {len(jobs_data)}, total: {total_amount}")
        
        # Create invoice directory
        invoice_folder = os.path.join('/tmp', 'invoices')
        os.makedirs(invoice_folder, exist_ok=True)
        file_path = os.path.join(invoice_folder, f"{invoice_number}.pdf")
        
        current_app.logger.info(f"PDF GENERATION: Creating professional PDF at path: {file_path}")
        
        # Initialize PDF canvas with letter size
        c = canvas.Canvas(file_path, pagesize=letter)
        width, height = letter
        
        # Define professional color scheme
        primary_color = HexColor('#2C3E50')  # Dark blue-gray
        accent_color = HexColor('#FF5722')   # V3 Services orange
        light_gray = HexColor('#F8F9FA')
        border_color = HexColor('#E9ECEF')
        
        # Define consistent spacing and margins
        left_margin = 0.75 * inch
        right_margin = width - 0.75 * inch
        top_margin = height - 0.75 * inch
        
        # Helper function for consistent spacing
        def add_spacing(current_y, space_type='normal'):
            spacing = {
                'small': 8,
                'normal': 15,
                'large': 25,
                'section': 35
            }
            return current_y - spacing.get(space_type, 15)
        
        # ===== PROFESSIONAL HEADER SECTION =====
        current_app.logger.info("PDF GENERATION: Drawing professional header")
        
        y_pos = top_margin
        
        # Company header box with background
        header_box_height = 2.2 * inch
        c.setFillColor(light_gray)
        c.rect(left_margin - 10, y_pos - header_box_height + 15, 
               right_margin - left_margin + 20, header_box_height, 
               fill=True, stroke=False)
        
        # Reset to black for text
        c.setFillColor(black)
        
        # Company name (large, prominent)
        c.setFont("Helvetica-Bold", 24)
        c.setFillColor(primary_color)
        company_name_y = y_pos - 25
        c.drawString(left_margin, company_name_y, "V3 SERVICES LTD")
        
        # Professional tagline
        c.setFont("Helvetica", 11)
        c.setFillColor(black)
        c.drawString(left_margin, company_name_y - 20, "Professional Security & Investigation Services")
        
        # Company address in structured format
        c.setFont("Helvetica", 10)
        address_y = company_name_y - 45
        c.drawString(left_margin, address_y, "117 Dartford Road")
        c.drawString(left_margin, address_y - 12, "Dartford, England")
        c.drawString(left_margin, address_y - 24, "DA1 3EN")
        
        # Contact information (right side of header)
        c.setFont("Helvetica", 10)
        contact_x = right_margin - 120
        c.drawString(contact_x, address_y, "Email: accounts@v3services.co.uk")
        c.drawString(contact_x, address_y - 12, "Phone: +44 (0)1322 123456")
        c.drawString(contact_x, address_y - 24, "www.v3services.co.uk")
        
        # Invoice title and metadata box
        invoice_meta_y = y_pos - header_box_height - 15
        
        # Invoice title
        c.setFont("Helvetica-Bold", 20)
        c.setFillColor(accent_color)
        c.drawString(left_margin, invoice_meta_y, "INVOICE")
        
        # Invoice metadata in right-aligned box
        c.setFillColor(black)
        c.setFont("Helvetica-Bold", 11)
        meta_x = right_margin - 150
        
        # Invoice details box
        c.setStrokeColor(border_color)
        c.setLineWidth(1)
        c.rect(meta_x - 10, invoice_meta_y - 55, 160, 70, fill=False, stroke=True)
        
        invoice_date = date.today().strftime('%d/%m/%Y')
        c.drawString(meta_x, invoice_meta_y - 15, "Invoice Number:")
        c.setFont("Helvetica", 11)
        c.drawString(meta_x, invoice_meta_y - 28, invoice_number)
        
        c.setFont("Helvetica-Bold", 11)
        c.drawString(meta_x, invoice_meta_y - 45, "Invoice Date:")
        c.setFont("Helvetica", 11)
        c.drawString(meta_x, invoice_meta_y - 58, invoice_date)
        
        y_pos = invoice_meta_y - 85
        
        # ===== CLIENT DETAILS SECTION =====
        current_app.logger.info("PDF GENERATION: Drawing client details section")
        
        # Section header
        c.setFont("Helvetica-Bold", 14)
        c.setFillColor(primary_color)
        c.drawString(left_margin, y_pos, "Bill To:")
        y_pos = add_spacing(y_pos, 'large')
        
        # Client details box
        c.setStrokeColor(border_color)
        c.setLineWidth(1)
        client_box_height = 80
        c.rect(left_margin, y_pos - client_box_height, 300, client_box_height, fill=False, stroke=True)
        
        # Handle potential None values in agent data
        first_name = agent.first_name or ""
        last_name = agent.last_name or ""
        address_line_1 = agent.address_line_1 or "Address not provided"
        address_line_2 = agent.address_line_2 or ""
        city = agent.city or "City not provided"
        postcode = agent.postcode or "Postcode not provided"
        
        # Client information with proper formatting
        c.setFillColor(black)
        c.setFont("Helvetica-Bold", 12)
        client_y = y_pos - 18
        c.drawString(left_margin + 10, client_y, f"{first_name} {last_name}")
        
        c.setFont("Helvetica", 11)
        client_y = add_spacing(client_y, 'normal')
        c.drawString(left_margin + 10, client_y, address_line_1)
        
        if address_line_2.strip():
            client_y = add_spacing(client_y, 'small')
            c.drawString(left_margin + 10, client_y, address_line_2)
        
        client_y = add_spacing(client_y, 'small')
        c.drawString(left_margin + 10, client_y, f"{city}")
        
        client_y = add_spacing(client_y, 'small')
        c.drawString(left_margin + 10, client_y, postcode)
        
        y_pos = y_pos - client_box_height - 30
        
        # ===== PROFESSIONAL INVOICE TABLE SECTION =====
        current_app.logger.info("PDF GENERATION: Drawing professional invoice table")
        
        # Table header with professional styling
        c.setFont("Helvetica-Bold", 14)
        c.setFillColor(primary_color)
        c.drawString(left_margin, y_pos, "Services Provided:")
        y_pos = add_spacing(y_pos, 'large')
        
        # Table structure definition
        table_left = left_margin
        table_right = right_margin
        table_width = table_right - table_left
        
        # Column definitions (proportional widths)
        col_widths = {
            'date': 120,
            'description': 200,
            'hours': 80,
            'rate': 80,
            'amount': 100
        }
        
        # Column positions
        col_positions = {
            'date': table_left,
            'description': table_left + col_widths['date'],
            'hours': table_left + col_widths['date'] + col_widths['description'],
            'rate': table_left + col_widths['date'] + col_widths['description'] + col_widths['hours'],
            'amount': table_right - col_widths['amount']
        }
        
        # Draw table header with professional styling
        header_height = 30
        c.setFillColor(light_gray)
        c.rect(table_left, y_pos - header_height, table_width, header_height, fill=True, stroke=True)
        
        c.setFillColor(primary_color)
        c.setFont("Helvetica-Bold", 11)
        header_text_y = y_pos - 20
        
        c.drawString(col_positions['date'] + 5, header_text_y, "Date")
        c.drawString(col_positions['description'] + 5, header_text_y, "Description")
        c.drawString(col_positions['hours'] + 5, header_text_y, "Hours")
        c.drawString(col_positions['rate'] + 5, header_text_y, "Rate")
        c.drawRightString(col_positions['amount'] + col_widths['amount'] - 5, header_text_y, "Amount")
        
        y_pos -= header_height
        
        # Process each job with professional table rows
        c.setFillColor(black)
        c.setFont("Helvetica", 10)
        row_height = 25
        
        for i, job_item in enumerate(jobs_data):
            job = job_item['job']
            
            # Alternate row colors for better readability
            if i % 2 == 0:
                c.setFillColor(HexColor('#FFFFFF'))
            else:
                c.setFillColor(HexColor('#F8F9FA'))
            
            c.rect(table_left, y_pos - row_height, table_width, row_height, fill=True, stroke=True)
            c.setFillColor(black)
            
            # Calculate job values
            hours = job_item.get('hours', 0)
            if 'rate' in job_item:
                rate_value = job_item['rate']
            else:
                rate_value = job.hourly_rate
            
            try:
                # Convert to consistent types for calculations
                hours_decimal = Decimal(str(hours))
                rate_decimal = Decimal(str(rate_value))
                amount_decimal = hours_decimal * rate_decimal
                
                # Format for display
                hours_str = f"{float(hours_decimal):.1f}h"
                rate_str = f"£{float(rate_decimal):.2f}"
                amount_str = f"£{float(amount_decimal):.2f}"
                
                # Handle job date/time
                if job.arrival_time:
                    job_datetime = job.arrival_time.strftime('%d/%m/%Y')
                else:
                    job_datetime = "Date not set"
                
                # Job description (combine address and title)
                job_address = job.address or "Address not provided"
                job_title = job.title or "Service"
                job_description = f"{job_title}\n{job_address}"
                
                # Draw table row data
                text_y = y_pos - 15
                c.drawString(col_positions['date'] + 5, text_y, job_datetime)
                
                # Handle multi-line description
                desc_lines = job_description.split('\n')
                for idx, line in enumerate(desc_lines[:2]):  # Limit to 2 lines
                    if len(line) > 25:  # Truncate long lines
                        line = line[:25] + "..."
                    c.drawString(col_positions['description'] + 5, text_y - (idx * 10), line)
                
                c.drawString(col_positions['hours'] + 5, text_y, hours_str)
                c.drawString(col_positions['rate'] + 5, text_y, rate_str)
                c.drawRightString(col_positions['amount'] + col_widths['amount'] - 5, text_y, amount_str)
                
                y_pos -= row_height
                
            except (ValueError, TypeError, InvalidOperation) as calc_error:
                current_app.logger.error(f"PDF GENERATION ERROR: Failed to process job {i+1} - {str(calc_error)}")
                raise Exception(f"Invalid data in job {i+1}: hours={hours}, rate={rate_value}")
        
        # Table footer line
        c.setStrokeColor(primary_color)
        c.setLineWidth(2)
        c.line(table_left, y_pos, table_right, y_pos)
        y_pos = add_spacing(y_pos, 'large')
        
        # ===== PROFESSIONAL TOTAL SECTION =====
        current_app.logger.info("PDF GENERATION: Drawing professional total section")
        
        # Total calculations box
        total_box_width = 200
        total_box_height = 80
        total_box_x = right_margin - total_box_width
        
        c.setStrokeColor(border_color)
        c.setLineWidth(1)
        c.rect(total_box_x, y_pos - total_box_height, total_box_width, total_box_height, fill=False, stroke=True)
        
        try:
            total_decimal = Decimal(str(total_amount))
            total_str = f"£{float(total_decimal):.2f}"
            
            # Subtotal row
            c.setFont("Helvetica", 11)
            c.setFillColor(black)
            subtotal_y = y_pos - 20
            c.drawString(total_box_x + 10, subtotal_y, "Subtotal:")
            c.drawRightString(total_box_x + total_box_width - 10, subtotal_y, total_str)
            
            # VAT row (0% for contractor services)
            vat_y = subtotal_y - 20
            c.drawString(total_box_x + 10, vat_y, "VAT (0%):")
            c.drawRightString(total_box_x + total_box_width - 10, vat_y, "£0.00")
            
            # Total line
            c.setStrokeColor(primary_color)
            c.setLineWidth(1)
            c.line(total_box_x + 10, vat_y - 8, total_box_x + total_box_width - 10, vat_y - 8)
            
            # Final total
            c.setFont("Helvetica-Bold", 14)
            c.setFillColor(primary_color)
            total_y = vat_y - 25
            c.drawString(total_box_x + 10, total_y, "TOTAL:")
            c.drawRightString(total_box_x + total_box_width - 10, total_y, total_str)
            
            y_pos = y_pos - total_box_height - 30
            
        except (ValueError, TypeError, InvalidOperation) as total_error:
            current_app.logger.error(f"PDF GENERATION ERROR: Failed to format total amount - {str(total_error)}")
            raise Exception(f"Invalid total amount: {total_amount}")
        
        # ===== PROFESSIONAL PAYMENT SECTION =====
        current_app.logger.info("PDF GENERATION: Drawing professional payment section")
        
        # Payment terms header
        c.setFont("Helvetica-Bold", 14)
        c.setFillColor(primary_color)
        c.drawString(left_margin, y_pos, "Payment Details:")
        y_pos = add_spacing(y_pos, 'large')
        
        # Payment information box
        payment_box_height = 100
        c.setStrokeColor(border_color)
        c.setLineWidth(1)
        c.rect(left_margin, y_pos - payment_box_height, right_margin - left_margin, payment_box_height, fill=False, stroke=True)
        
        # Payment instruction
        c.setFont("Helvetica-Bold", 12)
        c.setFillColor(black)
        payment_y = y_pos - 20
        c.drawString(left_margin + 10, payment_y, "Payment Method: BACS Transfer Only")
        
        # Bank details with better formatting
        bank_name = agent.bank_name or "Bank not provided"
        account_number = agent.bank_account_number or "Account not provided" 
        sort_code = agent.bank_sort_code or "Sort code not provided"
        utr_number = agent.utr_number or "UTR not provided"
        
        c.setFont("Helvetica", 11)
        payment_y = add_spacing(payment_y, 'normal')
        c.drawString(left_margin + 10, payment_y, f"Account Name: {first_name} {last_name}")
        
        payment_y = add_spacing(payment_y, 'normal')
        c.drawString(left_margin + 10, payment_y, f"Bank: {bank_name}")
        
        payment_y = add_spacing(payment_y, 'normal')
        c.drawString(left_margin + 10, payment_y, f"Account Number: {account_number}")
        c.drawString(left_margin + 250, payment_y, f"Sort Code: {sort_code}")
        
        payment_y = add_spacing(payment_y, 'normal')
        c.drawString(left_margin + 10, payment_y, f"UTR Number: {utr_number}")
        
        y_pos = y_pos - payment_box_height - 30
        
        # ===== PROFESSIONAL FOOTER SECTION =====
        current_app.logger.info("PDF GENERATION: Drawing professional footer")
        
        # Terms and conditions section
        c.setFont("Helvetica-Bold", 12)
        c.setFillColor(primary_color)
        c.drawString(left_margin, y_pos, "Terms & Conditions:")
        y_pos = add_spacing(y_pos, 'normal')
        
        # Terms text with proper formatting
        c.setFont("Helvetica", 10)
        c.setFillColor(black)
        
        terms = [
            "• Payment to be made within 14 days of invoice issue date",
            "• All invoice queries must be raised within 7 days of issue",
            "• The contractor is responsible for any Tax or National Insurance due on all invoices",
            "• Late payment charges may apply as per the Late Payment of Commercial Debts Act"
        ]
        
        for term in terms:
            c.drawString(left_margin, y_pos, term)
            y_pos = add_spacing(y_pos, 'small')
        
        # Professional footer bar
        y_pos -= 20
        c.setFillColor(light_gray)
        c.rect(left_margin - 10, y_pos - 40, right_margin - left_margin + 20, 40, fill=True, stroke=False)
        
        # Footer text
        c.setFont("Helvetica", 9)
        c.setFillColor(black)
        footer_y = y_pos - 15
        c.drawString(left_margin, footer_y, "V3 Services Ltd | Professional Security & Investigation Services")
        
        footer_y = add_spacing(footer_y, 'small')
        c.drawString(left_margin, footer_y, "117 Dartford Road, Dartford, England, DA1 3EN | accounts@v3services.co.uk")
        
        # Thank you message
        c.setFont("Helvetica-Bold", 10)
        c.drawRightString(right_margin, footer_y + 8, "Thank you for your business!")
        
        current_app.logger.info("PDF GENERATION: Saving PDF")
        c.save()
        
        current_app.logger.info(f"PDF GENERATION SUCCESS: V3 Services invoice PDF saved to {file_path}")
        
        # Always upload to S3 for in-app access
        if upload_to_s3:
            current_app.logger.info("PDF GENERATION: Starting S3 upload")
            try:
                upload_result = s3_client.upload_invoice_pdf(
                    agent_id=agent.id,
                    invoice_number=invoice_number,
                    pdf_data=file_path,
                    filename=f"{invoice_number}.pdf"
                )
                
                if upload_result.get('success'):
                    current_app.logger.info(f"PDF GENERATION: S3 upload successful - {upload_result.get('file_key')}")
                    try:
                        os.remove(file_path)
                        current_app.logger.info(f"PDF GENERATION: Local file cleaned up - {file_path}")
                    except Exception as cleanup_error:
                        current_app.logger.warning(f"PDF GENERATION: Failed to clean up local file - {str(cleanup_error)}")
                    return file_path, upload_result.get('file_key')
                else:
                    current_app.logger.error(f"PDF GENERATION: S3 upload failed - {upload_result.get('error')}")
                    return file_path
            except Exception as s3_error:
                current_app.logger.error(f"PDF GENERATION: S3 upload error - {str(s3_error)}")
                current_app.logger.error(f"PDF GENERATION: S3 upload traceback: {traceback.format_exc()}")
                return file_path
        
        current_app.logger.info(f"PDF GENERATION SUCCESS: Returning local path - {file_path}")
        return file_path
        
    except Exception as e:
        current_app.logger.error(f"PDF GENERATION FAILED: {str(e)}")
        current_app.logger.error(f"PDF GENERATION FAILED: Traceback: {traceback.format_exc()}")
        raise e

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
                upload_to_s3=True
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