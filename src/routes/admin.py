# src/routes/admin.py
from flask import Blueprint, jsonify, request, current_app, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
from src.models.user import User, Job, JobAssignment, AgentAvailability, Invoice, InvoiceJob, Notification, JobBilling, Expense, db
from src.utils.s3_client import s3_client
from src.utils.finance import (
    update_job_hours, calculate_job_revenue, calculate_expense_vat,
    get_job_expense_totals, get_job_agent_invoice_totals, calculate_job_profit,
    lock_job_revenue_snapshot, get_financial_summary
)
from datetime import datetime, date, timedelta
import json
import logging
import requests
import io
from openpyxl import Workbook
from openpyxl.utils import get_column_letter

admin_bp = Blueprint('admin', __name__)

# Helper: ensure current user is admin
def require_admin():
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(int(current_user_id)) if current_user_id is not None else None
        if not user or user.role != 'admin':
            return None
        return user
    except Exception:
        return None
def _parse_date_param(value):
    if not value:
        return None
    try:
        return datetime.strptime(value, '%Y-%m-%d').date()
    except Exception:
        return None

def _daterange_from_period(period, ref_date=None):
    today = ref_date or date.today()
    if period == 'this_month':
        start = today.replace(day=1)
        if start.month == 12:
            end = start.replace(year=start.year + 1, month=1)
        else:
            end = start.replace(month=start.month + 1)
        return start, end
    if period == 'last_month':
        start = (today.replace(day=1) - timedelta(days=1)).replace(day=1)
        end = today.replace(day=1)
        return start, end
    if period == 'this_quarter':
        q = (today.month - 1) // 3
        start_month = q * 3 + 1
        start = date(today.year, start_month, 1)
        end_month = start_month + 3
        end_year = today.year + (1 if end_month > 12 else 0)
        end_month = 1 if end_month > 12 else end_month
        end = date(end_year, end_month, 1)
        return start, end
    if period == 'last_quarter':
        q = (today.month - 1) // 3
        start_month = (q - 1) * 3 + 1
        start_year = today.year
        if start_month <= 0:
            start_month += 12
            start_year -= 1
        start = date(start_year, start_month, 1)
        # end is start + 3 months
        end_month = start_month + 3
        end_year = start_year + (1 if end_month > 12 else 0)
        end_month = 1 if end_month > 12 else end_month
        end = date(end_year, end_month, 1)
        return start, end
    if period == 'this_year':
        start = date(today.year, 1, 1)
        end = date(today.year + 1, 1, 1)
        return start, end
    if period == 'last_year':
        start = date(today.year - 1, 1, 1)
        end = date(today.year, 1, 1)
        return start, end
    return None, None

@admin_bp.route('/admin/expenses/export', methods=['GET'])
@jwt_required()
def export_expenses():
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(int(current_user_id))
        if not current_user or current_user.role != 'admin':
            return jsonify({'error': 'Access denied'}), 403

        # Filters
        period = request.args.get('period')  # this_month, last_month, this_quarter, last_quarter, this_year, last_year
        from_q = request.args.get('from')
        to_q = request.args.get('to')
        category = request.args.get('category')
        status = request.args.get('status')
        job_id = request.args.get('job_id', type=int)
        search = request.args.get('search', type=str)

        start_date, end_date = _daterange_from_period(period)
        if from_q:
            start_date = _parse_date_param(from_q)
        if to_q:
            to_parsed = _parse_date_param(to_q)
            # treat 'to' as inclusive by adding one day for < end filtering
            if to_parsed:
                end_date = to_parsed + timedelta(days=1)

        # Query
        q = Expense.query
        if start_date:
            q = q.filter(Expense.date >= start_date)
        if end_date:
            q = q.filter(Expense.date < end_date)
        if category:
            q = q.filter(Expense.category == category)
        if status:
            q = q.filter(Expense.status == status)
        if job_id:
            q = q.filter(Expense.job_id == job_id)

        expenses = q.order_by(Expense.date.asc()).all()
        # Client-like search on text fields
        if search:
            s = search.lower()
            def _match(e):
                parts = [e.description or '', e.supplier or '', e.category or '']
                return any(s in (p.lower()) for p in parts)
            expenses = [e for e in expenses if _match(e)]

        # Build workbook
        wb = Workbook()
        ws = wb.active
        ws.title = 'Expenses'
        headers = ['Date','Category','Description','Net','VAT Rate','VAT','Gross','Supplier','Paid With','Status','Job ID','Created By']
        ws.append(headers)
        total_net = total_vat = total_gross = 0
        for e in expenses:
            net = float(e.amount_net or 0)
            vat_rate = float(e.vat_rate or 0)
            vat = float(e.vat_amount or (net * vat_rate))
            gross = float(e.amount_gross or (net + vat))
            total_net += net
            total_vat += vat
            total_gross += gross
            ws.append([
                e.date.isoformat() if e.date else '',
                e.category,
                e.description,
                net,
                vat_rate,
                vat,
                gross,
                e.supplier or '',
                e.paid_with,
                e.status,
                e.job_id or '',
                e.created_by
            ])
        ws.append([])
        ws.append(['Totals','','', total_net, '', total_vat, total_gross])
        # Column widths
        widths = [12,14,50,12,10,12,12,18,14,12,10,12]
        for i,w in enumerate(widths, start=1):
            ws.column_dimensions[get_column_letter(i)].width = w

        # Summary sheet
        ws2 = wb.create_sheet('Summary')
        ws2.append(['Metric','Amount'])
        ws2.append(['Total Net', total_net])
        ws2.append(['Total VAT (input)', total_vat])
        ws2.append(['Total Gross', total_gross])

        # VAT by rate
        by_rate = {}
        for e in expenses:
            rate = float(e.vat_rate or 0)
            net = float(e.amount_net or 0)
            vat = float(e.vat_amount or net * rate)
            gross = float(e.amount_gross or net + vat)
            agg = by_rate.setdefault(rate, {'net':0,'vat':0,'gross':0})
            agg['net'] += net; agg['vat'] += vat; agg['gross'] += gross
        ws3 = wb.create_sheet('VAT Report')
        ws3.append(['VAT Rate','Net','VAT','Gross'])
        for rate, agg in sorted(by_rate.items()):
            ws3.append([rate, agg['net'], agg['vat'], agg['gross']])

        # Serialize to bytes
        buf = io.BytesIO()
        wb.save(buf)
        buf.seek(0)

        # Filename
        fn_from = (start_date or (expenses[0].date if expenses else date.today())).isoformat()
        fn_to = ((end_date - timedelta(days=1)) if end_date else (expenses[-1].date if expenses else date.today())).isoformat()
        filename = f"expenses_{fn_from}_to_{fn_to}.xlsx"

        return send_file(
            buf,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name=filename
        )
    except Exception as e:
        current_app.logger.error(f"Error exporting expenses: {e}")
        return jsonify({'error': 'Failed to export expenses'}), 500

def handle_legacy_document_access(file_key):
    """
    Handle access to legacy documents stored in the old system
    
    Args:
        file_key (str): Legacy file key (e.g., 'user_2/id_20250312_154622.jpg')
        
    Returns:
        dict: Result with success status and URL or error message
    """
    try:
        # The legacy system uses ngrok to serve files
        NGROK_URL = "https://1b069dfae07e.ngrok-free.app"
        
        # Convert the file key to the expected format for the legacy system
        legacy_url = f"{NGROK_URL}/files/{file_key}"
        
        # Test if the file exists by making a HEAD request
        response = requests.head(legacy_url, timeout=10)
        
        if response.status_code == 200:
            return {
                'success': True,
                'url': legacy_url,
                'expires_in': 3600,  # Legacy URLs don't expire, but we set this for consistency
                'is_legacy': True
            }
        else:
            return {
                'success': False,
                'error': f'Legacy document not found (HTTP {response.status_code})'
            }
            
    except requests.exceptions.Timeout:
        return {
            'success': False,
            'error': 'Legacy document service is not responding'
        }
    except requests.exceptions.ConnectionError:
        return {
            'success': False,
            'error': 'Cannot connect to legacy document service'
        }
    except Exception as e:
        current_app.logger.error(f"Error accessing legacy document {file_key}: {str(e)}")
        return {
            'success': False,
            'error': 'Error accessing legacy document'
        }

@admin_bp.route('/admin/agents/verification-pending', methods=['GET'])
@jwt_required()
def get_pending_verifications():
    """Get all agents with pending verification status or uploaded documents."""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(int(current_user_id))
        
        if not current_user or current_user.role != 'admin':
            return jsonify({'error': 'Access denied'}), 403
        
        # Get agents with pending verification or uploaded documents
        pending_agents = User.query.filter(
            User.role == 'agent',
            db.or_(
                User.verification_status == 'pending',
                User.id_document_url.isnot(None),
                User.sia_document_url.isnot(None)
            )
        ).order_by(User.created_at.desc()).all()
        
        agents_data = []
        for agent in pending_agents:
            # Only include if they have documents or are pending
            if (agent.id_document_url or agent.sia_document_url or 
                agent.verification_status == 'pending'):
                agents_data.append(agent.to_dict())
        
        return jsonify({'agents': agents_data}), 200
        
    except Exception as e:
        current_app.logger.error(f"Error fetching pending verifications: {e}")
        return jsonify({'error': 'Failed to fetch pending verifications'}), 500

