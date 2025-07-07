from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
import enum

db = SQLAlchemy()

class User(db.Model):
    """User model."""
    
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    role = db.Column(db.String(50), nullable=False, default='agent') # 'agent' or 'admin'
    first_name = db.Column(db.String(50), nullable=False)
    last_name = db.Column(db.String(50), nullable=False)
    phone = db.Column(db.String(20), nullable=True)
    created_at = db.Column(db.DateTime, server_default=db.func.now())

    availability = db.relationship('AgentAvailability', backref='agent', lazy=True, cascade="all, delete-orphan")
    assignments = db.relationship('JobAssignment', backref='assigned_agent', lazy=True, cascade="all, delete-orphan")
    notifications = db.relationship('Notification', backref='user', lazy=True, cascade="all, delete-orphan")

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            'id': self.id,
            'email': self.email,
            'role': self.role,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'phone': self.phone,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class AgentAvailability(db.Model):
    """Model for agent's weekly availability."""
    
    __tablename__ = 'agent_availability'
    
    id = db.Column(db.Integer, primary_key=True)
    agent_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    day_of_week = db.Column(db.String(10), nullable=False)
    start_time = db.Column(db.Time, nullable=False)
    end_time = db.Column(db.Time, nullable=False)

class JobStatus(enum.Enum):
    UNASSIGNED = "Unassigned"
    ASSIGNED = "Assigned"
    IN_PROGRESS = "In Progress"
    COMPLETED = "Completed"
    CANCELLED = "Cancelled"

class Job(db.Model):
    """Model for jobs."""
    
    __tablename__ = 'jobs'
    
    id = db.Column(db.Integer, primary_key=True)
    customer_name = db.Column(db.String(100), nullable=False)
    customer_address = db.Column(db.String(200), nullable=False)
    customer_phone = db.Column(db.String(20), nullable=True)
    description = db.Column(db.Text, nullable=False)
    status = db.Column(db.Enum(JobStatus), nullable=False, default=JobStatus.UNASSIGNED)
    scheduled_date = db.Column(db.Date, nullable=True)
    scheduled_time = db.Column(db.Time, nullable=True)
    created_at = db.Column(db.DateTime, server_default=db.func.now())
    
    assignments = db.relationship('JobAssignment', backref='job', lazy=True, cascade="all, delete-orphan")

class JobAssignment(db.Model):
    """Model for assigning agents to jobs."""
    
    __tablename__ = 'job_assignments'
    
    id = db.Column(db.Integer, primary_key=True)
    job_id = db.Column(db.Integer, db.ForeignKey('jobs.id'), nullable=False)
    agent_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)

class Notification(db.Model):
    """Model for user notifications."""
    
    __tablename__ = 'notifications'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    message = db.Column(db.String(255), nullable=False)
    is_read = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, server_default=db.func.now())
