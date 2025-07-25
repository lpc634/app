"""
Firebase Cloud Messaging (FCM) Routes
Handles FCM token registration and push notification sending
"""

import logging
from datetime import datetime
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from src.models.user import User, FCMToken, db
from src.services.firebaseConfig import fcm_service

logger = logging.getLogger(__name__)

fcm_bp = Blueprint('fcm_notifications', __name__)

@fcm_bp.route('/notifications/fcm/register', methods=['POST'])
@jwt_required()
def register_fcm_token():
    """
    Register FCM token for the current user
    Supports multiple devices per user
    """
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        
        if not data or 'fcm_token' not in data:
            return jsonify({'error': 'FCM token is required'}), 400
        
        fcm_token = data['fcm_token']
        device_type = data.get('device_type', 'web')
        device_info = data.get('user_agent', '')
        
        # Validate device type
        if device_type not in ['web', 'android', 'ios']:
            return jsonify({'error': 'Invalid device type'}), 400
        
        # Register or update the token
        token_obj = FCMToken.register_token(
            user_id=current_user_id,
            token=fcm_token,
            device_type=device_type,
            device_info=device_info
        )
        
        db.session.commit()
        
        logger.info(f"FCM token registered for user {current_user_id}, device: {device_type}")
        
        return jsonify({
            'message': 'FCM token registered successfully',
            'token_id': token_obj.id,
            'device_type': device_type
        }), 201
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error registering FCM token: {str(e)}")
        return jsonify({'error': 'Failed to register FCM token'}), 500

@fcm_bp.route('/notifications/fcm/unregister', methods=['POST'])
@jwt_required()
def unregister_fcm_token():
    """
    Unregister/deactivate FCM token
    """
    try:
        data = request.get_json()
        
        if not data or 'fcm_token' not in data:
            return jsonify({'error': 'FCM token is required'}), 400
        
        fcm_token = data['fcm_token']
        
        # Deactivate the token
        success = FCMToken.deactivate_token(fcm_token)
        
        if success:
            db.session.commit()
            logger.info(f"FCM token deactivated: {fcm_token[:20]}...")
            return jsonify({'message': 'FCM token deactivated successfully'}), 200
        else:
            return jsonify({'error': 'FCM token not found'}), 404
            
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error unregistering FCM token: {str(e)}")
        return jsonify({'error': 'Failed to unregister FCM token'}), 500

