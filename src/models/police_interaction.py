from datetime import datetime
from src.extensions import db


class PoliceInteraction(db.Model):
    __tablename__ = 'police_interactions'

    id = db.Column(db.Integer, primary_key=True)

    # Linkage to jobs (address for now; nullable job_id for future)
    job_address = db.Column(db.String(255), nullable=False)
    job_id = db.Column(db.Integer, db.ForeignKey('jobs.id'), nullable=True)

    force = db.Column(db.String(100), nullable=False)
    officers = db.Column(db.JSON, nullable=False, default=list)  # [{shoulder_number, name?}]
    reason = db.Column(db.String(200), nullable=False)
    outcome = db.Column(db.String(200), nullable=False)
    helpfulness = db.Column(db.Integer, nullable=False)
    notes = db.Column(db.Text, nullable=True)

    created_by_user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_by_role = db.Column(db.String(20), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    def to_dict(self):
        from src.models.user import User
        creator = User.query.get(self.created_by_user_id) if self.created_by_user_id else None
        created_by_name = None
        try:
            if creator:
                created_by_name = f"{(creator.first_name or '').strip()} {(creator.last_name or '').strip()}".strip() or creator.email
        except Exception:
            created_by_name = None
        return {
            'id': self.id,
            'job_address': self.job_address,
            'job_id': self.job_id,
            'force': self.force,
            'officers': self.officers or [],
            'reason': self.reason,
            'outcome': self.outcome,
            'helpfulness': self.helpfulness,
            'notes': self.notes,
            'created_by_user_id': self.created_by_user_id,
            'created_by_role': self.created_by_role,
            'created_by_name': created_by_name,
            'created_at': (self.created_at.isoformat() if self.created_at else None),
        }


