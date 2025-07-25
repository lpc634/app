import os
import json
from flask import Blueprint, jsonify, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from src.models.user import User, Notification, PushSubscription, db
from pywebpush import webpush, WebPushException

notifications_bp = Blueprint('notifications', __name__)

# --- NEW: Route to provide the VAPID public key to the frontend ---
@notifications_bp.route('/notifications/vapid/public_key', methods=['GET'])
def get_vapid_public_key():
    """Provide the VAPID public key to the frontend."""
    public_key = current_app.config.get('VAPID_PUBLIC_KEY')
    if not public_key:
        return jsonify({'error': 'VAPID public key not configured on server'}), 500
    return jsonify({'public_key': public_key})

# --- NEW: Route for the frontend to send a subscription object ---
@notifications_bp.route('/notifications/subscribe', methods=['POST'])
@jwt_required()
def subscribe():
    """Subscribe a user to push notifications."""
    current_user_id = get_jwt_identity()
    subscription_data = request.get_json()

    if not subscription_data:
        return jsonify({'error': 'No subscription data provided'}), 400

    # Check if this subscription already exists for this user
    subscription_json = json.dumps(subscription_data)
    existing_sub = PushSubscription.query.filter_by(
        user_id=current_user_id,
        subscription_json=subscription_json
    ).first()

    if existing_sub:
        return jsonify({'message': 'User already subscribed with this endpoint'}), 200

    # Save the new subscription
    new_sub = PushSubscription(
        user_id=current_user_id,
        subscription_json=subscription_json
    )
    db.session.add(new_sub)
    db.session.commit()

    return jsonify({'message': 'Subscription saved successfully'}), 201


# --- Helper function to send notifications using Web Push ---
def trigger_push_notification_for_users(user_ids, title, message):
    """
    Send push notifications to users using both legacy Web Push and new FCM system
    """
    if not isinstance(user_ids, list):
        user_ids = [user_ids]
    
    # Legacy Web Push notifications (for backward compatibility)
    _send_legacy_web_push(user_ids, title, message)
    
    # New FCM push notifications
    _send_fcm_notifications(user_ids, title, message)

def _send_legacy_web_push(user_ids, title, message):
    """Legacy Web Push implementation"""
    subscriptions = PushSubscription.query.filter(PushSubscription.user_id.in_(user_ids)).all()
    
    # Prepare data payload
    notification_payload = json.dumps({
        'title': title,
        'body': message
    })

    # Get VAPID keys from app config
    vapid_private_key = current_app.config.get('VAPID_PRIVATE_KEY')
    vapid_claims = {"sub": "mailto:your_email@example.com"} # Change this to your admin email

    if not vapid_private_key:
        print("Warning: VAPID_PRIVATE_KEY is not set. Cannot send legacy web push notifications.")
        return

    for sub in subscriptions:
        try:
            webpush(
                subscription_info=json.loads(sub.subscription_json),
                data=notification_payload,
                vapid_private_key=vapid_private_key,
                vapid_claims=vapid_claims
            )
        except WebPushException as ex:
            # This can happen if a subscription is expired or invalid
            print(f"Web Push Failed for sub ID {sub.id}: {ex}")
            # Optional: Delete the invalid subscription
            if ex.response and ex.response.status_code == 410:
                 db.session.delete(sub)
                 db.session.commit()

def _send_fcm_notifications(user_ids, title, message):
    """Send FCM push notifications"""
    try:
        from src.routes.fcm_notifications import send_job_notification_to_agents
        
        result = send_job_notification_to_agents(
            agent_ids=user_ids,
            job_title=title,
            job_message=message,
            job_data={'notification_source': 'job_assignment'}
        )
        
        print(f"FCM notifications sent: {result}")
        
    except Exception as e:
        print(f"FCM notification error: {str(e)}")
        import logging
        logging.error(f"FCM notification error: {str(e)}")


# --- Existing Routes (you can keep them or refactor later) ---
@notifications_bp.route('/notifications', methods=['GET'])
@jwt_required()
def get_notifications():
    """Get user notifications."""
    current_user_id = get_jwt_identity()
    notifications = Notification.query.filter_by(user_id=current_user_id).order_by(Notification.sent_at.desc()).limit(50).all()
    return jsonify([n.to_dict() for n in notifications])


@notifications_bp.route('/notifications/<int:notification_id>/read', methods=['PUT'])
@jwt_required()
def mark_notification_read(notification_id):
    """Mark notification as read."""
    current_user_id = get_jwt_identity()
    notification = Notification.query.filter_by(id=notification_id, user_id=current_user_id).first_or_404()
    notification.is_read = True
    db.session.commit()
    return jsonify({'message': 'Notification marked as read'}), 200

@notifications_bp.route('/notifications/<int:notification_id>', methods=['DELETE'])
@jwt_required()
def delete_notification(notification_id):
    """Delete a notification."""
    current_user_id = get_jwt_identity()
    notification = Notification.query.filter_by(id=notification_id, user_id=current_user_id).first_or_404()
    db.session.delete(notification)
    db.session.commit()
    return jsonify({'message': 'Notification deleted successfully'}), 200