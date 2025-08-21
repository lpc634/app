import pytest
from decimal import Decimal
from src.models.user import User, Job, Expense, db
from src.utils.finance import calculate_expense_vat, get_job_expense_totals
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

def create_sample_user():
    """Create a sample user for expense creation."""
    user = User(
        email="test@example.com",
        password_hash="test_hash",
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
    db.session.flush()
    return user

def create_sample_job():
    """Create a sample job for expense association."""
    job = Job(
        title="Test Security Job",
        job_type="Security",
        address="123 Test Street",
        arrival_time=datetime.utcnow(),
        agents_required=2,
        status='open',
        created_by=1
    )
    db.session.add(job)
    db.session.flush()
    return job

def test_expense_vat_calculation_standard_rate(app):
    """Test VAT calculation with standard UK rate."""
    with app.app_context():
        # Test 20% VAT on £100
        vat_amount, gross_amount = calculate_expense_vat(Decimal('100.00'), Decimal('0.20'))
        
        assert vat_amount == Decimal('20.00')
        assert gross_amount == Decimal('120.00')

def test_expense_vat_calculation_zero_rate(app):
    """Test VAT calculation with zero rate."""
    with app.app_context():
        # Test 0% VAT on £50
        vat_amount, gross_amount = calculate_expense_vat(Decimal('50.00'), Decimal('0.00'))
        
        assert vat_amount == Decimal('0.00')
        assert gross_amount == Decimal('50.00')

def test_expense_vat_calculation_reduced_rate(app):
    """Test VAT calculation with reduced rate."""
    with app.app_context():
        # Test 5% VAT on £200 (e.g., domestic fuel)
        vat_amount, gross_amount = calculate_expense_vat(Decimal('200.00'), Decimal('0.05'))
        
        assert vat_amount == Decimal('10.00')
        assert gross_amount == Decimal('210.00')

def test_expense_vat_rounding(app):
    """Test VAT calculation with rounding."""
    with app.app_context():
        # Test amount that requires rounding
        vat_amount, gross_amount = calculate_expense_vat(Decimal('33.33'), Decimal('0.20'))
        
        # 33.33 * 0.20 = 6.666, should round to 6.67
        assert vat_amount == Decimal('6.67')
        assert gross_amount == Decimal('40.00')

def test_job_expense_totals_multiple_expenses(app):
    """Test expense totals calculation with multiple expenses."""
    with app.app_context():
        sample_user = create_sample_user()
        sample_job = create_sample_job()
        # Create multiple expenses for the job
        expenses = [
            Expense(
                date=date.today(),
                category="fuel",
                description="Petrol for site visit",
                amount_net=Decimal('45.00'),
                vat_rate=Decimal('0.20'),
                vat_amount=Decimal('9.00'),
                amount_gross=Decimal('54.00'),
                job_id=sample_job.id,
                created_by=sample_user.id,
                paid_with='company_card',
                status='logged'
            ),
            Expense(
                date=date.today(),
                category="equipment",
                description="Radio batteries",
                amount_net=Decimal('25.00'),
                vat_rate=Decimal('0.20'),
                vat_amount=Decimal('5.00'),
                amount_gross=Decimal('30.00'),
                job_id=sample_job.id,
                created_by=sample_user.id,
                paid_with='cash',
                status='logged'
            ),
            Expense(
                date=date.today(),
                category="food",
                description="Lunch for agents",
                amount_net=Decimal('30.00'),
                vat_rate=Decimal('0.20'),
                vat_amount=Decimal('6.00'),
                amount_gross=Decimal('36.00'),
                job_id=sample_job.id,
                created_by=sample_user.id,
                paid_with='personal_card',
                status='logged'
            )
        ]
        
        for expense in expenses:
            db.session.add(expense)
        db.session.commit()
        
        # Test totals calculation
        result = get_job_expense_totals(sample_job.id)
        
        assert result['count'] == 3
        assert result['net'] == 100.0  # 45 + 25 + 30
        assert result['vat'] == 20.0   # 9 + 5 + 6
        assert result['gross'] == 120.0  # 54 + 30 + 36

def test_job_expense_totals_no_expenses(app):
    """Test expense totals calculation with no expenses."""
    with app.app_context():
        sample_job = create_sample_job()
        # Test with job that has no expenses
        result = get_job_expense_totals(sample_job.id)
        
        assert result['count'] == 0
        assert result['net'] == 0.0
        assert result['vat'] == 0.0
        assert result['gross'] == 0.0

def test_job_expense_totals_mixed_vat_rates(app):
    """Test expense totals with different VAT rates."""
    with app.app_context():
        sample_user = create_sample_user()
        sample_job = create_sample_job()
        # Create expenses with different VAT rates
        expenses = [
            Expense(
                date=date.today(),
                category="equipment",
                description="Standard VAT item",
                amount_net=Decimal('100.00'),
                vat_rate=Decimal('0.20'),
                vat_amount=Decimal('20.00'),
                amount_gross=Decimal('120.00'),
                job_id=sample_job.id,
                created_by=sample_user.id,
                paid_with='company_card'
            ),
            Expense(
                date=date.today(),
                category="other",
                description="Zero VAT service",
                amount_net=Decimal('50.00'),
                vat_rate=Decimal('0.00'),
                vat_amount=Decimal('0.00'),
                amount_gross=Decimal('50.00'),
                job_id=sample_job.id,
                created_by=sample_user.id,
                paid_with='cash'
            ),
            Expense(
                date=date.today(),
                category="other",
                description="Reduced VAT utility",
                amount_net=Decimal('40.00'),
                vat_rate=Decimal('0.05'),
                vat_amount=Decimal('2.00'),
                amount_gross=Decimal('42.00'),
                job_id=sample_job.id,
                created_by=sample_user.id,
                paid_with='bank_transfer'
            )
        ]
        
        for expense in expenses:
            db.session.add(expense)
        db.session.commit()
        
        # Test totals calculation
        result = get_job_expense_totals(sample_job.id)
        
        assert result['count'] == 3
        assert result['net'] == 190.0  # 100 + 50 + 40
        assert result['vat'] == 22.0   # 20 + 0 + 2
        assert result['gross'] == 212.0  # 120 + 50 + 42

def test_expense_categories(app):
    """Test that different expense categories are properly handled."""
    with app.app_context():
        sample_user = create_sample_user()
        sample_job = create_sample_job()
        # Test various expense categories
        categories = ['fuel', 'equipment', 'food', 'lodging', 'other']
        
        for i, category in enumerate(categories):
            expense = Expense(
                date=date.today(),
                category=category,
                description=f"Test {category} expense",
                amount_net=Decimal('10.00'),
                vat_rate=Decimal('0.20'),
                vat_amount=Decimal('2.00'),
                amount_gross=Decimal('12.00'),
                job_id=sample_job.id,
                created_by=sample_user.id,
                paid_with='cash'
            )
            db.session.add(expense)
        
        db.session.commit()
        
        # Verify all expenses are counted
        result = get_job_expense_totals(sample_job.id)
        assert result['count'] == 5

def test_expense_without_job(app):
    """Test expense creation without job association."""
    with app.app_context():
        sample_user = create_sample_user()
        # Create expense not associated with any job
        expense = Expense(
            date=date.today(),
            category="other",
            description="Office supplies",
            amount_net=Decimal('25.00'),
            vat_rate=Decimal('0.20'),
            vat_amount=Decimal('5.00'),
            amount_gross=Decimal('30.00'),
            job_id=None,  # No job association
            created_by=sample_user.id,
            paid_with='company_card'
        )
        db.session.add(expense)
        db.session.commit()
        
        # This should not affect job expense totals
        # Test with non-existent job ID
        result = get_job_expense_totals(999)
        assert result['count'] == 0