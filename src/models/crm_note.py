from datetime import datetime
from src.extensions import db


class CRMNote(db.Model):
    """
    Notes and interaction history for CRM contacts.
    Tracks all communications and internal notes about contacts.
    """
    __tablename__ = 'crm_notes'

    id = db.Column(db.Integer, primary_key=True)
    contact_id = db.Column(db.Integer, db.ForeignKey('crm_contacts.id'), nullable=False, index=True)

    # Note content
    note_type = db.Column(db.String(20), nullable=False, index=True)  # 'call', 'email', 'meeting', 'internal', 'quote_sent'
    content = db.Column(db.Text, nullable=False)

    # Metadata
    created_by = db.Column(db.Integer, db.ForeignKey('crm_users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)

    # Relationships
    contact = db.relationship('CRMContact', back_populates='notes')
    creator = db.relationship('CRMUser', foreign_keys=[created_by])

    def to_dict(self):
        return {
            'id': self.id,
            'contact_id': self.contact_id,
            'note_type': self.note_type,
            'content': self.content,
            'created_by': self.created_by,
            'creator_name': self.creator.username if self.creator else 'Unknown',
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
