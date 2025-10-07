from src.extensions import db
from datetime import datetime
import secrets


class AuthorityToActToken(db.Model):
    """Model for storing unique tokens for Authority to Act forms."""
    __tablename__ = 'authority_to_act_tokens'

    id = db.Column(db.Integer, primary_key=True)

    # Unique token for accessing the form
    token = db.Column(db.String(64), unique=True, nullable=False, index=True)

    # Form type identifier
    form_type = db.Column(db.String(100), nullable=True)  # e.g., 'authority-to-act-squatter-eviction'

    # Job reference (optional - form can be standalone or linked to a job)
    job_id = db.Column(db.Integer, db.ForeignKey('jobs.id'), nullable=True)

    # Admin who created the link
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)

    # Metadata
    client_name = db.Column(db.String(255), nullable=True)  # Optional pre-fill
    client_email = db.Column(db.String(255), nullable=True)  # Optional pre-fill
    property_address = db.Column(db.String(500), nullable=True)  # Optional pre-fill

    # Status tracking
    status = db.Column(db.String(20), default='pending')  # pending, submitted, expired, permanent
    is_read = db.Column(db.Boolean, default=False, nullable=False)  # Track if admin has viewed

    # Submission tracking
    submitted_at = db.Column(db.DateTime, nullable=True)
    submission_data = db.Column(db.JSON, nullable=True)  # Full form submission

    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    expires_at = db.Column(db.DateTime, nullable=True)  # Optional expiration

    # Relationships
    job = db.relationship('Job', backref='authority_to_act_forms', foreign_keys=[job_id])
    creator = db.relationship('User', backref='created_authority_forms', foreign_keys=[created_by])

    @staticmethod
    def generate_token():
        """Generate a secure random token."""
        return secrets.token_urlsafe(12)  # 12 bytes = ~16 characters URL-safe

    def to_dict(self):
        """Convert token to dictionary for API responses."""
        return {
            'id': self.id,
            'token': self.token,
            'job_id': self.job_id,
            'created_by': self.created_by,
            'client_name': self.client_name,
            'client_email': self.client_email,
            'property_address': self.property_address,
            'status': self.status,
            'submitted_at': self.submitted_at.isoformat() if self.submitted_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'expires_at': self.expires_at.isoformat() if self.expires_at else None,
        }

    def is_valid(self):
        """Check if token is still valid."""
        if self.status != 'pending':
            return False
        if self.expires_at and datetime.utcnow() > self.expires_at:
            return False
        return True
