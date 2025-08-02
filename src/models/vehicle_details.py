from src.extensions import db
from datetime import datetime

class VehicleDetails(db.Model):
    __tablename__ = 'vehicle_details'
    
    id = db.Column(db.Integer, primary_key=True)
    registration_plate = db.Column(db.String(15), nullable=False, unique=True, index=True)
    make = db.Column(db.String(50), nullable=True)
    model = db.Column(db.String(100), nullable=True)
    colour = db.Column(db.String(30), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'registration_plate': self.registration_plate,
            'make': self.make,
            'model': self.model,
            'colour': self.colour,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
    
    def display_text(self):
        """Generate display text for vehicle details"""
        parts = []
        if self.make:
            parts.append(self.make)
        if self.model:
            parts.append(self.model)
        
        vehicle_text = ' '.join(parts) if parts else ''
        
        if self.colour and vehicle_text:
            return f"{vehicle_text} ({self.colour})"
        elif vehicle_text:
            return vehicle_text
        elif self.colour:
            return self.colour
        else:
            return ''
    
    def __repr__(self):
        return f'<VehicleDetails {self.registration_plate}: {self.display_text()}>'