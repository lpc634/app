from src.extensions import db
from datetime import datetime

class VehicleSighting(db.Model):
    __tablename__ = 'vehicle_sightings'
    id = db.Column(db.Integer, primary_key=True)
    registration_plate = db.Column(db.String(15), nullable=False, index=True)
    notes = db.Column(db.Text, nullable=True)
    is_dangerous = db.Column(db.Boolean, default=False)
    sighted_at = db.Column(db.DateTime, default=datetime.utcnow)

    address_seen = db.Column(db.String(255), nullable=False)
    agent_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)

    # This relationship connects back to the User model
    agent = db.relationship('User', backref='vehicle_sightings')

    def to_dict(self):
        return {
            'id': self.id,
            'registration_plate': self.registration_plate,
            'notes': self.notes,
            'is_dangerous': self.is_dangerous,
            'sighted_at': self.sighted_at.isoformat(),
            'agent_name': f"{self.agent.first_name} {self.agent.last_name}" if self.agent else "Unknown",
            'address_seen': self.address_seen
        }