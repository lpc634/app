from flask import Blueprint, jsonify, request, current_app
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity, verify_jwt_in_request, get_jwt
from src.models.user import User, db
from werkzeug.security import check_password_hash
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr
from datetime import timedelta
import os

auth_bp = Blueprint('auth', __name__)

# Assuming existing routes like login are here
@auth_bp.route('/auth/login', methods=['POST'])
def login():
    # Example placeholder for existing login route
    data = request.get_json()
    user = User.query.filter_by(email=data['email']).first()
    if user and user.check_password(data['password']):
        access_token = create_access_token(identity=user.id)
        return jsonify(access_token=access_token), 200
    return jsonify({"msg": "Bad username or password"}), 401

# Add this for change password (logged in user)
@auth_bp.route('/auth/change-password', methods=['POST'])
@jwt_required()
def change_password():
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    
    data = request.get_json()
    old_password = data.get('old_password')
    new_password = data.get('new_password')
    
    if not old_password or not new_password:
        return jsonify({"error": "Old and new passwords are required"}), 400
    
    if not user.check_password(old_password):
        return jsonify({"error": "Incorrect old password"}), 401
    
    user.set_password(new_password)
    db.session.commit()
    return jsonify({"message": "Password changed successfully"}), 200

# Helper function to send reset email (similar to send_invoice_email in agent.py)
def send_password_reset_email(recipient_email, reset_token):
    try:
        msg = MIMEMultipart()
        mail_sender = current_app.config['MAIL_DEFAULT_SENDER']
        msg['From'] = formataddr(mail_sender) if isinstance(mail_sender, tuple) else mail_sender
        msg['To'] = recipient_email
        msg['Subject'] = "Password Reset Request"
        
        # Customize the body and link as per your frontend reset page
        body = f"Hello,\n\nTo reset your password, click the following link:\nhttps://your-frontend-domain/reset-password?token={reset_token}\n\nIf you did not request this, ignore this email.\n\nThank you,\nV3 Services"
        msg.attach(MIMEText(body, 'plain'))
        
        server = smtplib.SMTP(current_app.config['MAIL_SERVER'], current_app.config['MAIL_PORT'])
        if current_app.config['MAIL_USE_TLS']:
            server.starttls()
        server.login(current_app.config['MAIL_USERNAME'], current_app.config['MAIL_PASSWORD'])
        server.send_message(msg)
        server.quit()
        return True
    except Exception as e:
        current_app.logger.error(f"Failed to send reset email: {e}")
        return False

# Route for forgot password
@auth_bp.route('/auth/forgot-password', methods=['POST'])
def forgot_password():
    data = request.get_json()
    email = data.get('email')
    if not email:
        return jsonify({"error": "Email is required"}), 400
    
    user = User.query.filter_by(email=email).first()
    if not user:
        # Don't reveal if email exists for security
        return jsonify({"message": "If the email exists, a reset link has been sent."}), 200
    
    # Generate reset token with short expiration (e.g., 30 minutes)
    reset_token = create_access_token(identity=user.id, expires_delta=timedelta(minutes=30), additional_claims={'type': 'reset'})
    
    if send_password_reset_email(user.email, reset_token):
        return jsonify({"message": "If the email exists, a reset link has been sent."}), 200
    else:
        return jsonify({"error": "Failed to send reset email"}), 500

# Route for reset password
@auth_bp.route('/auth/reset-password', methods=['POST'])
def reset_password():
    data = request.get_json()
    token = data.get('token')
    new_password = data.get('new_password')
    
    if not token or not new_password:
        return jsonify({"error": "Token and new password are required"}), 400
    
    try:
        # Verify the token without requiring it in header
        verify_jwt_in_request(optional=True, locations=['json'])
        claims = get_jwt()
        if claims.get('type') != 'reset':
            raise ValueError("Invalid token type")
        user_id = claims['sub']
    except Exception as e:
        return jsonify({"error": "Invalid or expired token"}), 401
    
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    
    user.set_password(new_password)
    db.session.commit()
    
    # Optional: Revoke the token by adding to blocklist if implemented
    # Assuming check_if_token_revoked is for access tokens, but can extend
    
    return jsonify({"message": "Password reset successfully"}), 200

# Existing check_if_token_revoked (from main.py import)
def check_if_token_revoked(jwt_header, jwt_payload):
    # Implement if needed for revoking reset tokens too
    return False  # Placeholder