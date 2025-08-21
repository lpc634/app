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
    
    # Agent invoice numbering - flexible per-agent system
    agent_invoice_next = db.Column(db.Integer, nullable=True, default=1)  # Keep for backward compatibility
    current_invoice_number = db.Column(db.Integer, nullable=True, default=0)  # New flexible numbering system
    
    # Telegram integration fields
    telegram_chat_id = db.Column(db.String(32), nullable=True)
    telegram_username = db.Column(db.String(64), nullable=True)
    telegram_opt_in = db.Column(db.Boolean, default=False)
    telegram_link_code = db.Column('telegram_link_token', db.String(16), nullable=True)
    
    assignments = db.relationship('JobAssignment', back_populates='agent', lazy=True)
    availability = db.relationship('AgentAvailability', back_populates='agent', lazy=True, cascade="all, delete-orphan")
    weekly_availability = db.relationship('AgentWeeklyAvailability', back_populates='agent', uselist=False, cascade="all, delete-orphan")
    notifications = db.relationship('Notification', back_populates='user', lazy=True, cascade="all, delete-orphan")
    invoices = db.relationship('Invoice', back_populates='agent', lazy=True, foreign_keys='Invoice.agent_id')
    push_subscriptions = db.relationship('PushSubscription', back_populates='user', lazy=True, cascade="all, delete-orphan")
    
    # --- This relationship connects the User to the new model in a separate file ---
    # Temporarily disabled to prevent model loading issues
    # vehicle_sightings = db.relationship('VehicleSighting', back_populates='agent', lazy=True)

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
            'verification_status': self.verification_status,
        }

