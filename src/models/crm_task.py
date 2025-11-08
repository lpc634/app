from src.extensions import db
from datetime import datetime

class CRMTask(db.Model):
    __tablename__ = 'crm_tasks'

    id = db.Column(db.Integer, primary_key=True)
    crm_user_id = db.Column(db.Integer, db.ForeignKey('crm_users.id', ondelete='CASCADE'), nullable=False)
    contact_id = db.Column(db.Integer, db.ForeignKey('crm_contacts.id', ondelete='CASCADE'), nullable=False)
    task_type = db.Column(db.String(50), nullable=False)  # call, email, send_docs, site_visit, follow_up, general
    title = db.Column(db.String(255), nullable=False)
    due_date = db.Column(db.DateTime, nullable=False)
    status = db.Column(db.String(20), nullable=False, default='pending')  # pending, completed, snoozed
    completed_at = db.Column(db.DateTime, nullable=True)
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    crm_user = db.relationship('CRMUser', backref='tasks')
    contact = db.relationship('CRMContact', backref='tasks')

    def to_dict(self):
        return {
            'id': self.id,
            'crm_user_id': self.crm_user_id,
            'contact_id': self.contact_id,
            'contact_name': self.contact.name if self.contact else None,
            'task_type': self.task_type,
            'title': self.title,
            'due_date': self.due_date.isoformat() if self.due_date else None,
            'status': self.status,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'is_overdue': self.due_date < datetime.utcnow() if self.status == 'pending' else False
        }
