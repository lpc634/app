import pytest
from decimal import Decimal
from src.models.user import User, Job, Invoice, InvoiceJob, JobBilling, db
from src.utils.finance import update_job_hours
from datetime import datetime, date
import sys
import os

# Add src to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

@pytest.fixture
def app():
    """Create a test Flask application."""
    from main import app as flask_app
    flask_app.config['TESTING'] = True
    flask_app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    
    with flask_app.app_context():
        db.create_all()
        yield flask_app
        db.drop_all()

@pytest.fixture
def client(app):
    """Create a test client."""
    return app.test_client()

def test_hours_aggregation_basic(app):
    """Test basic hours aggregation with 3 agents."""
    with app.app_context():
        # Create test job
        job = Job(
            title="Test Job",
            job_type="Security",
            address="Test Address",
            arrival_time=datetime.utcnow(),
            agents_required=3,
            status='open',
            created_by=1
        )
        db.session.add(job)
        db.session.flush()
        
        # Create job billing
        billing = JobBilling(
            job_id=job.id,
            hourly_rate_net=Decimal('45.00'),
            vat_rate=Decimal('0.20'),
            billable_hours_calculated=Decimal('0'),
            first_hour_units=Decimal('0')
        )
        db.session.add(billing)
        
        # Create 3 agents with minimal required fields
        agents = []
        for i in range(3):
            agent = User(
                email=f"agent{i}@test.com",
                password_hash="test",
                role="agent",
                first_name=f"Agent{i}",
                last_name="Test",
                # Initialize Telegram fields to avoid column errors
                telegram_chat_id=None,
                telegram_username=None,
                telegram_opt_in=False,
                telegram_link_code=None
            )
            db.session.add(agent)
            agents.append(agent)
        
        db.session.flush()
        
        # Create invoices for each agent with 10 hours each
        for agent in agents:
            invoice = Invoice(
                agent_id=agent.id,
                invoice_number=f"INV-{agent.id}",
                issue_date=date.today(),
                due_date=date.today(),
                total_amount=Decimal('450.00'),
                status='submitted'  # Valid status
            )
            db.session.add(invoice)
            db.session.flush()
            
            invoice_job = InvoiceJob(
                invoice_id=invoice.id,
                job_id=job.id,
                hours_worked=Decimal('10.00'),
                hourly_rate_at_invoice=Decimal('45.00')
            )
            db.session.add(invoice_job)
        
        db.session.commit()
        
        # Test aggregation
        result = update_job_hours(job.id)
        
        assert result is not None
        assert result['billable_hours_calculated'] == 30.0  # 3 agents * 10 hours
        assert result['first_hour_units'] == 3.0  # 3 agents with hours > 0
        
        # Verify database was updated
        billing = JobBilling.query.filter_by(job_id=job.id).first()
        assert billing.billable_hours_calculated == Decimal('30.0')
        assert billing.first_hour_units == Decimal('3.0')

def test_hours_aggregation_draft_exclusion(app):
    """Test that draft invoices are excluded from aggregation."""
    with app.app_context():
        # Create test job and billing
        job = Job(
            title="Test Job",
            job_type="Security", 
            address="Test Address",
            arrival_time=datetime.utcnow(),
            agents_required=2,
            status='open',
            created_by=1
        )
        db.session.add(job)
        db.session.flush()
        
        billing = JobBilling(
            job_id=job.id,
            hourly_rate_net=Decimal('45.00'),
            vat_rate=Decimal('0.20')
        )
        db.session.add(billing)
        
        # Create agent with minimal required fields
        agent = User(
            email="agent@test.com",
            password_hash="test",
            role="agent",
            first_name="Agent",
            last_name="Test",
            # Initialize Telegram fields to avoid column errors
            telegram_chat_id=None,
            telegram_username=None,
            telegram_opt_in=False,
            telegram_link_code=None
        )
        db.session.add(agent)
        db.session.flush()
        
        # Create submitted invoice (should be included)
        invoice1 = Invoice(
            agent_id=agent.id,
            invoice_number="INV-1",
            issue_date=date.today(),
            due_date=date.today(),
            total_amount=Decimal('450.00'),
            status='submitted'
        )
        db.session.add(invoice1)
        db.session.flush()
        
        invoice_job1 = InvoiceJob(
            invoice_id=invoice1.id,
            job_id=job.id,
            hours_worked=Decimal('10.00')
        )
        db.session.add(invoice_job1)
        
        # Create draft invoice (should be excluded)
        invoice2 = Invoice(
            agent_id=agent.id,
            invoice_number="INV-2", 
            issue_date=date.today(),
            due_date=date.today(),
            total_amount=Decimal('225.00'),
            status='draft'  # Draft status - should be excluded
        )
        db.session.add(invoice2)
        db.session.flush()
        
        invoice_job2 = InvoiceJob(
            invoice_id=invoice2.id,
            job_id=job.id,
            hours_worked=Decimal('5.00')
        )
        db.session.add(invoice_job2)
        
        db.session.commit()
        
        # Test aggregation
        result = update_job_hours(job.id)
        
        # Should only count the submitted invoice, not the draft
        assert result['billable_hours_calculated'] == 10.0  # Only the submitted invoice
        assert result['first_hour_units'] == 1.0  # Only 1 agent with valid hours

