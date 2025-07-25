"""
FCM Token Management Models
Handles multiple FCM tokens per user for different devices
"""

from src.extensions import db
from datetime import datetime

class FCMToken(db.Model):
    """
    Store FCM tokens for each user device
    Allows multiple tokens per user (mobile app, web browser, etc.)
    """
    __tablename__ = 'fcm_tokens'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    token = db.Column(db.String(500), nullable=False, unique=True)
    device_type = db.Column(db.String(20), nullable=False)  # 'web', 'android', 'ios'
    device_info = db.Column(db.Text)  # Store user agent, device model, etc.
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_used = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationship
    user = db.relationship('User', backref='fcm_tokens')
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'token': self.token,
            'device_type': self.device_type,
            'device_info': self.device_info,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'last_used': self.last_used.isoformat() if self.last_used else None
        }
    
    @classmethod
    def get_active_tokens_for_user(cls, user_id):
        """Get all active FCM tokens for a user"""
        return cls.query.filter_by(user_id=user_id, is_active=True).all()
    
    @classmethod
    def get_active_tokens_for_users(cls, user_ids):
        """Get all active FCM tokens for multiple users"""
        return cls.query.filter(
            cls.user_id.in_(user_ids),
            cls.is_active == True
        ).all()
    
    @classmethod
    def register_token(cls, user_id, token, device_type, device_info=None):
        """Register a new FCM token or update existing one"""
        # Check if token already exists
        existing_token = cls.query.filter_by(token=token).first()
        
        if existing_token:
            # Update existing token
            existing_token.user_id = user_id
            existing_token.device_type = device_type
            existing_token.device_info = device_info
            existing_token.is_active = True
            existing_token.last_used = datetime.utcnow()
            return existing_token
        else:
            # Create new token
            new_token = cls(
                user_id=user_id,
                token=token,
                device_type=device_type,
                device_info=device_info,
                is_active=True
            )
            db.session.add(new_token)
            return new_token
    
    @classmethod
    def deactivate_token(cls, token):
        """Deactivate an FCM token"""
        token_obj = cls.query.filter_by(token=token).first()
        if token_obj:
            token_obj.is_active = False
            return True
        return False
    
    @classmethod
    def cleanup_inactive_tokens(cls, days_old=30):
        """Remove tokens that haven't been used in X days"""
        cutoff_date = datetime.utcnow() - timedelta(days=days_old)
        inactive_tokens = cls.query.filter(
            cls.last_used < cutoff_date,
            cls.is_active == False
        ).all()
        
        for token in inactive_tokens:
            db.session.delete(token)
        
        return len(inactive_tokens)