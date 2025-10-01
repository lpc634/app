from src.extensions import db
from datetime import datetime
import json


class V3JobReport(db.Model):
    """Model for storing V3 job reports with custom form data."""
    __tablename__ = 'v3_job_reports'

    id = db.Column(db.Integer, primary_key=True)

    # Job and Agent References
    job_id = db.Column(db.Integer, db.ForeignKey('jobs.id'), nullable=False)
    agent_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)

    # Report Metadata
    form_type = db.Column(db.String(50), nullable=False)  # e.g., 'traveller_eviction'
    status = db.Column(db.String(20), default='submitted')  # submitted, reviewed, approved

    # Form Data (stored as JSON)
    report_data = db.Column(db.JSON, nullable=False)  # All form fields stored here

    # Photo/Evidence URLs (stored as JSON array)
    photo_urls = db.Column(db.JSON, nullable=True)  # Array of S3 URLs

    # Timestamps
    submitted_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    reviewed_at = db.Column(db.DateTime, nullable=True)
    reviewed_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)

    # Relationships
    job = db.relationship('Job', backref='v3_reports', foreign_keys=[job_id])
    agent = db.relationship('User', backref='submitted_v3_reports', foreign_keys=[agent_id])
    reviewer = db.relationship('User', backref='reviewed_v3_reports', foreign_keys=[reviewed_by])

    def to_dict(self):
        """Convert report to dictionary for API responses."""
        return {
            'id': self.id,
            'job_id': self.job_id,
            'agent_id': self.agent_id,
            'form_type': self.form_type,
            'status': self.status,
            'report_data': self.report_data,
            'photo_urls': self.photo_urls or [],
            'submitted_at': self.submitted_at.isoformat() if self.submitted_at else None,
            'reviewed_at': self.reviewed_at.isoformat() if self.reviewed_at else None,
            'reviewed_by': self.reviewed_by,
        }

    @staticmethod
    def from_dict(data):
        """Create a V3JobReport instance from a dictionary."""
        return V3JobReport(
            job_id=data.get('job_id'),
            agent_id=data.get('agent_id'),
            form_type=data.get('form_type'),
            status=data.get('status', 'submitted'),
            report_data=data.get('report_data'),
            photo_urls=data.get('photo_urls'),
        )
