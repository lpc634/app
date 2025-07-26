from src.extensions import db
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta

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
    
    utr_number = db.Column(db.String(50), nullable=True)
    tax_confirmation = db.Column(db.Boolean, default=False)
    id_document_url = db.Column(db.String(255), nullable=True)
    sia_document_url = db.Column(db.String(255), nullable=True)
    verification_status = db.Column(db.String(20), nullable=False, default='pending')
    
    # S3 file storage for agent documents - COMMENTED OUT UNTIL MIGRATION
    # document_files = db.Column(db.JSON, nullable=True)  # Store file metadata as JSON
    
    assignments = db.relationship('JobAssignment', back_populates='agent', lazy=True)
    availability = db.relationship('AgentAvailability', back_populates='agent', lazy=True, cascade="all, delete-orphan")
    weekly_availability = db.relationship('AgentWeeklyAvailability', back_populates='agent', uselist=False, cascade="all, delete-orphan")
    notifications = db.relationship('Notification', back_populates='user', lazy=True, cascade="all, delete-orphan")
    invoices = db.relationship('Invoice', back_populates='agent', lazy=True)
    push_subscriptions = db.relationship('PushSubscription', back_populates='user', lazy=True, cascade="all, delete-orphan")
    
    # --- This relationship connects the User to the new model in a separate file ---
    vehicle_sightings = db.relationship('VehicleSighting', back_populates='agent', lazy=True)

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
            'address_line_1': self.address_line_1,
            'address_line_2': self.address_line_2,
            'city': self.city,
            'postcode': self.postcode,
            'bank_name': self.bank_name,
            'bank_account_number': self.bank_account_number,
            'bank_sort_code': self.bank_sort_code,
            'utr_number': self.utr_number,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'id_document_url': self.id_document_url,
            'sia_document_url': self.sia_document_url,
            'verification_status': self.verification_status
            # 'document_files': self.document_files  # COMMENTED OUT UNTIL MIGRATION
        }

class Job(db.Model):
    __tablename__ = 'jobs'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    job_type = db.Column(db.String(50), nullable=False)
    address = db.Column(db.String(200), nullable=False)
    postcode = db.Column(db.String(10))
    arrival_time = db.Column(db.DateTime, nullable=False)
    agents_required = db.Column(db.Integer, default=1)
    lead_agent_name = db.Column(db.String(100))
    instructions = db.Column(db.Text)
    urgency_level = db.Column(db.String(20), default='Standard')
    status = db.Column(db.String(20), default='open')
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    number_of_dwellings = db.Column(db.Integer)
    police_liaison_required = db.Column(db.Boolean, default=False)
    what3words_address = db.Column(db.String(100))
    hourly_rate = db.Column(db.Numeric(10, 2))
    # NEW LOCATION FIELDS - Add these 3 lines
    location_lat = db.Column(db.String(20))
    location_lng = db.Column(db.String(20)) 
    maps_link = db.Column(db.String(500))

    assignments = db.relationship('JobAssignment', back_populates='job', cascade="all, delete-orphan")
    invoice_jobs = db.relationship('InvoiceJob', back_populates='job', cascade="all, delete-orphan")

    def to_dict(self):
        # Get weather information using the improved function
        import logging
        logger = logging.getLogger(__name__)
        
        logger.info(f"Job.to_dict() called for job {self.id}: {self.title}")
        logger.info(f"Job address: {self.address}")
        logger.info(f"Job coordinates: lat={self.location_lat}, lng={self.location_lng}")
        
        weather_info = None
        try:
            from src.routes.jobs import get_weather_for_job
            logger.info(f"Calling get_weather_for_job for job {self.id}")
            weather_info = get_weather_for_job(self)
            logger.info(f"Weather info returned: {weather_info}")
        except Exception as e:
            # Log the error for debugging
            logger.error(f"Error getting weather for job {self.id}: {str(e)}", exc_info=True)
            weather_info = {
                'forecast': 'Weather information unavailable - error occurred',
                'clothing': 'Please check weather forecast and dress appropriately for outdoor work.'
            }
        
        # Calculate agents allocated by counting accepted assignments
        agents_allocated = len([a for a in self.assignments if a.status == 'accepted'])
        
        return {
            'id': self.id, 
            'title': self.title, 
            'job_type': self.job_type, 
            'address': self.address, 
            'postcode': self.postcode, 
            'arrival_time': self.arrival_time.isoformat(), 
            'agents_required': self.agents_required, 
            'what3words_address': self.what3words_address,
            'location_lat': self.location_lat,
            'location_lng': self.location_lng,
            'maps_link': self.maps_link
        }

