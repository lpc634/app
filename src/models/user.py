from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime

db = SQLAlchemy()

class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='agent')
    first_name = db.Column(db.String(50), nullable=False)
    last_name = db.Column(db.String(50), nullable=False)
    phone = db.Column(db.String(20))
    address_line_1 = db.Column(db.String(100))
    address_line_2 = db.Column(db.String(100))
    city = db.Column(db.String(50))
    postcode = db.Column(db.String(10))
    bank_name = db.Column(db.String(50))
    bank_account_number = db.Column(db.String(50))
    bank_sort_code = db.Column(db.String(20))
    fcm_token = db.Column(db.String(255))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # --- NEW COLUMNS ADDED ---
    utr_number = db.Column(db.String(50), nullable=True)
    tax_confirmation = db.Column(db.Boolean, default=False)
    id_document_url = db.Column(db.String(255), nullable=True)
    sia_document_url = db.Column(db.String(255), nullable=True)


    assignments = db.relationship('JobAssignment', back_populates='agent', lazy=True)
    availability = db.relationship('AgentAvailability', back_populates='agent', lazy=True, cascade="all, delete-orphan")
    weekly_availability = db.relationship('AgentWeeklyAvailability', back_populates='agent', uselist=False, cascade="all, delete-orphan")
    notifications = db.relationship('Notification', back_populates='user', lazy=True, cascade="all, delete-orphan")
    invoices = db.relationship('Invoice', back_populates='agent', lazy=True)
    push_subscriptions = db.relationship('PushSubscription', back_populates='user', lazy=True, cascade="all, delete-orphan")


    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {'id': self.id, 'email': self.email, 'role': self.role, 'first_name': self.first_name, 'last_name': self.last_name, 'phone': self.phone}

# ... (The rest of your models: Job, JobAssignment, etc. remain the same)