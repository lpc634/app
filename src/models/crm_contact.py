from datetime import datetime
from src.extensions import db


class CRMContact(db.Model):
    """
    CRM contact representing eviction clients, prevention prospects, or referral partners.
    Admin-only feature for tracking sales pipeline.
    """
    __tablename__ = 'crm_contacts'

    id = db.Column(db.Integer, primary_key=True)

    # Basic info
    name = db.Column(db.String(100), nullable=False, index=True)
    email = db.Column(db.String(120), nullable=False, index=True)
    phone = db.Column(db.String(20), nullable=True)
    company_name = db.Column(db.String(100), nullable=True)

    # Classification
    contact_type = db.Column(db.String(20), nullable=False, index=True)  # 'eviction_client', 'prevention_prospect', 'referral_partner'
    how_found_us = db.Column(db.String(50), nullable=True)  # 'website', 'referral', 'google', 'repeat_client', etc.
    referral_partner_name = db.Column(db.String(100), nullable=True)  # If they came from a referral partner

    # Property/service details
    property_address = db.Column(db.Text, nullable=True)
    service_type = db.Column(db.String(50), nullable=True)  # 'eviction', 'cctv', 'security_guards', 'prevention_package'
    urgency_level = db.Column(db.String(20), nullable=True)  # 'low', 'medium', 'high', 'urgent'

    # Sales tracking
    current_stage = db.Column(db.String(50), nullable=False, default='new_inquiry', index=True)
    status = db.Column(db.String(20), nullable=False, default='active', index=True)  # 'active', 'won', 'lost', 'dormant'
    priority = db.Column(db.String(20), nullable=True, default='none', index=True)  # 'urgent', 'hot', 'nurture', 'routine', 'none'
    next_followup_date = db.Column(db.Date, nullable=True, index=True)
    potential_value = db.Column(db.Numeric(10, 2), nullable=True)  # Estimated deal value
    total_revenue = db.Column(db.Numeric(10, 2), nullable=False, default=0.0)  # Actual revenue from jobs

    # Referral partner specific fields
    total_jobs_referred = db.Column(db.Integer, nullable=False, default=0)
    last_referral_date = db.Column(db.Date, nullable=True)

    # Ownership - CRM users (separate from main admin system)
    owner_id = db.Column(db.Integer, db.ForeignKey('crm_users.id'), nullable=True, index=True)  # Which CRM user owns this contact

    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    owner = db.relationship('CRMUser', foreign_keys=[owner_id])
    notes = db.relationship('CRMNote', back_populates='contact', cascade='all, delete-orphan', lazy='dynamic')
    files = db.relationship('CRMFile', back_populates='contact', cascade='all, delete-orphan', lazy='dynamic')

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'phone': self.phone,
            'company_name': self.company_name,
            'contact_type': self.contact_type,
            'how_found_us': self.how_found_us,
            'referral_partner_name': self.referral_partner_name,
            'property_address': self.property_address,
            'service_type': self.service_type,
            'urgency_level': self.urgency_level,
            'current_stage': self.current_stage,
            'status': self.status,
            'priority': self.priority or 'none',
            'next_followup_date': self.next_followup_date.isoformat() if self.next_followup_date else None,
            'potential_value': float(self.potential_value) if self.potential_value else None,
            'total_revenue': float(self.total_revenue) if self.total_revenue else 0.0,
            'total_jobs_referred': self.total_jobs_referred,
            'last_referral_date': self.last_referral_date.isoformat() if self.last_referral_date else None,
            'owner_id': self.owner_id,
            'owner_name': self.owner.username if self.owner else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