class JobAssignment(db.Model):
    __tablename__ = 'job_assignments'
    id = db.Column(db.Integer, primary_key=True)
    job_id = db.Column(db.Integer, db.ForeignKey('jobs.id'), nullable=False)
    agent_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    status = db.Column(db.String(20), default='pending')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    response_time = db.Column(db.DateTime)

    job = db.relationship('Job', back_populates='assignments')
    agent = db.relationship('User', back_populates='assignments')

    def to_dict(self):
        # Make sure the job relationship is loaded before calling to_dict()
        return {
            'id': self.id, 
            'job_id': self.job_id, 
            'agent_id': self.agent_id, 
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'response_time': self.response_time.isoformat() if self.response_time else None,
            'job_details': self.job.to_dict() if self.job else None  # This was the issue!
        }

class AgentAvailability(db.Model):
    __tablename__ = 'agent_availability'
    id = db.Column(db.Integer, primary_key=True)
    agent_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    is_available = db.Column(db.Boolean, default=False)
    is_away = db.Column(db.Boolean, default=False)
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    agent = db.relationship('User', back_populates='availability')

class AgentWeeklyAvailability(db.Model):
    __tablename__ = 'agent_weekly_availability'
    id = db.Column(db.Integer, primary_key=True)
    agent_id = db.Column(db.Integer, db.ForeignKey('users.id'), unique=True, nullable=False)
    monday = db.Column(db.Boolean, default=False)
    tuesday = db.Column(db.Boolean, default=False)
    wednesday = db.Column(db.Boolean, default=False)
    thursday = db.Column(db.Boolean, default=False)
    friday = db.Column(db.Boolean, default=False)
    saturday = db.Column(db.Boolean, default=False)
    sunday = db.Column(db.Boolean, default=False)
    agent = db.relationship('User', back_populates='weekly_availability')

class Notification(db.Model):
    __tablename__ = 'notifications'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    title = db.Column(db.String(100), nullable=False)
    message = db.Column(db.Text, nullable=False)
    is_read = db.Column(db.Boolean, default=False)
    sent_at = db.Column(db.DateTime, default=datetime.utcnow)
    type = db.Column(db.String(50))
    job_id = db.Column(db.Integer, db.ForeignKey('jobs.id'))
    user = db.relationship('User', back_populates='notifications')

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'title': self.title,
            'message': self.message,
            'is_read': self.is_read,
            'sent_at': self.sent_at.isoformat() if self.sent_at else None,
            'type': self.type,
            'job_id': self.job_id
        }

class Invoice(db.Model):
    __tablename__ = 'invoices'
    id = db.Column(db.Integer, primary_key=True)
    agent_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    invoice_number = db.Column(db.String(50), unique=True, nullable=False)
    issue_date = db.Column(db.Date, nullable=False)
    due_date = db.Column(db.Date, nullable=False)
    total_amount = db.Column(db.Numeric(10, 2), nullable=False)
    status = db.Column(db.String(20), default='draft')
    
    # S3 file storage for invoice PDFs - COMMENTED OUT UNTIL MIGRATION
    # pdf_file_url = db.Column(db.String(500), nullable=True)  # S3 key for the PDF file
    
    agent = db.relationship('User', back_populates='invoices')
    jobs = db.relationship('InvoiceJob', back_populates='invoice', cascade="all, delete-orphan")

    def to_dict(self):
        return {
            'id': self.id,
            'agent_id': self.agent_id,
            'invoice_number': self.invoice_number,
            'issue_date': self.issue_date.isoformat() if self.issue_date else None,
            'due_date': self.due_date.isoformat() if self.due_date else None,
            'total_amount': float(self.total_amount) if self.total_amount else 0.0,
            'status': self.status,
            # 'pdf_file_url': self.pdf_file_url,  # COMMENTED OUT UNTIL MIGRATION
            'jobs': [job.to_dict() for job in self.jobs] if self.jobs else []
        }

