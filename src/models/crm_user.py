"""
CRM User Model - Separate authentication for CRM system
"""

from src.extensions import db
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime


class CRMUser(db.Model):
    __tablename__ = 'crm_users'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    is_super_admin = db.Column(db.Boolean, default=False)

    # Email sync configuration (per user)
    imap_server = db.Column(db.String(255))
    imap_port = db.Column(db.Integer)
    imap_email = db.Column(db.String(255))
    imap_password = db.Column(db.String(255))  # Encrypted
    imap_use_ssl = db.Column(db.Boolean, default=True)

    # Telegram integration (optional)
    telegram_chat_id = db.Column(db.String(50))
    telegram_opt_in = db.Column(db.Boolean, default=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def set_password(self, password):
        """Hash and set password"""
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        """Check password against hash"""
        return check_password_hash(self.password_hash, password)

    def to_dict(self, include_email_config=False):
        """Convert to dictionary"""
        result = {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'is_super_admin': self.is_super_admin,
            'has_email_configured': bool(self.imap_server and self.imap_email),
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

        if include_email_config:
            result['email_config'] = {
                'imap_server': self.imap_server,
                'imap_port': self.imap_port,
                'imap_email': self.imap_email,
                'imap_use_ssl': self.imap_use_ssl,
                'configured': bool(self.imap_server and self.imap_email)
            }

        return result