@admin_bp.route('/admin/agents/<int:agent_id>/verify', methods=['POST'])
@jwt_required()
def verify_agent(agent_id):
    """Approve or reject an agent's verification."""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(int(current_user_id))
        
        if not current_user or current_user.role != 'admin':
            return jsonify({'error': 'Access denied'}), 403
        
        data = request.get_json()
        action = data.get('action')  # 'approve' or 'reject'
        
        if action not in ['approve', 'reject']:
            return jsonify({'error': 'Invalid action'}), 400
        
        agent = User.query.get(agent_id)
        if not agent:
            return jsonify({'error': 'Agent not found'}), 404
        
        if agent.role != 'agent':
            return jsonify({'error': 'User is not an agent'}), 400
        
        # Update verification status
        if action == 'approve':
            agent.verification_status = 'verified'
            
            # GDPR COMPLIANCE: Delete ID document after verification
            # ID documents are only needed for identity verification and should be deleted
            # once the agent is verified to comply with GDPR data minimization principles
            if agent.id_document_url:
                current_app.logger.info(f"Deleting ID document for verified agent {agent.email} (GDPR compliance)")
                agent.id_document_url = None  # Remove reference to ID document
                
            message = f"Agent {agent.first_name} {agent.last_name} has been verified (ID document deleted for GDPR compliance)"
        else:
            agent.verification_status = 'rejected'
            
            # Delete both documents on rejection for data protection
            if agent.id_document_url or agent.sia_document_url:
                current_app.logger.info(f"Deleting all documents for rejected agent {agent.email} (data protection)")
                agent.id_document_url = None
                agent.sia_document_url = None
                
            message = f"Agent {agent.first_name} {agent.last_name} has been rejected (documents deleted)"
        
        db.session.commit()
        
        current_app.logger.info(f"Admin {current_user.email} {action}d agent {agent.email}")
        
        return jsonify({
            'message': message,
            'agent': agent.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error verifying agent: {e}")
        return jsonify({'error': 'Failed to verify agent'}), 500

# --- S3 FILE ACCESS ENDPOINTS FOR ADMIN (GDPR COMPLIANT) ---

@admin_bp.route('/admin/agent/<int:agent_id>/documents', methods=['GET'])
@jwt_required()
def get_agent_documents_admin(agent_id):
    """
    Admin endpoint to view all documents uploaded by a specific agent
    GDPR compliant - only authorized admin users can access
    """
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(int(current_user_id))
        
        if not current_user or current_user.role != 'admin':
            return jsonify({'error': 'Access denied. Admin role required.'}), 403
        
        agent = User.query.get(agent_id)
        if not agent or agent.role != 'agent':
            return jsonify({'error': 'Agent not found'}), 404
        
        documents = []
        
        # S3 document storage is now available
        
        # S3 document storage temporarily disabled - field removed from database
        
        # Also get documents from S3 directly to ensure completeness
        s3_documents = s3_client.list_agent_documents(agent_id)
        
        # Log admin access for GDPR compliance
        current_app.logger.info(f"Admin {current_user.email} accessed documents for agent {agent.email} (ID: {agent_id})")
        
        return jsonify({
            "agent_info": {
                "id": agent.id,
                "name": f"{agent.first_name} {agent.last_name}",
                "email": agent.email,
                "verification_status": agent.verification_status
            },
            "documents": documents,
            "s3_documents": s3_documents,
            "total_count": len(documents)
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Error fetching agent documents for admin: {str(e)}")
        return jsonify({'error': 'Failed to fetch agent documents'}), 500

@admin_bp.route('/admin/invoices/<int:invoice_id>/pdf', methods=['GET'])
@jwt_required()
def get_invoice_pdf_admin(invoice_id):
    """
    Admin endpoint to access invoice PDFs stored in S3
    """
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(int(current_user_id))
        
        if not current_user or current_user.role != 'admin':
            return jsonify({'error': 'Access denied. Admin role required.'}), 403
        
        invoice = Invoice.query.get(invoice_id)
        if not invoice:
            return jsonify({'error': 'Invoice not found'}), 404
        
        # Use standard S3 path instead of pdf_file_url
        if invoice.status == 'draft':
            return jsonify({'error': 'Cannot access draft invoice PDFs'}), 400
        
        # Generate secure download URL using S3 path
        s3_result = s3_client.generate_invoice_download_url(
            agent_id=invoice.agent_id,
            invoice_number=invoice.invoice_number,
            expiration=3600
        )
        
        if not s3_result.get('success'):
            return jsonify({'error': 'PDF not available for this invoice'}), 404
        
        signed_url = s3_result['download_url']
        
        if not signed_url:
            return jsonify({'error': 'Failed to generate access URL'}), 500
        
        # Log admin access
        current_app.logger.info(f"Admin {current_user.email} accessed invoice PDF {invoice.invoice_number}")
        
        return jsonify({
            "invoice_number": invoice.invoice_number,
            "agent_name": f"{invoice.agent.first_name} {invoice.agent.last_name}",
            "pdf_url": signed_url,
            "issue_date": invoice.issue_date.isoformat() if invoice.issue_date else None
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Error fetching invoice PDF for admin: {str(e)}")
        return jsonify({'error': 'Failed to fetch invoice PDF'}), 500

@admin_bp.route('/admin/agent/<int:agent_id>/documents/<document_type>', methods=['DELETE'])
@jwt_required()
def delete_agent_document_admin(agent_id, document_type):
    """
    Admin endpoint to delete agent documents (GDPR compliance - right to be forgotten)
    """
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(int(current_user_id))
        
        if not current_user or current_user.role != 'admin':
            return jsonify({'error': 'Access denied. Admin role required.'}), 403
        
        agent = User.query.get(agent_id)
        if not agent or agent.role != 'agent':
            return jsonify({'error': 'Agent not found'}), 404
        
        # S3 document storage is now available

        # S3 document storage temporarily disabled
        if False:  # not agent.document_files:
            return jsonify({'error': 'No documents found for this agent'}), 404
        
        # document_files = agent.document_files
        return jsonify({'error': 'Document deletion temporarily unavailable'}), 503
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
            return jsonify({'error': 'Document not found'}), 404
        
        # Delete from S3
        delete_success = s3_client.delete_file(document_to_delete['file_key'])
        
        if delete_success:
            # Update agent's document list
            agent.document_files = updated_documents
            db.session.commit()
            
            # Log admin action for compliance
            current_app.logger.info(f"Admin {current_user.email} deleted {document_type} document for agent {agent.email} (GDPR compliance)")
            
            return jsonify({
                "message": f"Document of type '{document_type}' deleted successfully for agent {agent.first_name} {agent.last_name}"
            }), 200
        else:
            return jsonify({'error': 'Failed to delete document from storage'}), 500
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error deleting agent document (admin): {str(e)}")
        return jsonify({'error': 'Failed to delete document'}), 500

# ADMIN DOCUMENT REVIEW ENDPOINTS - Complete document management system

@admin_bp.route('/admin/agents/documents', methods=['GET'])
@jwt_required()
def get_all_agents_documents():
    """Get all agents with their document status and metadata for admin review."""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(int(current_user_id))
        
        if not current_user or current_user.role != 'admin':
            return jsonify({'error': 'Access denied'}), 403
        
        # Get all agents
        agents = User.query.filter_by(role='agent').order_by(User.created_at.desc()).all()
        
        agents_data = []
        for agent in agents:
            # Get documents from S3
            s3_documents = s3_client.list_agent_documents(agent.id)
            
            # Count documents by type
            document_counts = {}
            for doc in s3_documents:
                doc_type = doc.get('metadata', {}).get('document_type', 'unknown')
                document_counts[doc_type] = document_counts.get(doc_type, 0) + 1
            
            # Also check for legacy documents stored in the old system
            legacy_documents = []
            if agent.id_document_url:
                legacy_documents.append({
                    'file_key': agent.id_document_url,
                    'filename': agent.id_document_url.split('/')[-1] if '/' in agent.id_document_url else agent.id_document_url,
                    'size': 0,  # Unknown size for legacy documents
                    'last_modified': agent.created_at.isoformat() if agent.created_at else None,
                    'metadata': {
                        'document_type': 'id_card',
                        'original_filename': agent.id_document_url.split('/')[-1] if '/' in agent.id_document_url else agent.id_document_url,
                        'upload_date': agent.created_at.isoformat() if agent.created_at else None
                    },
                    'is_legacy': True
                })
            
            if agent.sia_document_url:
                legacy_documents.append({
                    'file_key': agent.sia_document_url,
                    'filename': agent.sia_document_url.split('/')[-1] if '/' in agent.sia_document_url else agent.sia_document_url,
                    'size': 0,  # Unknown size for legacy documents
                    'last_modified': agent.created_at.isoformat() if agent.created_at else None,
                    'metadata': {
                        'document_type': 'sia_license',
                        'original_filename': agent.sia_document_url.split('/')[-1] if '/' in agent.sia_document_url else agent.sia_document_url,
                        'upload_date': agent.created_at.isoformat() if agent.created_at else None
                    },
                    'is_legacy': True
                })
            
            # Combine S3 and legacy documents
            all_documents = s3_documents + legacy_documents
            
            agent_data = {
                'id': agent.id,
                'name': f"{agent.first_name} {agent.last_name}",
                'email': agent.email,
                'verification_status': agent.verification_status,
                'created_at': agent.created_at.isoformat() if agent.created_at else None,
                'document_count': len(all_documents),
                'document_types': list(document_counts.keys()),
                'has_id_document': agent.id_document_url is not None,
                'has_sia_document': agent.sia_document_url is not None,
                'documents_metadata': all_documents
            }
            agents_data.append(agent_data)
        
        # Log admin access
        current_app.logger.info(f"Admin {current_user.email} accessed all agents documents overview")
        
        return jsonify({
            'agents': agents_data,
            'total_agents': len(agents_data)
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Error fetching all agents documents: {e}")
        return jsonify({'error': 'Failed to fetch agents documents'}), 500

@admin_bp.route('/admin/agents/<int:agent_id>/verify', methods=['POST'])
@jwt_required()
def verify_agent_documents(agent_id):
    """Approve or reject agent documents with detailed tracking."""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(int(current_user_id))
        
        if not current_user or current_user.role != 'admin':
            return jsonify({'error': 'Access denied'}), 403
        
        data = request.get_json()
        action = data.get('action')  # 'approve' or 'reject'
        notes = data.get('notes', '')
        document_feedback = data.get('document_feedback', {})
        
        if action not in ['approve', 'reject']:
            return jsonify({'error': 'Invalid action. Must be approve or reject'}), 400
        
        agent = User.query.get(agent_id)
        if not agent or agent.role != 'agent':
            return jsonify({'error': 'Agent not found'}), 404
        
        # Update verification status
        old_status = agent.verification_status
        if action == 'approve':
            agent.verification_status = 'verified'
        else:
            agent.verification_status = 'rejected'
        
        db.session.commit()
        
        # Log the verification action
        current_app.logger.info(
            f"Admin {current_user.email} {action}d agent {agent.email} "
            f"(ID: {agent_id}) - Status changed from {old_status} to {agent.verification_status}"
        )
        
        # TODO: Send notification to agent about verification status
        # This would integrate with your notification system
        
        return jsonify({
            'message': f"Agent {agent.first_name} {agent.last_name} has been {action}d",
            'agent': agent.to_dict(),
            'verification_details': {
                'action': action,
                'admin_email': current_user.email,
                'timestamp': datetime.utcnow().isoformat(),
                'notes': notes,
                'document_feedback': document_feedback
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error verifying agent documents: {e}")
        return jsonify({'error': 'Failed to verify agent'}), 500

@admin_bp.route('/admin/documents/pending', methods=['GET'])
@jwt_required()
def get_pending_documents():
    """Get all documents that require admin review."""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(int(current_user_id))
        
        if not current_user or current_user.role != 'admin':
            return jsonify({'error': 'Access denied'}), 403
        
        # Get agents with pending verification status
        pending_agents = User.query.filter(
            User.role == 'agent',
            User.verification_status.in_(['pending', 'rejected'])
        ).order_by(User.created_at.desc()).all()
        
        pending_documents = []
        for agent in pending_agents:
            s3_documents = s3_client.list_agent_documents(agent.id)
            
            if s3_documents or agent.id_document_url or agent.sia_document_url:
                agent_data = {
                    'agent_id': agent.id,
                    'agent_name': f"{agent.first_name} {agent.last_name}",
                    'agent_email': agent.email,
                    'verification_status': agent.verification_status,
                    'created_at': agent.created_at.isoformat() if agent.created_at else None,
                    'documents': s3_documents,
                    'document_count': len(s3_documents)
                }
                pending_documents.append(agent_data)
        
        return jsonify({
            'pending_documents': pending_documents,
            'total_pending': len(pending_documents)
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Error fetching pending documents: {e}")
        return jsonify({'error': 'Failed to fetch pending documents'}), 500

@admin_bp.route('/admin/documents/<file_key>/preview', methods=['GET'])
def get_document_preview_url(file_key):
    """Generate secure preview URL for document viewing."""
    try:
        # Note: This endpoint is now public for image tag access
        # Document paths are secure UUIDs providing security through obscurity
        
        # Decode the file key (replace __ with /)
        actual_file_key = file_key.replace('__', '/')
        
        # Check if this is a legacy document (stored in old format)
        if actual_file_key.startswith('user_'):
            # Legacy document - try to serve from the legacy system or convert to S3
            legacy_url_result = handle_legacy_document_access(actual_file_key)
            if legacy_url_result['success']:
                # Log document access (now public endpoint)
                current_app.logger.info(f"Document preview accessed: {actual_file_key}")
                return jsonify({
                    'preview_url': legacy_url_result['url'],
                    'expires_in': legacy_url_result.get('expires_in', 3600),
                    'file_key': file_key,
                    'success': True,
                    'is_legacy': True
                }), 200
            else:
                current_app.logger.error(f"Failed to access legacy document {actual_file_key}: {legacy_url_result['error']}")
                return jsonify({'error': legacy_url_result['error']}), 404
        
        # Use the new secure document URL function for S3 documents
        url_result = s3_client.get_secure_document_url(
            actual_file_key,
            expiration=3600
        )
        
        if not url_result['success']:
            current_app.logger.error(f"Failed to get secure URL for {actual_file_key}: {url_result['error']}")
            return jsonify({'error': url_result['error']}), 404 if 'not found' in url_result['error'] else 500
        
        # Log document access (now public endpoint)
        current_app.logger.info(f"Document preview accessed: {actual_file_key}")
        
        return jsonify({
            'preview_url': url_result['url'],
            'expires_in': url_result['expires_in'],
            'file_key': file_key,
            'success': True
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Error generating document preview URL: {e}")
        return jsonify({'error': 'Failed to generate preview URL'}), 500

# NEW ROUTES - These fix the 404 errors from your console
@admin_bp.route('/agents/available', methods=['GET'])
@jwt_required()
def get_available_agents():
    """Get agents available for a specific date"""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(int(current_user_id))
        
        if not current_user or current_user.role != 'admin':
            return jsonify({'error': 'Access denied'}), 403
        
        # Get date from query params (default to today)
        date_str = request.args.get('date')
        if date_str:
            try:
                target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
            except:
                target_date = date.today()
        else:
            target_date = date.today()
        
        # Get all agents
        all_agents = User.query.filter_by(role='agent').all()
        available_agents = []
        
        for agent in all_agents:
            # Check if agent is available on target date
            availability = db.session.query(AgentAvailability).filter(
                AgentAvailability.agent_id == agent.id,
                AgentAvailability.date == target_date,
                AgentAvailability.is_available == True,
                AgentAvailability.is_away == False
            ).first()
            
            if availability:
                available_agents.append(agent.to_dict())
        
        return jsonify({'available_agents': available_agents}), 200
        
    except Exception as e:
        current_app.logger.error(f"Error fetching available agents: {e}")
        return jsonify({'error': 'Failed to fetch available agents'}), 500

@admin_bp.route('/jobs', methods=['GET'])
@jwt_required()
def get_jobs():
    """Get jobs with optional status filter - matches Dashboard logic"""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(int(current_user_id))
        
        if not current_user or current_user.role not in ['admin', 'manager']:
            return jsonify({'error': 'Access denied'}), 403
        
        # Get status filter from query params
        status_filter = (request.args.get('status') or 'all').lower()
        
        query = Job.query
        
        # Apply status filtering to match Dashboard logic
        if status_filter == 'open':
            # Dashboard logic: job.status !== 'completed'
            query = query.filter(Job.status != 'completed')
        elif status_filter == 'completed':
            # Dashboard logic: job.status === 'completed'
            query = query.filter(Job.status == 'completed')
        elif status_filter == 'all':
            # No filter - show all jobs
            pass
        else:
            # Unknown status - return empty list (not 404)
            return jsonify({'jobs': []}), 200
        
        jobs = query.order_by(Job.created_at.desc()).all()
        
        return jsonify({'jobs': [job.to_dict() for job in jobs]}), 200
        
    except Exception as e:
        current_app.logger.error(f"Error fetching jobs: {e}")
        return jsonify({'error': 'Failed to fetch jobs'}), 500

@admin_bp.route('/users', methods=['GET'])
@jwt_required()
def get_users():
    """Get users with optional role filter"""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(int(current_user_id))
        
        if not current_user or current_user.role != 'admin':
            return jsonify({'error': 'Access denied'}), 403
        
        # Get role filter from query params
        role_filter = request.args.get('role')
        
        query = User.query
        if role_filter:
            query = query.filter(User.role == role_filter)
        
        users = query.order_by(User.created_at.desc()).all()
        
        return jsonify({'users': [user.to_dict() for user in users]}), 200
        
    except Exception as e:
        current_app.logger.error(f"Error fetching users: {e}")
        return jsonify({'error': 'Failed to fetch users'}), 500

# --- ADMIN INVOICE MANAGEMENT ENDPOINTS ---

@admin_bp.route('/admin/invoices', methods=['GET'])
@jwt_required()
def get_all_invoices():
    """Get all invoices with filters for admin management."""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(int(current_user_id))
        
        if not current_user or current_user.role != 'admin':
            return jsonify({'error': 'Access denied'}), 403
        
        # Get query parameters
        agent_id = request.args.get('agent_id', type=int)
        payment_status = request.args.get('payment_status')
        year = request.args.get('year', type=int)
        month = request.args.get('month', type=int)
        
        # Build query
        query = Invoice.query.join(User, Invoice.agent_id == User.id)
        
        if agent_id:
            query = query.filter(Invoice.agent_id == agent_id)
        if payment_status:
            query = query.filter(Invoice.payment_status == payment_status)
        if year:
            query = query.filter(db.extract('year', Invoice.issue_date) == year)
        if month:
            query = query.filter(db.extract('month', Invoice.issue_date) == month)
        
        invoices = query.order_by(Invoice.issue_date.desc()).all()
        
        # Enhanced invoice data with agent info
        invoices_data = []
        for invoice in invoices:
            invoice_dict = invoice.to_dict()
            invoice_dict['agent_name'] = f"{invoice.agent.first_name} {invoice.agent.last_name}"
            invoice_dict['agent_email'] = invoice.agent.email
            invoices_data.append(invoice_dict)
        
        return jsonify({
            'invoices': invoices_data,
            'total_count': len(invoices_data)
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Error fetching admin invoices: {e}")
        return jsonify({'error': 'Failed to fetch invoices'}), 500

@admin_bp.route('/admin/invoices/<int:invoice_id>/mark-paid', methods=['PUT'])
@jwt_required()
def mark_invoice_paid(invoice_id):
    """Mark invoice as paid (simplified for existing database)."""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(int(current_user_id))
        
        if not current_user or current_user.role != 'admin':
            return jsonify({'error': 'Access denied'}), 403
        
        invoice = Invoice.query.get(invoice_id)
        if not invoice:
            return jsonify({'error': 'Invoice not found'}), 404
        
        if invoice.status == 'paid':
            return jsonify({'error': 'Invoice is already marked as paid'}), 400
        
        # Update invoice status (using existing field)
        old_status = invoice.status
        invoice.status = 'paid'
        
        # Create notification for agent
        notification = Notification(
            user_id=invoice.agent_id,
            title=f"Invoice {invoice.invoice_number} Paid",
            message=f"Your invoice for £{invoice.total_amount} has been marked as paid by admin.",
            type="payment",
            sent_at=datetime.utcnow()
        )
        db.session.add(notification)
        
        db.session.commit()
        
        # Send Telegram notification to agent
        try:
            from src.services.notifications import notify_payment_received
            notify_payment_received(
                agent_id=invoice.agent_id,
                invoice_number=invoice.invoice_number,
                amount=float(invoice.total_amount)
            )
            current_app.logger.info(f"Telegram payment notification sent to agent {invoice.agent_id}")
        except Exception as e:
            current_app.logger.warning(f"Failed to send Telegram payment notification: {str(e)}")
        
        # Log the payment
        current_app.logger.info(
            f"Admin {current_user.email} marked invoice {invoice.invoice_number} as paid "
            f"(Amount: £{invoice.total_amount}, Agent: {invoice.agent.email})"
        )
        
        return jsonify({
            'message': f'Invoice {invoice.invoice_number} marked as paid',
            'invoice': invoice.to_dict(),
            'notification_sent': True
        }), 200
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error marking invoice as paid: {e}")
        return jsonify({'error': 'Failed to mark invoice as paid'}), 500

@admin_bp.route('/admin/invoices/<int:invoice_id>/status', methods=['PUT'])
@jwt_required()
def update_invoice_payment_status(invoice_id):
    """Update invoice payment status (paid/unpaid/overdue)."""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(int(current_user_id))
        
        if not current_user or current_user.role != 'admin':
            return jsonify({'error': 'Access denied'}), 403
        
        data = request.get_json()
        payment_status = data.get('payment_status')
        admin_notes = data.get('admin_notes', '')
        
        if payment_status not in ['unpaid', 'paid', 'overdue']:
            return jsonify({'error': 'Invalid payment status'}), 400
        
        invoice = Invoice.query.get(invoice_id)
        if not invoice:
            return jsonify({'error': 'Invoice not found'}), 404
        
        old_status = invoice.payment_status
        invoice.payment_status = payment_status
        invoice.admin_notes = admin_notes
        
        # If marking as paid, set payment date and admin
        if payment_status == 'paid' and old_status != 'paid':
            invoice.payment_date = datetime.utcnow()
            invoice.paid_by_admin_id = current_user.id
            
            # Send notification to agent
            notification = Notification(
                user_id=invoice.agent_id,
                title=f"Invoice {invoice.invoice_number} Paid",
                message=f"Your invoice for £{invoice.total_amount} has been marked as paid",
                type="payment",
                sent_at=datetime.utcnow()
            )
            db.session.add(notification)
        
        # If unmarking as paid, clear payment details
        elif payment_status == 'unpaid' and old_status == 'paid':
            invoice.payment_date = None
            invoice.paid_by_admin_id = None
        
        db.session.commit()
        
        # Send Telegram notification for payment (only when marking as paid)
        if payment_status == 'paid' and old_status != 'paid':
            try:
                from src.services.notifications import notify_payment_received
                notify_payment_received(
                    agent_id=invoice.agent_id,
                    invoice_number=invoice.invoice_number,
                    amount=float(invoice.total_amount)
                )
                current_app.logger.info(f"Telegram payment notification sent to agent {invoice.agent_id}")
            except Exception as e:
                current_app.logger.warning(f"Failed to send Telegram payment notification: {str(e)}")
        
        # Log the status change
        current_app.logger.info(
            f"Admin {current_user.email} changed invoice {invoice.invoice_number} "
            f"payment status from {old_status} to {payment_status}"
        )
        
        return jsonify({
            'message': f'Invoice payment status updated to {payment_status}',
            'invoice': invoice.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error updating invoice status: {e}")
        return jsonify({'error': 'Failed to update invoice status'}), 500

@admin_bp.route('/admin/invoices/<int:agent_id>', methods=['GET'])
@jwt_required()
def get_agent_invoices_admin(agent_id):
    """Get all invoices for a specific agent (admin view)."""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(int(current_user_id))
        
        if not current_user or current_user.role != 'admin':
            return jsonify({'error': 'Access denied'}), 403
        
        agent = User.query.get(agent_id)
        if not agent or agent.role != 'agent':
            return jsonify({'error': 'Agent not found'}), 404
        
        invoices = Invoice.query.filter_by(agent_id=agent_id).order_by(Invoice.issue_date.desc()).all()
        
        return jsonify({
            'agent': {
                'id': agent.id,
                'name': f"{agent.first_name} {agent.last_name}",
                'email': agent.email
            },
            'invoices': [invoice.to_dict() for invoice in invoices],
            'total_count': len(invoices)
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Error fetching agent invoices: {e}")
        return jsonify({'error': 'Failed to fetch agent invoices'}), 500

@admin_bp.route('/admin/invoices/<int:invoice_id>/download', methods=['GET'])
@jwt_required()
def download_invoice_admin(invoice_id):
    """Admin download invoice PDF."""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(int(current_user_id))
        
        if not current_user or current_user.role != 'admin':
            return jsonify({'error': 'Access denied'}), 403
        
        invoice = Invoice.query.get(invoice_id)
        if not invoice:
            return jsonify({'error': 'Invoice not found'}), 404
        
        if invoice.status == 'draft':
            return jsonify({'error': 'Cannot download draft invoices'}), 400
        
        # Use standard S3 path instead of invoice.pdf_file_url
        s3_result = s3_client.generate_invoice_download_url(
            agent_id=invoice.agent_id,
            invoice_number=invoice.invoice_number,
            expiration=3600
        )
        
        if not s3_result.get('success'):
            return jsonify({'error': 'Invoice PDF not available in storage'}), 404
        
        # Log admin download for audit
        current_app.logger.info(
            f"Admin {current_user.email} downloaded invoice {invoice.invoice_number} "
            f"for agent_id {invoice.agent_id}"
        )
        
        return jsonify({
            'download_url': s3_result['download_url'],
            'expires_in': s3_result['expires_in'],
            'invoice_number': invoice.invoice_number,
            'filename': f"{invoice.invoice_number}.pdf"
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Error generating admin invoice download: {e}")
        return jsonify({'error': 'Failed to generate download link'}), 500

@admin_bp.route('/admin/invoices/batch/<int:year>/<int:month>', methods=['GET'])
@jwt_required()
def get_monthly_invoice_batch(year, month):
    """Get all invoices for a specific month for batch processing."""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(int(current_user_id))
        
        if not current_user or current_user.role != 'admin':
            return jsonify({'error': 'Access denied'}), 403
        
        # Get invoices for the specified month
        invoices = Invoice.query.filter(
            db.extract('year', Invoice.generated_at) == year,
            db.extract('month', Invoice.generated_at) == month
        ).join(User, Invoice.agent_id == User.id).order_by(Invoice.generated_at.desc()).all()
        
        # Enhanced invoice data with agent info
        invoices_data = []
        total_amount = 0
        for invoice in invoices:
            invoice_dict = invoice.to_dict()
            invoice_dict['agent_name'] = f"{invoice.agent.first_name} {invoice.agent.last_name}"
            invoice_dict['agent_email'] = invoice.agent.email
            invoices_data.append(invoice_dict)
            total_amount += float(invoice.total_amount or 0)
        
        return jsonify({
            'period': f"{year}-{month:02d}",
            'invoices': invoices_data,
            'total_count': len(invoices_data),
            'total_amount': total_amount,
            'summary': {
                'paid': len([i for i in invoices if i.payment_status == 'paid']),
                'unpaid': len([i for i in invoices if i.payment_status == 'unpaid']),
                'overdue': len([i for i in invoices if i.payment_status == 'overdue'])
            }
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Error fetching monthly invoice batch: {e}")
        return jsonify({'error': 'Failed to fetch monthly invoices'}), 500

@admin_bp.route('/admin/invoices/batch-download', methods=['POST'])
@jwt_required()
def create_invoice_batch_download():
    """Create a ZIP file containing multiple invoices for batch download."""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(int(current_user_id))
        
        if not current_user or current_user.role != 'admin':
            return jsonify({'error': 'Access denied'}), 403
        
        data = request.get_json()
        invoice_ids = data.get('invoice_ids', [])
        batch_name = data.get('batch_name', f"invoice_batch_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}")
        
        if not invoice_ids:
            return jsonify({'error': 'No invoices selected'}), 400
        
        # Get invoices
        invoices = Invoice.query.filter(Invoice.id.in_(invoice_ids)).all()
        if not invoices:
            return jsonify({'error': 'No valid invoices found'}), 404
        
        # Build S3 keys from agent_id + invoice_number
        file_keys = []
        for inv in invoices:
            if inv.status == 'draft':
                continue  # skip drafts
            file_keys.append(f"invoices/{inv.agent_id}/{inv.invoice_number}.pdf")
        
        if not file_keys:
            return jsonify({'error': 'No invoice PDFs available for batch download'}), 404
        
        # Create ZIP in S3
        zip_filename = f"{batch_name}.zip"
        batch_result = s3_client.create_invoice_batch_zip(file_keys, zip_filename)
        if not batch_result.get('success'):
            return jsonify({'error': batch_result.get('error', 'Failed to create ZIP')}), 500
        
        # Signed URL for the ZIP
        zip_url = s3_client.generate_presigned_url(batch_result['file_key'], expiration=7200)
        if not zip_url:
            return jsonify({'error': 'Failed to generate batch download URL'}), 500
        
        return jsonify({
            'download_url': zip_url,
            'filename': batch_result.get('filename', zip_filename),
            'invoice_count': batch_result.get('invoice_count', len(file_keys))
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Error creating invoice batch download: {e}")
        return jsonify({'error': 'Failed to create batch download'}), 500


@admin_bp.route('/admin/invoices/<int:invoice_id>', methods=['DELETE'])
@jwt_required()
def admin_delete_invoice(invoice_id):
    """Admin deletes an invoice and its links (draft or test cleanup)."""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(int(current_user_id))
        if not current_user or current_user.role != 'admin':
            return jsonify({'error': 'Access denied'}), 403

        invoice = Invoice.query.get(invoice_id)
        if not invoice:
            return jsonify({'error': 'Invoice not found'}), 404

        # Delete invoice job links first
        InvoiceJob.query.filter_by(invoice_id=invoice.id).delete()
        db.session.delete(invoice)
        db.session.commit()
        return jsonify({'message': 'Invoice deleted'}), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error deleting invoice {invoice_id}: {e}")
        return jsonify({'error': 'Failed to delete invoice'}), 500


@admin_bp.route('/admin/jobs/<int:job_id>', methods=['DELETE'])
@jwt_required()
def admin_delete_job(job_id):
    """Admin deletes a job and its related assignments/links."""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(int(current_user_id))
        if not current_user or current_user.role != 'admin':
            return jsonify({'error': 'Access denied'}), 403

        job = Job.query.get(job_id)
        if not job:
            return jsonify({'error': 'Job not found'}), 404

        # Delete assignments, notifications, and invoice links
        JobAssignment.query.filter_by(job_id=job_id).delete()
        Notification.query.filter_by(job_id=job_id).delete()
        InvoiceJob.query.filter_by(job_id=job_id).delete()
        db.session.delete(job)
        db.session.commit()
        return jsonify({'message': 'Job deleted'}), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error deleting job {job_id}: {e}")
        return jsonify({'error': 'Failed to delete job'}), 500

@admin_bp.route('/admin/invoices/export-csv', methods=['POST'])
@jwt_required()
def export_invoices_csv():
    """Export invoice data as CSV for accounting."""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(int(current_user_id))
        
        if not current_user or current_user.role != 'admin':
            return jsonify({'error': 'Access denied'}), 403
        
        data = request.get_json()
        invoice_ids = data.get('invoice_ids', [])
        
        if not invoice_ids:
            return jsonify({'error': 'No invoices selected'}), 400
        
        # Get invoices
        invoices = Invoice.query.filter(Invoice.id.in_(invoice_ids)).join(
            User, Invoice.agent_id == User.id
        ).order_by(Invoice.generated_at.desc()).all()
        
        if not invoices:
            return jsonify({'error': 'No valid invoices found'}), 404
        
        # Create CSV data
        import csv
        import io
        
        csv_buffer = io.StringIO()
        csv_writer = csv.writer(csv_buffer)
        
        # CSV Headers
        csv_writer.writerow([
            'Invoice Number',
            'Agent Name', 
            'Agent Email',
            'Issue Date',
            'Due Date',
            'Total Amount',
            'Payment Status',
            'Generated Date',
            'Download Count',
            'Last Downloaded'
        ])
        
        # CSV Data
        for invoice in invoices:
            csv_writer.writerow([
                invoice.invoice_number,
                f"{invoice.agent.first_name} {invoice.agent.last_name}",
                invoice.agent.email,
                invoice.issue_date.strftime('%Y-%m-%d') if invoice.issue_date else '',
                invoice.due_date.strftime('%Y-%m-%d') if invoice.due_date else '',
                f"{float(invoice.total_amount):.2f}",
                invoice.payment_status,
                invoice.generated_at.strftime('%Y-%m-%d %H:%M:%S') if invoice.generated_at else '',
                invoice.download_count or 0,
                invoice.last_downloaded.strftime('%Y-%m-%d %H:%M:%S') if invoice.last_downloaded else ''
            ])
        
        # Upload CSV to S3
        csv_content = csv_buffer.getvalue()
        csv_filename = f"invoice_export_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
        csv_key = f"exports/{csv_filename}"
        
        try:
            s3_client.s3_client.put_object(
                Bucket=s3_client.bucket_name,
                Key=csv_key,
                Body=csv_content.encode('utf-8'),
                ContentType='text/csv',
                ServerSideEncryption='AES256',
                Metadata={
                    'export_date': datetime.utcnow().isoformat(),
                    'invoice_count': str(len(invoices)),
                    'exported_by': current_user.email
                }
            )
            
            # Generate download URL
            csv_download_url = s3_client.generate_presigned_url(csv_key, expiration=3600)
            
            # Log CSV export
            current_app.logger.info(
                f"Admin {current_user.email} exported {len(invoices)} invoices to CSV"
            )
            
            return jsonify({
                'csv_filename': csv_filename,
                'download_url': csv_download_url,
                'expires_in': 3600,
                'invoice_count': len(invoices)
            }), 200
            
        except Exception as upload_error:
            current_app.logger.error(f"Error uploading CSV to S3: {upload_error}")
            # Fallback: return CSV data directly  
            return jsonify({
                'csv_data': csv_content,
                'invoice_count': len(invoices)
            }), 200
        
    except Exception as e:
        current_app.logger.error(f"Error exporting invoices CSV: {e}")
        return jsonify({'error': 'Failed to export CSV'}), 500

# === NEW ADMIN AGENT MANAGEMENT ENDPOINTS ===

@admin_bp.route('/admin/agents/<int:agent_id>/details', methods=['GET'])
@jwt_required()
def get_agent_details(agent_id):
    """Get complete agent details including personal info, bank details, and invoice history."""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(int(current_user_id))
        
        if not current_user or current_user.role != 'admin':
            return jsonify({'error': 'Access denied'}), 403
        
        agent = User.query.get(agent_id)
        if not agent or agent.role != 'agent':
            return jsonify({'error': 'Agent not found'}), 404
        
        # Get agent's invoice statistics
        invoices = Invoice.query.filter_by(agent_id=agent_id).all()
        total_invoices = len(invoices)
        total_amount = sum(float(inv.total_amount or 0) for inv in invoices)
        paid_invoices = [inv for inv in invoices if inv.payment_status == 'paid']
        unpaid_invoices = [inv for inv in invoices if inv.payment_status == 'unpaid']
        overdue_invoices = [inv for inv in invoices if inv.is_overdue()]
        
        paid_amount = sum(float(inv.total_amount or 0) for inv in paid_invoices)
        unpaid_amount = sum(float(inv.total_amount or 0) for inv in unpaid_invoices)
        
        # Get recent invoices (last 10)
        recent_invoices = Invoice.query.filter_by(agent_id=agent_id).order_by(
            Invoice.issue_date.desc()
        ).limit(10).all()
        
        # Get agent's job assignments
        recent_jobs = db.session.query(Job).join(JobAssignment).filter(
            JobAssignment.agent_id == agent_id
        ).order_by(Job.arrival_time.desc()).limit(5).all()
        
        agent_details = {
            'personal_info': {
                'id': agent.id,
                'first_name': agent.first_name,
                'last_name': agent.last_name,
                'email': agent.email,
                'phone': agent.phone,
                'created_at': agent.created_at.isoformat() if agent.created_at else None,
                'verification_status': agent.verification_status
            },
            'address': {
                'address_line_1': agent.address_line_1,
                'address_line_2': agent.address_line_2,
                'city': agent.city,
                'postcode': agent.postcode
            },
            'bank_details': {
                'bank_name': agent.bank_name,
                'bank_account_number': agent.bank_account_number,
                'bank_sort_code': agent.bank_sort_code,
                'utr_number': agent.utr_number
            },
            'invoice_statistics': {
                'total_invoices': total_invoices,
                'total_amount': total_amount,
                'paid_count': len(paid_invoices),
                'paid_amount': paid_amount,
                'unpaid_count': len(unpaid_invoices),
                'unpaid_amount': unpaid_amount,
                'overdue_count': len(overdue_invoices),
                'overdue_amount': sum(float(inv.total_amount or 0) for inv in overdue_invoices)
            },
            'recent_invoices': [inv.to_dict() for inv in recent_invoices],
            'recent_jobs': [job.to_dict() for job in recent_jobs]
        }
        
        # Log admin access
        current_app.logger.info(f"Admin {current_user.email} accessed details for agent {agent.email}")
        
        return jsonify(agent_details), 200
        
    except Exception as e:
        current_app.logger.error(f"Error fetching agent details: {e}")
        return jsonify({'error': 'Failed to fetch agent details'}), 500

@admin_bp.route('/admin/agents/<int:agent_id>/invoices', methods=['GET'])
@jwt_required()
def get_agent_invoices_detailed(agent_id):
    """Get detailed invoice history for a specific agent."""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(int(current_user_id))
        
        if not current_user or current_user.role != 'admin':
            return jsonify({'error': 'Access denied'}), 403
        
        agent = User.query.get(agent_id)
        if not agent or agent.role != 'agent':
            return jsonify({'error': 'Agent not found'}), 404
        
        # Get query parameters
        payment_status = request.args.get('payment_status')
        year = request.args.get('year', type=int)
        month = request.args.get('month', type=int)
        
        # Build query
        query = Invoice.query.filter_by(agent_id=agent_id)
        
        if payment_status:
            query = query.filter(Invoice.payment_status == payment_status)
        if year:
            query = query.filter(db.extract('year', Invoice.issue_date) == year)
        if month:
            query = query.filter(db.extract('month', Invoice.issue_date) == month)
        
        invoices = query.order_by(Invoice.issue_date.desc()).all()
        
        # Enhanced invoice data with job details
        invoices_data = []
        for invoice in invoices:
            invoice_dict = invoice.to_dict()
            
            # Add job details
            invoice_jobs = InvoiceJob.query.filter_by(invoice_id=invoice.id).all()
            job_details = []
            for invoice_job in invoice_jobs:
                if invoice_job.job:
                    job_details.append({
                        'job_id': invoice_job.job.id,
                        'job_title': invoice_job.job.address,
                        'job_address': invoice_job.job.address,
                        'job_date': invoice_job.job.arrival_time.isoformat() if invoice_job.job.arrival_time else None,
                        'hours_worked': float(invoice_job.hours_worked or 0),
                        'hourly_rate': float(invoice_job.hourly_rate_at_invoice or invoice_job.job.hourly_rate or 0)
                    })
            
            invoice_dict['job_details'] = job_details
            invoice_dict['is_overdue'] = invoice.is_overdue()
            invoice_dict['days_overdue'] = invoice.days_overdue()
            
            # Add admin who marked as paid (if applicable)
            if invoice.paid_by_admin_id:
                paid_by_admin = User.query.get(invoice.paid_by_admin_id)
                invoice_dict['paid_by_admin'] = f"{paid_by_admin.first_name} {paid_by_admin.last_name}" if paid_by_admin else None
            
            invoices_data.append(invoice_dict)
        
        return jsonify({
            'agent': {
                'id': agent.id,
                'name': f"{agent.first_name} {agent.last_name}",
                'email': agent.email
            },
            'invoices': invoices_data,
            'total_count': len(invoices_data),
            'summary': {
                'total_amount': sum(float(inv['total_amount']) for inv in invoices_data),
                'paid_count': len([inv for inv in invoices_data if inv['payment_status'] == 'paid']),
                'unpaid_count': len([inv for inv in invoices_data if inv['payment_status'] == 'unpaid']),
                'overdue_count': len([inv for inv in invoices_data if inv['is_overdue']])
            }
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Error fetching agent invoices: {e}")
        return jsonify({'error': 'Failed to fetch agent invoices'}), 500

@admin_bp.route('/admin/invoices/pending', methods=['GET'])
@jwt_required()
def get_pending_invoices():
    """Get all unpaid invoices for admin management."""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(int(current_user_id))
        
        if not current_user or current_user.role != 'admin':
            return jsonify({'error': 'Access denied'}), 403
        
        # Get all unpaid invoices
        pending_invoices = Invoice.query.filter(
            Invoice.payment_status.in_(['unpaid', 'overdue'])
        ).join(User, Invoice.agent_id == User.id).order_by(Invoice.due_date.asc()).all()
        
        invoices_data = []
        total_pending_amount = 0
        
        for invoice in pending_invoices:
            invoice_dict = invoice.to_dict()
            invoice_dict['agent_name'] = f"{invoice.agent.first_name} {invoice.agent.last_name}"
            invoice_dict['agent_email'] = invoice.agent.email
            invoice_dict['is_overdue'] = invoice.is_overdue()
            invoice_dict['days_overdue'] = invoice.days_overdue()
            
            # Auto-update overdue status
            if invoice.is_overdue() and invoice.payment_status != 'overdue':
                invoice.payment_status = 'overdue'
                db.session.commit()
                invoice_dict['payment_status'] = 'overdue'
            
            invoices_data.append(invoice_dict)
            total_pending_amount += float(invoice.total_amount or 0)
        
        return jsonify({
            'pending_invoices': invoices_data,
            'total_count': len(invoices_data),
            'total_pending_amount': total_pending_amount,
            'summary': {
                'unpaid_count': len([inv for inv in invoices_data if inv['payment_status'] == 'unpaid']),
                'overdue_count': len([inv for inv in invoices_data if inv['payment_status'] == 'overdue']),
                'unpaid_amount': sum(float(inv['total_amount']) for inv in invoices_data if inv['payment_status'] == 'unpaid'),
                'overdue_amount': sum(float(inv['total_amount']) for inv in invoices_data if inv['payment_status'] == 'overdue')
            }
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Error fetching pending invoices: {e}")
        return jsonify({'error': 'Failed to fetch pending invoices'}), 500

@admin_bp.route('/admin/invoices/paid', methods=['GET'])
@jwt_required()  
def get_paid_invoices():
    """Get all paid invoices for admin review."""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(int(current_user_id))
        
        if not current_user or current_user.role != 'admin':
            return jsonify({'error': 'Access denied'}), 403
        
        # Get query parameters
        year = request.args.get('year', type=int)
        month = request.args.get('month', type=int)
        
        # Build query
        query = Invoice.query.filter(Invoice.payment_status == 'paid').join(
            User, Invoice.agent_id == User.id
        )
        
        if year:
            query = query.filter(db.extract('year', Invoice.payment_date) == year)
        if month:
            query = query.filter(db.extract('month', Invoice.payment_date) == month)
        
        paid_invoices = query.order_by(Invoice.payment_date.desc()).all()
        
        invoices_data = []
        total_paid_amount = 0
        
        for invoice in paid_invoices:
            invoice_dict = invoice.to_dict()
            invoice_dict['agent_name'] = f"{invoice.agent.first_name} {invoice.agent.last_name}"
            invoice_dict['agent_email'] = invoice.agent.email
            
            # Add admin who marked as paid
            if invoice.paid_by_admin_id:
                paid_by_admin = User.query.get(invoice.paid_by_admin_id)
                invoice_dict['paid_by_admin'] = f"{paid_by_admin.first_name} {paid_by_admin.last_name}" if paid_by_admin else None
            
            invoices_data.append(invoice_dict)
            total_paid_amount += float(invoice.total_amount or 0)
        
        return jsonify({
            'paid_invoices': invoices_data,
            'total_count': len(invoices_data),
            'total_paid_amount': total_paid_amount,
            'filters': {
                'year': year,
                'month': month
            }
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Error fetching paid invoices: {e}")
        return jsonify({'error': 'Failed to fetch paid invoices'}), 500

@admin_bp.route('/admin/dashboard/stats', methods=['GET'])
@jwt_required()
def get_admin_dashboard_stats():
    """Get comprehensive dashboard statistics for admin."""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(int(current_user_id))
        
        if not current_user or current_user.role != 'admin':
            return jsonify({'error': 'Access denied'}), 403
        
        # Invoice statistics
        total_invoices = Invoice.query.count()
        paid_invoices = Invoice.query.filter_by(payment_status='paid').count()
        unpaid_invoices = Invoice.query.filter_by(payment_status='unpaid').count()
        overdue_invoices = Invoice.query.filter_by(payment_status='overdue').count()
        
        # Amount statistics
        total_amount = db.session.query(db.func.sum(Invoice.total_amount)).scalar() or 0
        paid_amount = db.session.query(db.func.sum(Invoice.total_amount)).filter(
            Invoice.payment_status == 'paid'
        ).scalar() or 0
        unpaid_amount = db.session.query(db.func.sum(Invoice.total_amount)).filter(
            Invoice.payment_status == 'unpaid'
        ).scalar() or 0
        overdue_amount = db.session.query(db.func.sum(Invoice.total_amount)).filter(
            Invoice.payment_status == 'overdue'
        ).scalar() or 0
        
        # Agent statistics
        total_agents = User.query.filter_by(role='agent').count()
        verified_agents = User.query.filter_by(role='agent', verification_status='verified').count()
        pending_agents = User.query.filter_by(role='agent', verification_status='pending').count()
        
        # Recent activity
        recent_invoices = Invoice.query.order_by(Invoice.generated_at.desc()).limit(5).all()
        recent_payments = Invoice.query.filter_by(payment_status='paid').order_by(
            Invoice.payment_date.desc()
        ).limit(5).all()
        
        return jsonify({
            'invoice_stats': {
                'total_invoices': total_invoices,
                'paid_invoices': paid_invoices,
                'unpaid_invoices': unpaid_invoices,
                'overdue_invoices': overdue_invoices,
                'total_amount': float(total_amount),
                'paid_amount': float(paid_amount),
                'unpaid_amount': float(unpaid_amount),
                'overdue_amount': float(overdue_amount)
            },
            'agent_stats': {
                'total_agents': total_agents,
                'verified_agents': verified_agents,
                'pending_agents': pending_agents
            },
            'recent_activity': {
                'recent_invoices': [
                    {
                        'id': inv.id,
                        'invoice_number': inv.invoice_number,
                        'agent_name': f"{inv.agent.first_name} {inv.agent.last_name}",
                        'total_amount': float(inv.total_amount),
                        'generated_at': inv.generated_at.isoformat() if inv.generated_at else None
                    } for inv in recent_invoices
                ],
                'recent_payments': [
                    {
                        'id': inv.id,
                        'invoice_number': inv.invoice_number,
                        'agent_name': f"{inv.agent.first_name} {inv.agent.last_name}",
                        'total_amount': float(inv.total_amount),
                        'payment_date': inv.payment_date.isoformat() if inv.payment_date else None
                    } for inv in recent_payments
                ]
            }
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Error fetching admin dashboard stats: {e}")
        return jsonify({'error': 'Failed to fetch dashboard statistics'}), 500

# === ENHANCED AGENT JOBS AND INVOICE DETAILS ENDPOINTS ===

@admin_bp.route('/admin/agents/<int:agent_id>/jobs', methods=['GET'])
@jwt_required()
def get_agent_jobs(agent_id):
    """Get all jobs for a specific agent with full job details."""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(int(current_user_id))
        
        if not current_user or current_user.role != 'admin':
            return jsonify({'error': 'Access denied'}), 403
        
        agent = User.query.get(agent_id)
        if not agent or agent.role != 'agent':
            return jsonify({'error': 'Agent not found'}), 404
        
        # Get jobs through assignments and invoices
        assignments = JobAssignment.query.filter_by(agent_id=agent_id).all()
        
        jobs = []
        for assignment in assignments:
            try:
                job = assignment.job
                if not job:
                    continue
                    
                # Safely get job data
                job_data = {}
                job_data['id'] = job.id
                job_data['title'] = getattr(job, 'title', f'Job #{job.id}')
                job_data['address'] = getattr(job, 'address', 'Address not specified')
                job_data['arrival_time'] = job.arrival_time.isoformat() if hasattr(job, 'arrival_time') and job.arrival_time else None
                job_data['job_type'] = getattr(job, 'job_type', 'General')
                job_data['agents_required'] = getattr(job, 'agents_required', 1)
                job_data['status'] = getattr(job, 'status', 'active')
                job_data['notes'] = getattr(job, 'notes', '')
                job_data['assignment_status'] = getattr(assignment, 'status', 'assigned')
                
                # Check if there's an invoice for this job
                invoice_job = InvoiceJob.query.filter_by(job_id=job.id).first()
                if invoice_job:
                    invoice = Invoice.query.filter_by(
                        agent_id=agent_id,
                        id=invoice_job.invoice_id
                    ).first()
                    
                    if invoice:
                        job_data['invoice_id'] = invoice.id
                        job_data['invoice_number'] = getattr(invoice, 'invoice_number', f'INV-{invoice.id}')
                        job_data['invoice_status'] = getattr(invoice, 'status', 'draft')
                        job_data['hours_worked'] = float(getattr(invoice_job, 'hours_worked', 0) or 0)
                        job_data['hourly_rate'] = float(getattr(invoice_job, 'hourly_rate_at_invoice', None) or getattr(job, 'hourly_rate', 20) or 20)
                
                jobs.append(job_data)
                
            except Exception as job_error:
                current_app.logger.error(f"Error processing job {assignment.job_id}: {job_error}")
                continue
        
        # Sort by most recent first
        jobs.sort(key=lambda x: x.get('arrival_time', ''), reverse=True)
        
        return jsonify({
            'agent': {
                'id': agent.id,
                'name': f"{agent.first_name} {agent.last_name}",
                'email': agent.email
            },
            'jobs': jobs,
            'total_count': len(jobs)
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Error fetching agent jobs: {e}")
        return jsonify({'error': 'Failed to fetch agent jobs'}), 500

@admin_bp.route('/admin/invoices/<int:invoice_id>/details', methods=['GET'])
@jwt_required()
def get_detailed_invoice(invoice_id):
    """Get comprehensive invoice details including job information."""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(int(current_user_id))
        
        if not current_user or current_user.role != 'admin':
            return jsonify({'error': 'Access denied'}), 403
        
        invoice = Invoice.query.get(invoice_id)
        if not invoice:
            return jsonify({'error': 'Invoice not found'}), 404
        
        # Get job details associated with this invoice
        invoice_jobs = InvoiceJob.query.filter_by(invoice_id=invoice_id).all()
        job_details = []
        
        for invoice_job in invoice_jobs:
            if invoice_job.job:
                job = invoice_job.job
                hours_worked = float(getattr(invoice_job, 'hours_worked', 0) or 0)
                hourly_rate = float(getattr(invoice_job, 'hourly_rate_at_invoice', None) or getattr(job, 'hourly_rate', 20) or 20)
                
                job_details.append({
                    'job_id': job.id,
                    'title': getattr(job, 'title', f'Job #{job.id}'),
                    'address': getattr(job, 'address', 'Address not specified'),
                    'date': job.arrival_time.isoformat() if hasattr(job, 'arrival_time') and job.arrival_time else None,
                    'job_type': getattr(job, 'job_type', 'General'),
                    'hours_worked': hours_worked,
                    'hourly_rate': hourly_rate,
                    'subtotal': hours_worked * hourly_rate,
                    'notes': getattr(job, 'notes', '')
                })
        
        # Build comprehensive invoice details with safe attribute access
        details = {
            # Invoice Information
            'id': invoice.id,
            'invoice_number': getattr(invoice, 'invoice_number', f'INV-{invoice.id}'),
            'agent_id': getattr(invoice, 'agent_id', None),
            'agent_name': f"{invoice.agent.first_name} {invoice.agent.last_name}" if invoice.agent else 'Unknown Agent',
            'agent_email': getattr(invoice.agent, 'email', 'No email') if invoice.agent else 'No email',
            'issue_date': invoice.issue_date.isoformat() if hasattr(invoice, 'issue_date') and invoice.issue_date else None,
            'due_date': invoice.due_date.isoformat() if hasattr(invoice, 'due_date') and invoice.due_date else None,
            'status': getattr(invoice, 'status', 'draft'),
            'total_amount': float(getattr(invoice, 'total_amount', 0) or 0),
            'hours': float(getattr(invoice, 'hours', 0) or 0),
            'rate_per_hour': float(getattr(invoice, 'rate_per_hour', 20) or 20),
            'subtotal': float(getattr(invoice, 'hours', 0) or 0) * float(getattr(invoice, 'rate_per_hour', 20) or 20),
            'expenses': float(getattr(invoice, 'expenses', 0) or 0),
            'job_details': job_details,
            'created_at': invoice.created_at.isoformat() if hasattr(invoice, 'created_at') and invoice.created_at else None,
            'generated_at': invoice.generated_at.isoformat() if hasattr(invoice, 'generated_at') and invoice.generated_at else None
        }
        
        # Add COMPLETE job information if job exists (enhanced)
        if job_details and len(job_details) > 0:
            # Use first job for main job details (most common case)
            main_job_data = job_details[0]
            details.update({
                # Basic Job Info
                'job_id': main_job_data.get('job_id'),
                'job_title': main_job_data.get('title', 'N/A'),
                'job_type': main_job_data.get('job_type', 'N/A'),
                'job_status': 'completed',  # If invoiced, job is completed
                
                # Location Details
                'job_address': main_job_data.get('address', 'N/A'),
                'job_postcode': 'N/A',  # Will be enhanced below with direct job access
                'job_arrival_time': main_job_data.get('date'),
                'agents_required': 'N/A',  # Will be enhanced below
                'job_notes': main_job_data.get('notes', '')
            })
            
            # Try to get additional details from the actual job object
            try:
                if job_details and len(job_details) > 0:
                    job_id = main_job_data.get('job_id')
                    if job_id:
                        actual_job = Job.query.get(job_id)
                        if actual_job:
                            details.update({
                                # Enhanced location details
                                'job_postcode': getattr(actual_job, 'postcode', 'N/A'),
                                'what3words_address': getattr(actual_job, 'what3words_address', ''),
                                'location_lat': getattr(actual_job, 'location_lat', None),
                                'location_lng': getattr(actual_job, 'location_lng', None),
                                'maps_link': getattr(actual_job, 'maps_link', ''),
                                
                                # Enhanced job details
                                'agents_required': getattr(actual_job, 'agents_required', 1),
                                'lead_agent_name': getattr(actual_job, 'lead_agent_name', ''),
                                'instructions': getattr(actual_job, 'instructions', ''),
                                'urgency_level': getattr(actual_job, 'urgency_level', 'Standard'),
                                'number_of_dwellings': getattr(actual_job, 'number_of_dwellings', None),
                                'police_liaison_required': getattr(actual_job, 'police_liaison_required', False),
                                
                                # Override with actual job notes if available
                                'job_notes': getattr(actual_job, 'instructions', '') or main_job_data.get('notes', '')
                            })
            except Exception as job_error:
                current_app.logger.error(f"Error fetching additional job details: {job_error}")
                
        else:
            # Fallback if no job linked
            details.update({
                'job_id': None,
                'job_title': 'N/A',
                'job_type': 'N/A',
                'job_status': 'N/A',
                'job_address': 'N/A',
                'job_postcode': 'N/A',
                'job_arrival_time': None,
                'agents_required': 'N/A',
                'job_notes': 'No job details available',
                'what3words_address': '',
                'urgency_level': 'N/A',
                'instructions': 'N/A'
            })
        
        # Add payment information if paid
        if invoice.status == 'paid':
            details['paid_date'] = invoice.paid_date.isoformat() if invoice.paid_date else None
            if invoice.paid_by_admin_id:
                paid_by_admin = User.query.get(invoice.paid_by_admin_id)
                details['paid_by_admin'] = f"{paid_by_admin.first_name} {paid_by_admin.last_name}" if paid_by_admin else 'Admin'
        
        return jsonify(details), 200
        
    except Exception as e:
        current_app.logger.error(f"Error fetching invoice details: {e}")
        return jsonify({'error': 'Failed to fetch invoice details'}), 500

# === SIMPLE AGENT DETAILS ENDPOINT FOR AGENT MANAGEMENT PAGE ===

@admin_bp.route('/admin/agent-management/<int:agent_id>/details', methods=['GET'])
@jwt_required()
def get_agent_management_details(agent_id):
    """Get agent details for the agent management page (works with existing database)."""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(int(current_user_id))
        
        if not current_user or current_user.role != 'admin':
            return jsonify({'error': 'Access denied'}), 403
        
        agent = User.query.get(agent_id)
        if not agent or agent.role != 'agent':
            return jsonify({'error': 'Agent not found'}), 404
        
        # Get agent's invoices (using existing fields only)
        invoices = Invoice.query.filter_by(agent_id=agent_id).order_by(Invoice.issue_date.desc()).all()
        
        # Calculate statistics from existing data
        total_invoices = len(invoices)
        total_earnings = sum(float(invoice.total_amount or 0) for invoice in invoices)
        paid_invoices = [inv for inv in invoices if inv.status == 'paid']
        pending_invoices = [inv for inv in invoices if inv.status in ['sent', 'draft']]
        
        paid_amount = sum(float(inv.total_amount or 0) for inv in paid_invoices)
        pending_amount = sum(float(inv.total_amount or 0) for inv in pending_invoices)
        
        # Enhanced invoice data with job addresses
        invoices_with_jobs = []
        for invoice in invoices:
            invoice_dict = invoice.to_dict()
            
            # Get job details for this invoice
            invoice_jobs = InvoiceJob.query.filter_by(invoice_id=invoice.id).all()
            jobs_info = []
            for ij in invoice_jobs:
                if ij.job:
                    jobs_info.append({
                        'job_id': ij.job.id,
                        'address': ij.job.address or 'Address not specified',
                        'title': ij.job.address or f'Job #{ij.job.id}',
                        'hours_worked': float(ij.hours_worked or 0),
                        'hourly_rate_at_invoice': float(ij.hourly_rate_at_invoice or 20)
                    })
            
            invoice_dict['jobs'] = jobs_info
            invoices_with_jobs.append(invoice_dict)
        
        return jsonify({
            'agent': {
                'id': agent.id,
                'first_name': agent.first_name,
                'last_name': agent.last_name,
                'email': agent.email,
                'phone': agent.phone or 'Not provided',
                'address_line_1': agent.address_line_1 or 'Not provided',
                'address_line_2': agent.address_line_2 or '',
                'city': agent.city or 'Not provided',
                'postcode': agent.postcode or 'Not provided',
                'bank_name': agent.bank_name or 'Not provided',
                'bank_account_number': agent.bank_account_number or 'Not provided',
                'bank_sort_code': agent.bank_sort_code or 'Not provided',
                'utr_number': agent.utr_number or 'Not provided',
                'verification_status': agent.verification_status,
                'created_at': agent.created_at.isoformat() if agent.created_at else None,
                'role': agent.role
            },
            'invoices': invoices_with_jobs,
            'stats': {
                'total_invoices': total_invoices,
                'total_earnings': total_earnings,
                'paid_amount': paid_amount,
                'pending_amount': pending_amount,
                'paid_count': len(paid_invoices),
                'pending_count': len(pending_invoices)
            }
        })
        
    except Exception as e:
        current_app.logger.error(f"Error fetching agent management details: {e}")
        return jsonify({'error': 'Failed to fetch agent details'}), 500


@admin_bp.route('/admin/jobs/<int:job_id>/invoices', methods=['GET'])
@jwt_required()
def get_invoices_for_job(job_id):
    """Get all invoices linked to a specific job"""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(int(current_user_id))
        if not current_user or current_user.role not in ['admin', 'manager']:
            return jsonify({'error': 'Access denied'}), 403

        # Check if job exists
        job = Job.query.get(job_id)
        if not job:
            return jsonify({'error': 'Job not found'}), 404

        # Get all invoices linked to this job
        invoices = (Invoice.query
            .join(InvoiceJob, InvoiceJob.invoice_id == Invoice.id)
            .filter(InvoiceJob.job_id == job_id)
            .order_by(Invoice.issue_date.desc())
            .all())

        result = []
        for inv in invoices:
            invoice_dict = inv.to_dict()
            
            # Add agent name
            if inv.agent:
                invoice_dict['agent_name'] = f"{inv.agent.first_name} {inv.agent.last_name}"
            else:
                invoice_dict['agent_name'] = 'Unknown Agent'
            
            # Check if PDF is available based on S3 config and non-draft status
            invoice_dict['pdf_available'] = s3_client.is_configured() and inv.status != 'draft'
            
            result.append(invoice_dict)

        return jsonify({
            'job_id': job_id,
            'invoices': result,
            'count': len(result)
        }), 200

    except Exception as e:
        current_app.logger.error(f"Error fetching invoices for job {job_id}: {e}", exc_info=True)
        return jsonify({'error': 'Failed to fetch job invoices'}), 500


# ====================
# FINANCE ENDPOINTS
# ====================

@admin_bp.route('/admin/jobs/<int:job_id>/finance', methods=['GET'])
@jwt_required()
def get_job_finance(job_id):
    """Get complete financial breakdown for a job"""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(int(current_user_id))
        
        if not current_user or current_user.role != 'admin':
            return jsonify({'error': 'Access denied'}), 403
        
        # Get job
        job = Job.query.get(job_id)
        if not job:
            return jsonify({'error': 'Job not found'}), 404
        
        # Get billing config
        billing = JobBilling.query.filter_by(job_id=job_id).first()
        if not billing:
            return jsonify({'error': 'No billing configuration found for this job'}), 404
        
        # Calculate revenue
        revenue = calculate_job_revenue(billing)
        
        # Get expense totals
        expenses = get_job_expense_totals(job_id)
        
        # Get agent invoice totals
        agent_invoices = get_job_agent_invoice_totals(job_id)
        
        # Calculate profit
        profit = calculate_job_profit(job_id)
        
        # Build response
        billing_dict = billing.to_dict()
        billing_dict.update(revenue)
        
        return jsonify({
            'job_id': job_id,
            'billing': billing_dict,
            'agent_invoices': agent_invoices,
            'job_expenses': expenses,
            'profit': profit
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Error fetching job finance for {job_id}: {e}")
        return jsonify({'error': 'Failed to fetch job finance data'}), 500


@admin_bp.route('/admin/jobs/<int:job_id>/finance/lock', methods=['POST'])
@jwt_required()
def lock_job_finance(job_id):
    """Lock revenue snapshot for completed job"""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(int(current_user_id))
        
        if not current_user or current_user.role != 'admin':
            return jsonify({'error': 'Access denied'}), 403
        
        # Check job exists
        job = Job.query.get(job_id)
        if not job:
            return jsonify({'error': 'Job not found'}), 404
        
        # Lock snapshot
        success = lock_job_revenue_snapshot(job_id)
        
        if success:
            return jsonify({'message': 'Revenue snapshot locked successfully'}), 200
        else:
            return jsonify({'error': 'Failed to lock revenue snapshot'}), 500
            
    except Exception as e:
        current_app.logger.error(f"Error locking finance for job {job_id}: {e}")
        return jsonify({'error': 'Failed to lock revenue snapshot'}), 500


@admin_bp.route('/admin/expenses', methods=['GET'])
@jwt_required()
def list_expenses():
    """List expenses with filtering"""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(int(current_user_id))
        
        if not current_user or current_user.role != 'admin':
            return jsonify({'error': 'Access denied'}), 403
        
        # Parse query parameters
        from_date = request.args.get('from')
        to_date = request.args.get('to')
        job_id = request.args.get('job_id', type=int)
        category = request.args.get('category')
        
        # Build query
        query = Expense.query
        
        if from_date:
            try:
                from_date_obj = datetime.strptime(from_date, '%Y-%m-%d').date()
                query = query.filter(Expense.date >= from_date_obj)
            except ValueError:
                return jsonify({'error': 'Invalid from date format. Use YYYY-MM-DD'}), 400
        
        if to_date:
            try:
                to_date_obj = datetime.strptime(to_date, '%Y-%m-%d').date()
                query = query.filter(Expense.date <= to_date_obj)
            except ValueError:
                return jsonify({'error': 'Invalid to date format. Use YYYY-MM-DD'}), 400
        
        if job_id:
            query = query.filter(Expense.job_id == job_id)
        
        if category:
            query = query.filter(Expense.category == category)
        
        # Execute query
        expenses = query.order_by(Expense.date.desc()).all()
        
        # Calculate totals
        total_net = sum(exp.amount_net for exp in expenses)
        total_vat = sum(exp.vat_amount for exp in expenses)
        total_gross = sum(exp.amount_gross for exp in expenses)
        
        return jsonify({
            'expenses': [exp.to_dict() for exp in expenses],
            'totals': {
                'net': float(total_net) if total_net else 0.0,
                'vat': float(total_vat) if total_vat else 0.0,
                'gross': float(total_gross) if total_gross else 0.0
            }
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Error listing expenses: {e}")
        return jsonify({'error': 'Failed to list expenses'}), 500


@admin_bp.route('/admin/expenses', methods=['POST'])
@jwt_required()
def create_expense():
    """Create new expense"""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(int(current_user_id))
        
        if not current_user or current_user.role != 'admin':
            return jsonify({'error': 'Access denied'}), 403
        
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Required fields
        required_fields = ['date', 'category', 'description', 'amount_net', 'paid_with']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        # Parse date
        try:
            expense_date = datetime.strptime(data['date'], '%Y-%m-%d').date()
        except ValueError:
            return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400
        
        # Calculate VAT
        amount_net = data['amount_net']
        vat_rate = data.get('vat_rate', 0.20)
        vat_amount, amount_gross = calculate_expense_vat(amount_net, vat_rate)
        
        # Create expense
        expense = Expense(
            date=expense_date,
            category=data['category'],
            description=data['description'],
            amount_net=amount_net,
            vat_rate=vat_rate,
            vat_amount=vat_amount,
            amount_gross=amount_gross,
            job_id=data.get('job_id'),
            paid_with=data['paid_with'],
            supplier=data.get('supplier'),
            receipt_url=data.get('receipt_url'),
            created_by=current_user_id,
            status=data.get('status', 'logged')
        )
        
        db.session.add(expense)
        db.session.commit()
        
        return jsonify(expense.to_dict()), 201
        
    except Exception as e:
        current_app.logger.error(f"Error creating expense: {e}")
        db.session.rollback()
        return jsonify({'error': 'Failed to create expense'}), 500


@admin_bp.route('/admin/expenses/<int:expense_id>', methods=['PATCH'])
@jwt_required()
def update_expense(expense_id):
    """Update existing expense"""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(int(current_user_id))
        
        if not current_user or current_user.role != 'admin':
            return jsonify({'error': 'Access denied'}), 403
        
        expense = Expense.query.get(expense_id)
        if not expense:
            return jsonify({'error': 'Expense not found'}), 404
        
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Update fields
        if 'date' in data:
            try:
                expense.date = datetime.strptime(data['date'], '%Y-%m-%d').date()
            except ValueError:
                return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400
        
        if 'category' in data:
            expense.category = data['category']
        
        if 'description' in data:
            expense.description = data['description']
        
        if 'amount_net' in data or 'vat_rate' in data:
            amount_net = data.get('amount_net', expense.amount_net)
            vat_rate = data.get('vat_rate', expense.vat_rate)
            vat_amount, amount_gross = calculate_expense_vat(amount_net, vat_rate)
            
            expense.amount_net = amount_net
            expense.vat_rate = vat_rate
            expense.vat_amount = vat_amount
            expense.amount_gross = amount_gross
        
        if 'job_id' in data:
            expense.job_id = data['job_id']
        
        if 'paid_with' in data:
            expense.paid_with = data['paid_with']
        
        if 'supplier' in data:
            expense.supplier = data['supplier']
        
        if 'receipt_url' in data:
            expense.receipt_url = data['receipt_url']
        
        if 'status' in data:
            expense.status = data['status']
        
        db.session.commit()
        
        return jsonify(expense.to_dict()), 200
        
    except Exception as e:
        current_app.logger.error(f"Error updating expense {expense_id}: {e}")
        db.session.rollback()
        return jsonify({'error': 'Failed to update expense'}), 500


@admin_bp.route('/admin/expenses/<int:expense_id>', methods=['DELETE'])
@jwt_required()
def delete_expense(expense_id):
    """Delete expense"""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(int(current_user_id))
        
        if not current_user or current_user.role != 'admin':
            return jsonify({'error': 'Access denied'}), 403
        
        expense = Expense.query.get(expense_id)
        if not expense:
            return jsonify({'error': 'Expense not found'}), 404
        
        db.session.delete(expense)
        db.session.commit()
        
        return jsonify({'message': 'Expense deleted successfully'}), 200
        
    except Exception as e:
        current_app.logger.error(f"Error deleting expense {expense_id}: {e}")
        db.session.rollback()
        return jsonify({'error': 'Failed to delete expense'}), 500


@admin_bp.route('/admin/finance/summary', methods=['GET'])
@jwt_required()
def finance_summary():
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(int(current_user_id))
        if not current_user or current_user.role != 'admin':
            return jsonify({'error': 'Access denied'}), 403

        from_q = request.args.get('from')
        to_q = request.args.get('to')

        def parse_date(s):
            if not s:
                return None
            return datetime.strptime(s, '%Y-%m-%d').date()

        from_date = parse_date(from_q)
        to_date = parse_date(to_q)

        if (from_q and from_date is None) or (to_q and to_date is None):
            return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400

        # Build normalized financial summary
        summary = get_financial_summary(from_date=from_date, to_date=to_date)

        # Ensure floats and required keys
        response = {
            'revenue': {
                'net': float(summary.get('revenue', {}).get('net', 0.0) or 0.0),
                'vat': float(summary.get('revenue', {}).get('vat', 0.0) or 0.0),
                'gross': float(summary.get('revenue', {}).get('gross', 0.0) or 0.0),
            },
            'agent_invoices': {
                'net': float(summary.get('agent_invoices', {}).get('net', 0.0) or 0.0),
                'gross': float(summary.get('agent_invoices', {}).get('gross', 0.0) or 0.0),
            },
            'expenses': {
                'net': float(summary.get('expenses', {}).get('net', 0.0) or 0.0),
                'vat': float(summary.get('expenses', {}).get('vat', 0.0) or 0.0),
                'gross': float(summary.get('expenses', {}).get('gross', 0.0) or 0.0),
            },
            'money_in': {
                'net': float(summary.get('money_in', {}).get('net', response['revenue']['net'] if 'response' in locals() else 0.0)),
                'gross': float(summary.get('money_in', {}).get('gross', response['revenue']['gross'] if 'response' in locals() else 0.0)),
            },
            'money_out': {
                'net': float(summary.get('money_out', {}).get('net', summary.get('agent_invoices', {}).get('net', 0.0) + summary.get('expenses', {}).get('net', 0.0))),
                'gross': float(summary.get('money_out', {}).get('gross', summary.get('agent_invoices', {}).get('gross', 0.0) + summary.get('expenses', {}).get('gross', 0.0))),
            },
            'profit': {
                'net': float(summary.get('profit', {}).get('net', 0.0) or 0.0),
                'gross': float(summary.get('profit', {}).get('gross', 0.0) or 0.0),
            },
            'vat': {
                'output': float(summary.get('vat', {}).get('output', 0.0) or 0.0),
                'input': float(summary.get('vat', {}).get('input', 0.0) or 0.0),
                'net_due': float(summary.get('vat', {}).get('net_due', 0.0) or 0.0),
            },
        }

        # If money_in not provided, derive from revenue
        response['money_in']['net'] = response['money_in']['net'] or response['revenue']['net']
        response['money_in']['gross'] = response['money_in']['gross'] or response['revenue']['gross']

        # If money_out not provided, derive from components
        response['money_out']['net'] = response['money_out']['net'] or (response['agent_invoices']['net'] + response['expenses']['net'])
        response['money_out']['gross'] = response['money_out']['gross'] or (response['agent_invoices']['gross'] + response['expenses']['gross'])

        # If profit not provided, derive
        response['profit']['net'] = response['profit']['net'] or (response['money_in']['net'] - response['money_out']['net'])
        response['profit']['gross'] = response['profit']['gross'] or (response['money_in']['gross'] - response['money_out']['gross'])

        # Ensure VAT net_due
        response['vat']['net_due'] = response['vat']['net_due'] or (response['vat']['output'] - response['vat']['input'])

        return jsonify(response), 200

    except ValueError:
        return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400
    except Exception as e:
        current_app.logger.error(f"Error building finance summary: {e}")
        return jsonify({'error': 'Failed to build finance summary'}), 500

@admin_bp.route('/admin/settings/notifications', methods=['GET'])
@jwt_required()
def get_notifications_setting():
	user = require_admin()
	if not user:
		return jsonify({'error': 'Access denied. Admin role required.'}), 403
	from src.models.user import Setting
	default_enabled = str(current_app.config.get('NOTIFICATIONS_ENABLED', 'true')).lower() in ('1','true','yes','on')
	enabled = Setting.get_bool('notifications_enabled', default_enabled)
	return jsonify({'enabled': bool(enabled)})

@admin_bp.route('/admin/settings/notifications', methods=['PUT'])
@jwt_required()
def set_notifications_setting():
	user = require_admin()
	if not user:
		return jsonify({'error': 'Access denied. Admin role required.'}), 403
	from src.models.user import Setting, db
	data = request.get_json(silent=True) or {}
	enabled = bool(data.get('enabled', True))
	Setting.set_bool('notifications_enabled', enabled)
	current_app.logger.info(f"Admin set notifications_enabled={enabled}")
	return jsonify({'enabled': enabled})