from datetime import datetime
from src.extensions import db


class CRMFile(db.Model):
    """
    File attachments for CRM contacts (quotes, contracts, photos, etc.).
    Stores files in AWS S3 using existing S3 infrastructure.
    """
    __tablename__ = 'crm_files'

    id = db.Column(db.Integer, primary_key=True)
    contact_id = db.Column(db.Integer, db.ForeignKey('crm_contacts.id'), nullable=False, index=True)

    # File info
    file_name = db.Column(db.String(255), nullable=False)
    file_type = db.Column(db.String(50), nullable=True)  # MIME type or extension
    file_size = db.Column(db.Integer, nullable=True)  # Size in bytes
    s3_url = db.Column(db.String(500), nullable=False)  # S3 URL or key

    # Categorization
    category = db.Column(db.String(50), nullable=True)  # 'quote', 'contract', 'photo', 'document', 'other'
    description = db.Column(db.Text, nullable=True)

    # Metadata
    uploaded_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)

    # Relationships
    contact = db.relationship('CRMContact', back_populates='files')
    uploader = db.relationship('User', foreign_keys=[uploaded_by])

    def to_dict(self):
        return {
            'id': self.id,
            'contact_id': self.contact_id,
            'file_name': self.file_name,
            'file_type': self.file_type,
            'file_size': self.file_size,
            's3_url': self.s3_url,
            'category': self.category,
            'description': self.description,
            'uploaded_by': self.uploaded_by,
            'uploader_name': f"{self.uploader.first_name} {self.uploader.last_name}" if self.uploader else None,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
