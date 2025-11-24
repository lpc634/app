from datetime import datetime
from src.extensions import db


class ContactFormSubmission(db.Model):
    __tablename__ = 'contact_form_submissions'

    id = db.Column(db.Integer, primary_key=True)

    # Contact Details
    first_name = db.Column(db.String(100), nullable=False)
    last_name = db.Column(db.String(100), nullable=False)
    company_name = db.Column(db.String(200), nullable=True)
    email = db.Column(db.String(255), nullable=False)
    phone = db.Column(db.String(50), nullable=False)
    site_postcode = db.Column(db.String(20), nullable=True)
    callback_requested = db.Column(db.Boolean, default=False, nullable=False)
    comments = db.Column(db.Text, nullable=True)

    # GPT Response
    gpt_reply = db.Column(db.Text, nullable=True)

    # Tracking
    request_id = db.Column(db.String(100), nullable=True, unique=True)
    telegram_sent = db.Column(db.Boolean, default=False, nullable=False)
    email_sent = db.Column(db.Boolean, default=False, nullable=False)

    # Admin Management
    status = db.Column(db.String(20), default='pending', nullable=False)  # pending, contacted, resolved, spam
    assigned_to_user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    admin_notes = db.Column(db.Text, nullable=True)

    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    contacted_at = db.Column(db.DateTime, nullable=True)
    resolved_at = db.Column(db.DateTime, nullable=True)

    def to_dict(self):
        from src.models.user import User
        assigned_user = User.query.get(self.assigned_to_user_id) if self.assigned_to_user_id else None
        assigned_to_name = None
        try:
            if assigned_user:
                assigned_to_name = f"{(assigned_user.first_name or '').strip()} {(assigned_user.last_name or '').strip()}".strip() or assigned_user.email
        except Exception:
            assigned_to_name = None

        return {
            'id': self.id,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'full_name': f"{self.first_name} {self.last_name}".strip(),
            'company_name': self.company_name,
            'email': self.email,
            'phone': self.phone,
            'site_postcode': self.site_postcode,
            'callback_requested': self.callback_requested,
            'comments': self.comments,
            'gpt_reply': self.gpt_reply,
            'request_id': self.request_id,
            'telegram_sent': self.telegram_sent,
            'email_sent': self.email_sent,
            'status': self.status,
            'assigned_to_user_id': self.assigned_to_user_id,
            'assigned_to_name': assigned_to_name,
            'admin_notes': self.admin_notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'contacted_at': self.contacted_at.isoformat() if self.contacted_at else None,
            'resolved_at': self.resolved_at.isoformat() if self.resolved_at else None,
        }