@fcm_bp.route('/notifications/fcm/tokens', methods=['GET'])
@jwt_required()
def get_user_fcm_tokens():
    """
    Get all active FCM tokens for the current user
    """
    try:
        current_user_id = get_jwt_identity()
        
        tokens = FCMToken.get_active_tokens_for_user(current_user_id)
        
        return jsonify({
            'tokens': [token.to_dict() for token in tokens],
            'count': len(tokens)
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting FCM tokens: {str(e)}")
        return jsonify({'error': 'Failed to get FCM tokens'}), 500

@fcm_bp.route('/notifications/fcm/test', methods=['POST'])
@jwt_required()
def test_fcm_notification():
    """
    Test FCM notification sending (for development/debugging)
    Admin only
    """
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if not user or user.role != 'admin':
            return jsonify({'error': 'Access denied. Admin role required.'}), 403
        
        data = request.get_json()
        title = data.get('title', 'Test Notification')
        body = data.get('body', 'This is a test notification from V3 Services')
        target_user_id = data.get('user_id', current_user_id)
        
        # Get FCM tokens for the target user
        tokens = FCMToken.get_active_tokens_for_user(target_user_id)
        
        if not tokens:
            return jsonify({'error': 'No active FCM tokens found for user'}), 404
        
        # Extract token strings
        token_strings = [token.token for token in tokens]
        
        # Send test notification
        result = fcm_service.send_push_notification(
            fcm_tokens=token_strings,
            title=title,
            body=body,
            data={
                'test': 'true',
                'timestamp': str(datetime.utcnow()),
                'user_id': str(target_user_id)
            }
        )
        
        logger.info(f"Test FCM notification sent to user {target_user_id}: {result}")
        
        return jsonify({
            'message': 'Test notification sent',
            'result': result,
            'tokens_used': len(token_strings)
        }), 200
        
    except Exception as e:
        logger.error(f"Error sending test FCM notification: {str(e)}")
        return jsonify({'error': 'Failed to send test notification'}), 500

def send_job_notification_to_agents(agent_ids, job_title, job_message, job_data=None):
    """
    Send FCM push notifications to multiple agents for job assignments
    This function is called from the job creation workflow
    
    Args:
        agent_ids: List of agent user IDs
        job_title: Notification title
        job_message: Notification message
        job_data: Optional data payload
    
    Returns:
        Dict with notification results
    """
    try:
        if not agent_ids:
            return {'success': False, 'error': 'No agent IDs provided'}
        
        logger.info(f"Sending FCM job notifications to {len(agent_ids)} agents")
        
        # Get all active FCM tokens for the agents
        tokens = FCMToken.get_active_tokens_for_users(agent_ids)
        
        if not tokens:
            logger.warning(f"No active FCM tokens found for agents: {agent_ids}")
            return {'success': False, 'error': 'No active FCM tokens found'}
        
        # Extract token strings
        token_strings = [token.token for token in tokens]
        
        logger.info(f"Found {len(token_strings)} active FCM tokens for job notification")
        
        # Prepare notification data
        notification_data = job_data or {}
        notification_data.update({
            'notification_type': 'job_assignment',
            'timestamp': str(datetime.utcnow())
        })
        
        # Send push notification using FCM service
        result = fcm_service.send_push_notification(
            fcm_tokens=token_strings,
            title=job_title,
            body=job_message,
            data=notification_data
        )
        
        logger.info(f"FCM job notification result: {result}")
        
        return {
            'success': True,
            'tokens_sent': len(token_strings),
            'agents_targeted': len(agent_ids),
            'fcm_result': result
        }
        
    except Exception as e:
        logger.error(f"Error sending FCM job notifications: {str(e)}")
        return {'success': False, 'error': str(e)}

@fcm_bp.route('/debug/fcm/status', methods=['GET'])
@jwt_required()
def debug_fcm_status():
    """
    Debug endpoint to check FCM service status and configuration
    Admin only
    """
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if not user or user.role != 'admin':
            return jsonify({'error': 'Access denied. Admin role required.'}), 403
        
        # Check Firebase initialization
        firebase_initialized = fcm_service.initialize_firebase()
        
        # Get token statistics
        total_tokens = FCMToken.query.count()
        active_tokens = FCMToken.query.filter_by(is_active=True).count()
        web_tokens = FCMToken.query.filter_by(device_type='web', is_active=True).count()
        mobile_tokens = FCMToken.query.filter(
            FCMToken.device_type.in_(['android', 'ios']),
            FCMToken.is_active == True
        ).count()
        
        # Get agent token distribution
        agent_tokens = db.session.query(
            User.id,
            User.first_name,
            User.last_name,
            db.func.count(FCMToken.id).label('token_count')
        ).join(FCMToken, User.id == FCMToken.user_id)\
         .filter(User.role == 'agent', FCMToken.is_active == True)\
         .group_by(User.id)\
         .all()
        
        return jsonify({
            'firebase_initialized': firebase_initialized,
            'token_statistics': {
                'total_tokens': total_tokens,
                'active_tokens': active_tokens,
                'web_tokens': web_tokens,
                'mobile_tokens': mobile_tokens
            },
            'agent_token_distribution': [
                {
                    'user_id': agent.id,
                    'name': f"{agent.first_name} {agent.last_name}",
                    'token_count': agent.token_count
                }
                for agent in agent_tokens
            ]
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting FCM debug status: {str(e)}")
        return jsonify({'error': 'Failed to get FCM status'}), 500