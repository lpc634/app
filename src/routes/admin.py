# src/routes/admin.py
from flask import Blueprint, jsonify, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from src.models.user import User, Job, JobAssignment, AgentAvailability, Invoice, db
from src.utils.s3_client import s3_client
from datetime import datetime, date
import json
import logging

admin_bp = Blueprint('admin', __name__)

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
        
        # Check if database migration has been run (document_files field exists)
        if not hasattr(agent, 'document_files'):
            return jsonify({
                "agent_info": {
                    "id": agent.id,
                    "name": f"{agent.first_name} {agent.last_name}",
                    "email": agent.email,
                    "verification_status": agent.verification_status
                },
                "documents": [],
                "s3_documents": [],
                "total_count": 0,
                "message": "S3 document storage not yet available. Database migration required."
            }), 200
        
        # Get documents from database metadata
        if agent.document_files:
            document_files = agent.document_files
            if isinstance(document_files, str):
                document_files = json.loads(document_files)
            
            for doc in document_files:
                # Generate temporary signed URL for admin access
                signed_url = s3_client.generate_presigned_url(
                    doc['file_key'], 
                    expiration=7200  # 2 hours for admin review
                )
                
                if signed_url:
                    documents.append({
                        'filename': doc.get('filename'),
                        'original_filename': doc.get('original_filename'),
                        'document_type': doc.get('document_type'),
                        'upload_date': doc.get('upload_date'),
                        'file_size': doc.get('file_size'),
                        'download_url': signed_url,
                        'file_key': doc.get('file_key')
                    })
        
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
        
        # Check if database migration has been run (pdf_file_url field exists)
        if not hasattr(invoice, 'pdf_file_url'):
            return jsonify({
                'error': 'S3 PDF storage not yet available',
                'message': 'Database migration required. Please contact administrator.'
            }), 503

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
        
        # Check if database migration has been run (document_files field exists)
        if not hasattr(agent, 'document_files'):
            return jsonify({
                'error': 'S3 document storage not yet available',
                'message': 'Database migration required. Please contact administrator.'
            }), 503

        if not agent.document_files:
            return jsonify({'error': 'No documents found for this agent'}), 404
        
        document_files = agent.document_files
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