def test_first_hour_all_or_nothing(app):
    """Test first-hour units calculation with all-or-nothing logic."""
    with app.app_context():
        # Create test job and billing
        job = Job(
            title="Test Job",
            job_type="Security",
            address="Test Address", 
            arrival_time=datetime.utcnow(),
            agents_required=3,
            status='open',
            created_by=1
        )
        db.session.add(job)
        db.session.flush()
        
        billing = JobBilling(
            job_id=job.id,
            hourly_rate_net=Decimal('45.00'),
            vat_rate=Decimal('0.20')
        )
        db.session.add(billing)
        
        # Create 3 agents with minimal required fields
        agents = []
        for i in range(3):
            agent = User(
                email=f"agent{i}@test.com",
                password_hash="test",
                role="agent",
                first_name=f"Agent{i}",
                last_name="Test",
                # Initialize Telegram fields to avoid column errors
                telegram_chat_id=None,
                telegram_username=None,
                telegram_opt_in=False,
                telegram_link_code=None
            )
            db.session.add(agent)
            agents.append(agent)
        
        db.session.flush()
        
        # Agent 1: 5.5 hours (should get 1 first-hour unit)
        invoice1 = Invoice(
            agent_id=agents[0].id,
            invoice_number="INV-1",
            issue_date=date.today(),
            due_date=date.today(),
            total_amount=Decimal('200.00'),
            status='paid'
        )
        db.session.add(invoice1)
        db.session.flush()
        
        invoice_job1 = InvoiceJob(
            invoice_id=invoice1.id,
            job_id=job.id,
            hours_worked=Decimal('5.5')
        )
        db.session.add(invoice_job1)
        
        # Agent 2: 0.25 hours (should get 1 first-hour unit)
        invoice2 = Invoice(
            agent_id=agents[1].id,
            invoice_number="INV-2",
            issue_date=date.today(),
            due_date=date.today(), 
            total_amount=Decimal('50.00'),
            status='sent'
        )
        db.session.add(invoice2)
        db.session.flush()
        
        invoice_job2 = InvoiceJob(
            invoice_id=invoice2.id,
            job_id=job.id,
            hours_worked=Decimal('0.25')
        )
        db.session.add(invoice_job2)
        
        # Agent 3: 0 hours (should get 0 first-hour units)
        invoice3 = Invoice(
            agent_id=agents[2].id,
            invoice_number="INV-3",
            issue_date=date.today(),
            due_date=date.today(),
            total_amount=Decimal('0.00'),
            status='submitted'
        )
        db.session.add(invoice3)
        db.session.flush()
        
        invoice_job3 = InvoiceJob(
            invoice_id=invoice3.id,
            job_id=job.id,
            hours_worked=Decimal('0.00')
        )
        db.session.add(invoice_job3)
        
        db.session.commit()
        
        # Test aggregation
        result = update_job_hours(job.id)
        
        # Total hours: 5.5 + 0.25 + 0 = 5.75
        assert result['billable_hours_calculated'] == 5.75
        
        # First-hour units: 2 agents with hours > 0 (agents 1 and 2)
        assert result['first_hour_units'] == 2.0

def test_no_billing_config(app):
    """Test that function returns None when no billing config exists."""
    with app.app_context():
        # Create job without billing config
        job = Job(
            title="Test Job",
            job_type="Security",
            address="Test Address",
            arrival_time=datetime.utcnow(),
            agents_required=1,
            status='open',
            created_by=1
        )
        db.session.add(job)
        db.session.commit()
        
        # Test aggregation
        result = update_job_hours(job.id)
        
        # Should return None when no billing config
        assert result is None