class Job(db.Model):
    __tablename__ = 'jobs'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=True)
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
            # Avoid circular import by doing lazy import
            from src.routes.jobs import get_weather_for_job
            logger.info(f"Calling get_weather_for_job for job {self.id}")
            weather_info = get_weather_for_job(self)
            logger.info(f"Weather info returned: {weather_info}")
        except ImportError as ie:
            logger.warning(f"Could not import weather function for job {self.id}: {str(ie)}")
            weather_info = {
                'forecast': 'Weather information temporarily unavailable',
                'clothing': 'Please check weather forecast and dress appropriately for outdoor work.'
            }
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
            'agents_allocated': agents_allocated,
            'lead_agent_name': self.lead_agent_name,
            'instructions': self.instructions,
            'urgency_level': self.urgency_level,
            'status': self.status,
            'created_by': self.created_by,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'number_of_dwellings': self.number_of_dwellings,
            'police_liaison_required': self.police_liaison_required,
            'what3words_address': self.what3words_address,
            'hourly_rate': float(self.hourly_rate) if self.hourly_rate else None,
            'location_lat': self.location_lat,
            'location_lng': self.location_lng,
            'maps_link': self.maps_link,
            'weather': weather_info
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

    def to_dict(self, include_job_details=False):
        # Avoid circular references by making job_details optional
        result = {
            'id': self.id, 
            'job_id': self.job_id, 
            'agent_id': self.agent_id, 
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'response_time': self.response_time.isoformat() if self.response_time else None,
        }
        
        # Only include job details if explicitly requested and avoid circular references
        if include_job_details and self.job:
            result['job_details'] = {
                'id': self.job.id,
                'title': self.job.title,
                'job_type': self.job.job_type,
                'address': self.job.address,
                'arrival_time': self.job.arrival_time.isoformat(),
                'status': self.job.status
            }
            
        return result

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
    agent_invoice_number = db.Column(db.Integer, nullable=True)
    issue_date = db.Column(db.Date, nullable=False)
    due_date = db.Column(db.Date, nullable=False)
    total_amount = db.Column(db.Numeric(10, 2), nullable=False)
    status = db.Column(db.String(20), default='draft')
    # Snapshotted job details for PDF generation
    job_type = db.Column(db.String(50), nullable=True)
    address = db.Column(db.String(200), nullable=True)
    
    # Unique constraint will be added by migration script
    
    agent = db.relationship('User', back_populates='invoices', foreign_keys=[agent_id])
    jobs = db.relationship('InvoiceJob', back_populates='invoice', cascade="all, delete-orphan")

    def to_dict(self):
        return {
            'id': self.id,
            'agent_id': self.agent_id,
            'invoice_number': self.invoice_number,
            'agent_invoice_number': getattr(self, 'agent_invoice_number', None),
            'issue_date': self.issue_date.isoformat() if self.issue_date else None,
            'due_date': self.due_date.isoformat() if self.due_date else None,
            'total_amount': float(self.total_amount) if self.total_amount else 0.0,
            'status': self.status,
            'job_type': getattr(self, 'job_type', None),
            'address': getattr(self, 'address', None),
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


class JobBilling(db.Model):
    """Job billing configuration and aggregated financial data"""
    __tablename__ = 'job_billing'
    
    id = db.Column(db.Integer, primary_key=True)
    job_id = db.Column(db.Integer, db.ForeignKey('jobs.id'), nullable=False, unique=True)
    
    # Admin-set billing terms
    agent_count = db.Column(db.Integer, nullable=True)
    hourly_rate_net = db.Column(db.Numeric(12, 2), nullable=False)
    first_hour_rate_net = db.Column(db.Numeric(12, 2), nullable=True)
    notice_fee_net = db.Column(db.Numeric(12, 2), nullable=True)
    vat_rate = db.Column(db.Numeric(5, 4), nullable=False, default=0.20)
    
    # Manual override
    billable_hours_override = db.Column(db.Numeric(6, 2), nullable=True)
    
    # Live rollups (updated by aggregator)
    billable_hours_calculated = db.Column(db.Numeric(6, 2), nullable=False, default=0)
    first_hour_units = db.Column(db.Numeric(6, 2), nullable=False, default=0)
    
    # Snapshots (set on lock/complete)
    revenue_net_snapshot = db.Column(db.Numeric(12, 2), nullable=True)
    revenue_vat_snapshot = db.Column(db.Numeric(12, 2), nullable=True)
    revenue_gross_snapshot = db.Column(db.Numeric(12, 2), nullable=True)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    job = db.relationship('Job', backref=db.backref('billing', uselist=False, cascade='all, delete-orphan'))
    
    def to_dict(self):
        return {
            'id': self.id,
            'job_id': self.job_id,
            'agent_count': self.agent_count,
            'hourly_rate_net': float(self.hourly_rate_net) if self.hourly_rate_net else 0.0,
            'first_hour_rate_net': float(self.first_hour_rate_net) if self.first_hour_rate_net else None,
            'notice_fee_net': float(self.notice_fee_net) if self.notice_fee_net else None,
            'vat_rate': float(self.vat_rate) if self.vat_rate else 0.20,
            'billable_hours_override': float(self.billable_hours_override) if self.billable_hours_override else None,
            'billable_hours_calculated': float(self.billable_hours_calculated) if self.billable_hours_calculated else 0.0,
            'first_hour_units': float(self.first_hour_units) if self.first_hour_units else 0.0,
            'revenue_net_snapshot': float(self.revenue_net_snapshot) if self.revenue_net_snapshot else None,
            'revenue_vat_snapshot': float(self.revenue_vat_snapshot) if self.revenue_vat_snapshot else None,
            'revenue_gross_snapshot': float(self.revenue_gross_snapshot) if self.revenue_gross_snapshot else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class Expense(db.Model):
    """Job-related expenses with VAT handling"""
    __tablename__ = 'expenses'
    
    id = db.Column(db.Integer, primary_key=True)
    
    # Basic expense info
    date = db.Column(db.Date, nullable=False)
    category = db.Column(db.Enum('fuel', 'food', 'parking', 'tolls', 'equipment', 'lodging', 'notice_fees', 'other', name='expense_category'), nullable=False)
    description = db.Column(db.Text, nullable=False)
    
    # Financial data
    amount_net = db.Column(db.Numeric(12, 2), nullable=False)
    vat_rate = db.Column(db.Numeric(5, 4), nullable=False, default=0.20)
    vat_amount = db.Column(db.Numeric(12, 2), nullable=False)  # computed server-side
    amount_gross = db.Column(db.Numeric(12, 2), nullable=False)  # computed server-side
    
    # Metadata
    job_id = db.Column(db.Integer, db.ForeignKey('jobs.id'), nullable=True)
    paid_with = db.Column(db.Enum('company_card', 'cash', 'personal_card', 'bank_transfer', 'other', name='payment_method'), nullable=False)
    supplier = db.Column(db.String(100), nullable=True)
    receipt_url = db.Column(db.String(255), nullable=True)
    
    # Tracking
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    status = db.Column(db.Enum('logged', 'approved', 'reimbursed', name='expense_status'), nullable=False, default='logged')
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    job = db.relationship('Job', backref='expenses')
    creator = db.relationship('User', foreign_keys=[created_by])
    
    def to_dict(self):
        return {
            'id': self.id,
            'date': self.date.isoformat() if self.date else None,
            'category': self.category,
            'description': self.description,
            'amount_net': float(self.amount_net) if self.amount_net else 0.0,
            'vat_rate': float(self.vat_rate) if self.vat_rate else 0.20,
            'vat_amount': float(self.vat_amount) if self.vat_amount else 0.0,
            'amount_gross': float(self.amount_gross) if self.amount_gross else 0.0,
            'job_id': self.job_id,
            'paid_with': self.paid_with,
            'supplier': self.supplier,
            'receipt_url': self.receipt_url,
            'created_by': self.created_by,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'job': self.job.to_dict() if self.job else None,
            'creator_name': f"{self.creator.first_name} {self.creator.last_name}" if self.creator else None
        }
