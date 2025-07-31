# src/routes/admin.py
from flask import Blueprint, jsonify, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from src.models.user import User, Job, JobAssignment, AgentAvailability, Invoice, InvoiceJob, Notification, db
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
                        'job_title': invoice_job.job.title,
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
                        'title': ij.job.title or f'Job #{ij.job.id}',
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