"""
CRM Email Model - Email tracking for contacts
"""

from src.extensions import db
from datetime import datetime


class CRMEmail(db.Model):
    __tablename__ = 'crm_emails'

    id = db.Column(db.Integer, primary_key=True)
    contact_id = db.Column(db.Integer, db.ForeignKey('crm_contacts.id', ondelete='CASCADE'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('crm_users.id', ondelete='CASCADE'), nullable=False)
    email_uid = db.Column(db.String(255), nullable=False)  # Unique identifier from IMAP
    subject = db.Column(db.String(500))
    sender = db.Column(db.String(255), nullable=False)
    recipient = db.Column(db.String(255), nullable=False)
    date = db.Column(db.DateTime, nullable=False)
    body_text = db.Column(db.Text)
    body_html = db.Column(db.Text)
    is_sent = db.Column(db.Boolean, default=False, nullable=False)  # True if sent by user, False if received
    synced_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    # Relationships
    contact = db.relationship('CRMContact', backref='emails')
    user = db.relationship('CRMUser', backref='synced_emails')

    def to_dict(self):
        return {
            'id': self.id,
            'contact_id': self.contact_id,
            'subject': self.subject or '(No Subject)',
            'sender': self.sender,
            'recipient': self.recipient,
            'date': self.date.isoformat() if self.date else None,
            'body_text': self.body_text,
            'body_html': self.body_html,
            'is_sent': self.is_sent,
            'synced_at': self.synced_at.isoformat() if self.synced_at else None,
            'preview': (self.body_text or '')[:200] if self.body_text else '(No content)'
        }