class InvoiceJob(db.Model):
    __tablename__ = 'invoice_jobs'
    id = db.Column(db.Integer, primary_key=True)
    invoice_id = db.Column(db.Integer, db.ForeignKey('invoices.id'), nullable=False)
    job_id = db.Column(db.Integer, db.ForeignKey('jobs.id'), nullable=False)
    hours_worked = db.Column(db.Numeric(5, 2), nullable=False)
    hourly_rate_at_invoice = db.Column(db.Numeric(10, 2))
    invoice = db.relationship('Invoice', back_populates='jobs')
    job = db.relationship('Job', back_populates='invoice_jobs')

    def to_dict(self):
        return {
            'id': self.id,
            'invoice_id': self.invoice_id,
            'job_id': self.job_id,
            'hours_worked': float(self.hours_worked) if self.hours_worked else 0.0,
            'hourly_rate_at_invoice': float(self.hourly_rate_at_invoice) if self.hourly_rate_at_invoice else 0.0,
            'job': self.job.to_dict() if self.job else None
        }

class PushSubscription(db.Model):
    __tablename__ = 'push_subscriptions'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    subscription_json = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    user = db.relationship('User', back_populates='push_subscriptions', lazy=True)

class FCMToken(db.Model):
    """
    Store FCM tokens for each user device
    Allows multiple tokens per user (mobile app, web browser, etc.)
    """
    __tablename__ = 'fcm_tokens'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    token = db.Column(db.String(500), nullable=False, unique=True)
    device_type = db.Column(db.String(20), nullable=False)  # 'web', 'android', 'ios'
    device_info = db.Column(db.Text)  # Store user agent, device model, etc.
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_used = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationship
    user = db.relationship('User', backref='fcm_tokens')
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'token': self.token,
            'device_type': self.device_type,
            'device_info': self.device_info,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'last_used': self.last_used.isoformat() if self.last_used else None
        }
    
    @classmethod
    def get_active_tokens_for_user(cls, user_id):
        """Get all active FCM tokens for a user"""
        return cls.query.filter_by(user_id=user_id, is_active=True).all()
    
    @classmethod
    def get_active_tokens_for_users(cls, user_ids):
        """Get all active FCM tokens for multiple users"""
        return cls.query.filter(
            cls.user_id.in_(user_ids),
            cls.is_active == True
        ).all()
    
    @classmethod
    def register_token(cls, user_id, token, device_type, device_info=None):
        """Register a new FCM token or update existing one"""
        # Check if token already exists
        existing_token = cls.query.filter_by(token=token).first()
        
        if existing_token:
            # Update existing token
            existing_token.user_id = user_id
            existing_token.device_type = device_type
            existing_token.device_info = device_info
            existing_token.is_active = True
            existing_token.last_used = datetime.utcnow()
            return existing_token
        else:
            # Create new token
            new_token = cls(
                user_id=user_id,
                token=token,
                device_type=device_type,
                device_info=device_info,
                is_active=True
            )
            db.session.add(new_token)
            return new_token
    
    @classmethod
    def deactivate_token(cls, token):
        """Deactivate an FCM token"""
        token_obj = cls.query.filter_by(token=token).first()
        if token_obj:
            token_obj.is_active = False
            return True
        return False
    
    @classmethod
    def cleanup_inactive_tokens(cls, days_old=30):
        """Remove tokens that haven't been used in X days"""
        cutoff_date = datetime.utcnow() - timedelta(days=days_old)
        inactive_tokens = cls.query.filter(
            cls.last_used < cutoff_date,
            cls.is_active == False
        ).all()
        
        for token in inactive_tokens:
            db.session.delete(token)
        
        return len(inactive_tokens)
    