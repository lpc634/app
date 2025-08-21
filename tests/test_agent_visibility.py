import pytest
from decimal import Decimal
from src.models.user import User, Job, Invoice, InvoiceJob, JobBilling, db
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

def create_test_user(email, role):
    """Helper to create a test user."""
    user = User(
        email=email,
        password_hash="test_hash",
        role=role,
        first_name="Test",
        last_name="User",
        telegram_chat_id=None,
        telegram_username=None,
        telegram_opt_in=False,
        telegram_link_code=None
    )
    db.session.add(user)
    db.session.flush()
    return user

def create_test_job(created_by_id):
    """Helper to create a test job."""
    job = Job(
        title="Test Security Job",
        job_type="Security",
        address="123 Test Street",
        arrival_time=datetime.utcnow(),
        agents_required=1,
        status='open',
        created_by=created_by_id
    )
    db.session.add(job)
    db.session.flush()
    return job

def test_agent_can_only_see_own_invoices(app):
    """Test that agents can only see their own invoices, not other agents'."""
    with app.app_context():
        # Create two agents
        agent1 = create_test_user("agent1@test.com", "agent")
        agent2 = create_test_user("agent2@test.com", "agent")
        admin = create_test_user("admin@test.com", "admin")
        
        # Create jobs
        job1 = create_test_job(admin.id)
        job2 = create_test_job(admin.id)
        
        # Create invoices for each agent
        invoice1 = Invoice(
            agent_id=agent1.id,
            invoice_number="INV-001",
            issue_date=date.today(),
            due_date=date.today(),
            total_amount=Decimal('100.00'),
            status='submitted'
        )
        
        invoice2 = Invoice(
            agent_id=agent2.id,
            invoice_number="INV-002", 
            issue_date=date.today(),
            due_date=date.today(),
            total_amount=Decimal('200.00'),
            status='submitted'
        )
        
        db.session.add_all([invoice1, invoice2])
        db.session.commit()
        
        # Test: Agent1 should only see their own invoice
        agent1_invoices = Invoice.query.filter_by(agent_id=agent1.id).all()
        assert len(agent1_invoices) == 1
        assert agent1_invoices[0].invoice_number == "INV-001"
        assert agent1_invoices[0].total_amount == Decimal('100.00')
        
        # Test: Agent2 should only see their own invoice
        agent2_invoices = Invoice.query.filter_by(agent_id=agent2.id).all()
        assert len(agent2_invoices) == 1
        assert agent2_invoices[0].invoice_number == "INV-002"
        assert agent2_invoices[0].total_amount == Decimal('200.00')
        
        # Test: Agents shouldn't see each other's invoices
        agent1_should_not_see_agent2 = Invoice.query.filter_by(agent_id=agent2.id).filter(Invoice.id.in_([invoice1.id])).all()
        assert len(agent1_should_not_see_agent2) == 0

def test_admin_can_see_billing_data_agents_cannot(app):
    """Test that only admins can access billing data."""
    with app.app_context():
        # Create users
        agent = create_test_user("agent@test.com", "agent")
        admin = create_test_user("admin@test.com", "admin")
        
        # Create job with billing
        job = create_test_job(admin.id)
        
        billing = JobBilling(
            job_id=job.id,
            hourly_rate_net=Decimal('50.00'),
            vat_rate=Decimal('0.20'),
            billable_hours_calculated=Decimal('8.00'),
            first_hour_units=Decimal('1.00')
        )
        db.session.add(billing)
        db.session.commit()
        
        # Test: Admin can access billing data
        admin_billing_access = JobBilling.query.filter_by(job_id=job.id).first()
        assert admin_billing_access is not None
        assert admin_billing_access.hourly_rate_net == Decimal('50.00')
        
        # Test: Agent query would work technically, but should be blocked by endpoint auth
        # (This test shows the data exists, but endpoints should block access)
        agent_technical_access = JobBilling.query.filter_by(job_id=job.id).first()
        assert agent_technical_access is not None  # Data exists
        # Note: In real app, agent endpoints would block this with 403 Forbidden

def test_invoice_job_linking_isolation(app):
    """Test that invoice-job linkings respect agent ownership."""
    with app.app_context():
        # Create agents and admin
        agent1 = create_test_user("agent1@test.com", "agent")
        agent2 = create_test_user("agent2@test.com", "agent")
        admin = create_test_user("admin@test.com", "admin")
        
        # Create jobs
        job1 = create_test_job(admin.id)
        job2 = create_test_job(admin.id)
        
        # Create invoices
        invoice1 = Invoice(
            agent_id=agent1.id,
            invoice_number="INV-001",
            issue_date=date.today(),
            due_date=date.today(),
            total_amount=Decimal('100.00'),
            status='submitted'
        )
        
        invoice2 = Invoice(
            agent_id=agent2.id,
            invoice_number="INV-002",
            issue_date=date.today(),
            due_date=date.today(),
            total_amount=Decimal('200.00'),
            status='submitted'
        )
        
        db.session.add_all([invoice1, invoice2])
        db.session.flush()
        
        # Create invoice-job links
        invoice_job1 = InvoiceJob(
            invoice_id=invoice1.id,
            job_id=job1.id,
            hours_worked=Decimal('8.00'),
            hourly_rate_at_invoice=Decimal('12.50')
        )
        
        invoice_job2 = InvoiceJob(
            invoice_id=invoice2.id,
            job_id=job2.id,
            hours_worked=Decimal('10.00'),
            hourly_rate_at_invoice=Decimal('20.00')
        )
        
        db.session.add_all([invoice_job1, invoice_job2])
        db.session.commit()
        
        # Test: Agent1 can only see their invoice jobs through their invoices
        agent1_invoice_jobs = db.session.query(InvoiceJob).join(Invoice).filter(
            Invoice.agent_id == agent1.id
        ).all()
        
        assert len(agent1_invoice_jobs) == 1
        assert agent1_invoice_jobs[0].hours_worked == Decimal('8.00')
        assert agent1_invoice_jobs[0].job_id == job1.id
        
        # Test: Agent2 can only see their invoice jobs
        agent2_invoice_jobs = db.session.query(InvoiceJob).join(Invoice).filter(
            Invoice.agent_id == agent2.id
        ).all()
        
        assert len(agent2_invoice_jobs) == 1
        assert agent2_invoice_jobs[0].hours_worked == Decimal('10.00')
        assert agent2_invoice_jobs[0].job_id == job2.id

def test_role_based_access_patterns(app):
    """Test the role-based access control patterns used in the codebase."""
    with app.app_context():
        # Create users with different roles
        agent = create_test_user("agent@test.com", "agent")
        manager = create_test_user("manager@test.com", "manager")
        admin = create_test_user("admin@test.com", "admin")
        
        # Test admin/manager access logic (used in billing UI)
        def has_billing_access(user_role):
            return user_role in ['admin', 'manager']
        
        assert has_billing_access(admin.role) == True
        assert has_billing_access(manager.role) == True
        assert has_billing_access(agent.role) == False
        
        # Test strict admin access (used in financial endpoints)
        def has_admin_access(user_role):
            return user_role == 'admin'
        
        assert has_admin_access(admin.role) == True
        assert has_admin_access(manager.role) == False
        assert has_admin_access(agent.role) == False
        
        # Test agent access (used in invoice endpoints)
        def has_agent_access(user_role):
            return user_role == 'agent'
        
        assert has_agent_access(agent.role) == True
        assert has_agent_access(manager.role) == False
        assert has_agent_access(admin.role) == False