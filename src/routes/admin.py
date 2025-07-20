# src/routes/admin.py
from flask import Blueprint, jsonify, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from src.models.user import User, db

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