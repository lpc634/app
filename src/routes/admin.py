# src/routes/admin.py
from flask import Blueprint, jsonify, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from src.models.user import User, Job, JobAssignment, AgentAvailability, Invoice, db
from src.utils.s3_client import s3_client
from datetime import datetime, date
import json
import logging
import requests

admin_bp = Blueprint('admin', __name__)

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
            message = f"Agent {agent.first_name} {agent.last_name} has been verified"
        else:
            agent.verification_status = 'rejected'
            # Optionally clear document URLs on rejection
            # agent.id_document_url = None
            # agent.sia_document_url = None
            message = f"Agent {agent.first_name} {agent.last_name} has been rejected"
        
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
        
        # S3 PDF storage is now available

        if not invoice.pdf_file_url:
            return jsonify({'error': 'PDF not available for this invoice'}), 404
        
        # Generate temporary signed URL for admin access
        signed_url = s3_client.generate_presigned_url(
            invoice.pdf_file_url, 
            expiration=3600  # 1 hour for admin access
        )
        
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
@jwt_required()
def get_document_preview_url(file_key):
    """Generate secure preview URL for document viewing."""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(int(current_user_id))
        
        if not current_user or current_user.role != 'admin':
            return jsonify({'error': 'Access denied'}), 403
        
        # Decode the file key (replace __ with /)
        actual_file_key = file_key.replace('__', '/')
        
        # Check if this is a legacy document (stored in old format)
        if actual_file_key.startswith('user_'):
            # Legacy document - try to serve from the legacy system or convert to S3
            legacy_url_result = handle_legacy_document_access(actual_file_key)
            if legacy_url_result['success']:
                # Log admin document access
                current_app.logger.info(f"Admin {current_user.email} accessed legacy document: {actual_file_key}")
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
        
        # Log admin document access
        current_app.logger.info(f"Admin {current_user.email} accessed document preview: {actual_file_key}")
        
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
    """Get jobs with optional status filter"""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(int(current_user_id))
        
        if not current_user or current_user.role != 'admin':
            return jsonify({'error': 'Access denied'}), 403
        
        # Get status filter from query params
        status_filter = request.args.get('status')
        
        query = Job.query
        if status_filter:
            query = query.filter(Job.status == status_filter)
        
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
            query = query.filter(db.extract('year', Invoice.generated_at) == year)
        if month:
            query = query.filter(db.extract('month', Invoice.generated_at) == month)
        
        invoices = query.order_by(Invoice.generated_at.desc()).all()
        
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

@admin_bp.route('/admin/invoices/<int:invoice_id>/status', methods=['PUT'])
@jwt_required()
def update_invoice_payment_status(invoice_id):
    """Update invoice payment status."""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(int(current_user_id))
        
        if not current_user or current_user.role != 'admin':
            return jsonify({'error': 'Access denied'}), 403
        
        data = request.get_json()
        payment_status = data.get('payment_status')
        
        if payment_status not in ['unpaid', 'paid', 'overdue']:
            return jsonify({'error': 'Invalid payment status'}), 400
        
        invoice = Invoice.query.get(invoice_id)
        if not invoice:
            return jsonify({'error': 'Invoice not found'}), 404
        
        old_status = invoice.payment_status
        invoice.payment_status = payment_status
        db.session.commit()
        
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
        
        invoices = Invoice.query.filter_by(agent_id=agent_id).order_by(Invoice.generated_at.desc()).all()
        
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
        
        if not invoice.pdf_file_url:
            return jsonify({'error': 'Invoice PDF not available'}), 404
        
        # Generate secure download URL
        download_result = s3_client.get_secure_document_url(
            invoice.pdf_file_url,
            expiration=3600  # 1 hour
        )
        
        if not download_result['success']:
            return jsonify({'error': download_result['error']}), 500
        
        # Log admin download for audit
        current_app.logger.info(
            f"Admin {current_user.email} downloaded invoice {invoice.invoice_number} "
            f"for agent {invoice.agent.email}"
        )
        
        return jsonify({
            'download_url': download_result['url'],
            'expires_in': download_result['expires_in'],
            'invoice_number': invoice.invoice_number,
            'agent_name': f"{invoice.agent.first_name} {invoice.agent.last_name}",
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
        
        # Get invoices and their S3 keys
        invoices = Invoice.query.filter(Invoice.id.in_(invoice_ids)).all()
        if not invoices:
            return jsonify({'error': 'No valid invoices found'}), 404
        
        # Collect S3 file keys for invoices that have PDFs
        file_keys = []
        invoice_details = []
        for invoice in invoices:
            if invoice.pdf_file_url:
                file_keys.append(invoice.pdf_file_url)
                invoice_details.append({
                    'invoice_number': invoice.invoice_number,
                    'agent_name': f"{invoice.agent.first_name} {invoice.agent.last_name}",
                    'total_amount': float(invoice.total_amount),
                    'generated_at': invoice.generated_at.isoformat() if invoice.generated_at else None
                })
        
        if not file_keys:
            return jsonify({'error': 'No invoice PDFs available for batch download'}), 404
        
        # Create ZIP file in S3
        zip_filename = f"{batch_name}.zip"
        batch_result = s3_client.create_invoice_batch_zip(file_keys, zip_filename)
        
        if not batch_result['success']:
            return jsonify({'error': batch_result['error']}), 500
        
        # Generate download URL for the ZIP file
        zip_download_url = s3_client.generate_presigned_url(
            batch_result['file_key'],
            expiration=7200  # 2 hours for batch downloads
        )
        
        if not zip_download_url:
            return jsonify({'error': 'Failed to generate batch download URL'}), 500
        
        # Log batch download creation
        current_app.logger.info(
            f"Admin {current_user.email} created batch download {batch_name} "
            f"containing {len(file_keys)} invoices"
        )
        
        return jsonify({
            'batch_name': batch_name,
            'download_url': zip_download_url,
            'expires_in': 7200,
            'invoice_count': len(file_keys),
            'total_amount': sum(invoice['total_amount'] for invoice in invoice_details),
            'invoices': invoice_details
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Error creating invoice batch download: {e}")
        return jsonify({'error': 'Failed to create batch download'}), 500

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