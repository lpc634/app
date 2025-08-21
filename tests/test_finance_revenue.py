import pytest
from decimal import Decimal
from src.models.user import User, Job, JobBilling, Expense, db
from src.utils.finance import (
    calculate_job_revenue,
    calculate_expense_vat,
    get_job_expense_totals,
    calculate_job_profit
)
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

def test_revenue_calculation_basic(app):
    """Test basic revenue calculation with formula."""
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
        
        # Create billing with known values
        # H=30, R=45, R1=120, F=3, NF=75, V=0.20
        billing = JobBilling(
            job_id=job.id,
            hourly_rate_net=Decimal('45.00'),
            first_hour_rate_net=Decimal('120.00'),
            notice_fee_net=Decimal('75.00'),
            vat_rate=Decimal('0.20'),
            billable_hours_calculated=Decimal('30.00'),
            first_hour_units=Decimal('3.00')
        )
        db.session.add(billing)
        db.session.commit()
        
        # Test revenue calculation
        result = calculate_job_revenue(billing)
        
        # Expected: base = 30 * 45 = 1350
        # uplift = 3 * (120 - 45) = 225
        # net = 1350 + 225 + 75 = 1650
        # vat = 1650 * 0.20 = 330
        # gross = 1650 + 330 = 1980
        
        assert result['revenue_net'] == 1650.0
        assert result['revenue_vat'] == 330.0
        assert result['revenue_gross'] == 1980.0

def test_revenue_calculation_with_override(app):
    """Test revenue calculation with billable hours override."""
    with app.app_context():
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
        
        # Billing with override hours
        billing = JobBilling(
            job_id=job.id,
            hourly_rate_net=Decimal('50.00'),
            vat_rate=Decimal('0.20'),
            billable_hours_calculated=Decimal('20.00'),  # Calculated
            billable_hours_override=Decimal('25.00'),    # Override should be used
            first_hour_units=Decimal('2.00')
        )
        db.session.add(billing)
        db.session.commit()
        
        result = calculate_job_revenue(billing)
        
        # Should use override hours (25) not calculated (20)
        # base = 25 * 50 = 1250
        # no first hour premium or notice fee
        # net = 1250, vat = 250, gross = 1500
        
        assert result['revenue_net'] == 1250.0
        assert result['revenue_vat'] == 250.0
        assert result['revenue_gross'] == 1500.0

def test_revenue_calculation_no_premium(app):
    """Test revenue calculation without first hour premium."""
    with app.app_context():
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
        db.session.flush()
        
        # Billing without first hour rate (should default to hourly rate)
        billing = JobBilling(
            job_id=job.id,
            hourly_rate_net=Decimal('40.00'),
            vat_rate=Decimal('0.20'),
            billable_hours_calculated=Decimal('8.00'),
            first_hour_units=Decimal('1.00')
            # No first_hour_rate_net - should use hourly_rate_net
        )
        db.session.add(billing)
        db.session.commit()
        
        result = calculate_job_revenue(billing)
        
        # base = 8 * 40 = 320
        # uplift = 1 * (40 - 40) = 0
        # net = 320, vat = 64, gross = 384
        
        assert result['revenue_net'] == 320.0
        assert result['revenue_vat'] == 64.0
        assert result['revenue_gross'] == 384.0

def test_expense_vat_calculation(app):
    """Test VAT calculation for expenses."""
    with app.app_context():
        # Test standard VAT calculation
        vat_amount, gross_amount = calculate_expense_vat(Decimal('100.00'), Decimal('0.20'))
        
        assert vat_amount == Decimal('20.00')
        assert gross_amount == Decimal('120.00')
        
        # Test zero VAT
        vat_amount, gross_amount = calculate_expense_vat(Decimal('50.00'), Decimal('0.00'))
        
        assert vat_amount == Decimal('0.00')
        assert gross_amount == Decimal('50.00')

def test_job_expense_totals(app):
    """Test expense totals aggregation for a job."""
    with app.app_context():
        # Create user for expenses
        user = User(
            email="test@test.com",
            password_hash="test",
            role="admin",
            first_name="Test",
            last_name="User",
            # Initialize Telegram fields to avoid column errors
            telegram_chat_id=None,
            telegram_username=None,
            telegram_opt_in=False,
            telegram_link_code=None
        )
        db.session.add(user)
        
        # Create test job
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
        db.session.flush()
        
        # Create expenses for the job
        expense1 = Expense(
            date=date.today(),
            category="fuel",
            description="Petrol",
            amount_net=Decimal('50.00'),
            vat_rate=Decimal('0.20'),
            vat_amount=Decimal('10.00'),
            amount_gross=Decimal('60.00'),
            job_id=job.id,
            created_by=user.id,
            paid_with='company_card'
        )
        
        expense2 = Expense(
            date=date.today(),
            category="equipment",
            description="Radio battery",
            amount_net=Decimal('25.00'),
            vat_rate=Decimal('0.20'),
            vat_amount=Decimal('5.00'),
            amount_gross=Decimal('30.00'),
            job_id=job.id,
            created_by=user.id,
            paid_with='cash'
        )
        
        db.session.add_all([expense1, expense2])
        db.session.commit()
        
        # Test expense totals
        result = get_job_expense_totals(job.id)
        
        assert result['count'] == 2
        assert result['net'] == 75.0
        assert result['vat'] == 15.0
        assert result['gross'] == 90.0

def test_job_profit_calculation(app):
    """Test profit calculation combining revenue and expenses."""
    with app.app_context():
        # Create user for expenses
        user = User(
            email="test@test.com",
            password_hash="test",
            role="admin",
            first_name="Test",
            last_name="User",
            # Initialize Telegram fields to avoid column errors
            telegram_chat_id=None,
            telegram_username=None,
            telegram_opt_in=False,
            telegram_link_code=None
        )
        db.session.add(user)
        
        # Create test job
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
        db.session.flush()
        
        # Create billing (revenue = £600 net, £720 gross)
        billing = JobBilling(
            job_id=job.id,
            hourly_rate_net=Decimal('50.00'),
            vat_rate=Decimal('0.20'),
            billable_hours_calculated=Decimal('12.00'),
            first_hour_units=Decimal('1.00')
        )
        db.session.add(billing)
        
        # Create expense (£100 net, £120 gross)
        expense = Expense(
            date=date.today(),
            category="fuel",
            description="Fuel",
            amount_net=Decimal('100.00'),
            vat_rate=Decimal('0.20'),
            vat_amount=Decimal('20.00'),
            amount_gross=Decimal('120.00'),
            job_id=job.id,
            created_by=user.id,
            paid_with='company_card'
        )
        db.session.add(expense)
        db.session.commit()
        
        # Test profit calculation
        result = calculate_job_profit(job.id)
        
        # Revenue: 12 * 50 = 600 net, 720 gross
        # Expenses: 100 net, 120 gross
        # Agent invoices: 0 (none created)
        # Profit: 500 net, 600 gross
        
        assert result['profit_net'] == 500.0
        assert result['profit_gross'] == 600.0

def test_no_billing_revenue(app):
    """Test revenue calculation returns zero when no billing config."""
    with app.app_context():
        # Test with None billing
        result = calculate_job_revenue(None)
        
        assert result['revenue_net'] == 0
        assert result['revenue_vat'] == 0
        assert result['revenue_gross'] == 0