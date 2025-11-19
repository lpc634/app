from datetime import datetime
from src.extensions import db
from cryptography.fernet import Fernet
import os


class CRMEmailConfig(db.Model):
    """
    Email configuration for each admin user to connect their V3 Services email.
    Stores encrypted IMAP credentials for fetching emails per contact.
    """
    __tablename__ = 'crm_email_configs'

    id = db.Column(db.Integer, primary_key=True)
    crm_user_id = db.Column(db.Integer, db.ForeignKey('crm_users.id'), nullable=False, unique=True, index=True)

    # IMAP settings (for nebula.galaxywebsolutions.com)
    email_address = db.Column(db.String(120), nullable=False)
    imap_server = db.Column(db.String(100), nullable=False, default='nebula.galaxywebsolutions.com')
    imap_port = db.Column(db.Integer, nullable=False, default=993)
    imap_use_ssl = db.Column(db.Boolean, default=True, nullable=False)

    # Encrypted password
    encrypted_password = db.Column(db.Text, nullable=False)

    # Settings
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    last_sync = db.Column(db.DateTime, nullable=True)

    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationship
    crm_user = db.relationship('CRMUser', back_populates='email_config', foreign_keys=[crm_user_id])

    @staticmethod
    def _get_cipher():
        """Get encryption cipher using environment variable key"""
        key = os.environ.get('CRM_EMAIL_ENCRYPTION_KEY')
        if not key:
            # Generate a default key for development (in production, set this in environment)
            key = Fernet.generate_key()
        if isinstance(key, str):
            key = key.encode()
        return Fernet(key)

    def set_password(self, plain_password):
        """Encrypt and store email password"""
        cipher = self._get_cipher()
        self.encrypted_password = cipher.encrypt(plain_password.encode()).decode()

    def get_password(self):
        """Decrypt and return email password"""
        try:
            cipher = self._get_cipher()
            return cipher.decrypt(self.encrypted_password.encode()).decode()
        except Exception:
            return None

    def to_dict(self, include_password=False):
        result = {
            'id': self.id,
            'crm_user_id': self.crm_user_id,
            'email_address': self.email_address,
            'imap_server': self.imap_server,
            'imap_port': self.imap_port,
            'imap_use_ssl': self.imap_use_ssl,
            'is_active': self.is_active,
            'last_sync': self.last_sync.isoformat() if self.last_sync else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

        if include_password:
            result['password'] = self.get_password()

        return result
