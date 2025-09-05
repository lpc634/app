"""Add job billing and expenses tables

Revision ID: add_job_billing_20250821
Revises: widen_version_20250819
Create Date: 2025-08-21T16:45:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_job_billing_20250821'
down_revision = 'widen_version_20250819'
branch_labels = None
depends_on = None


def upgrade():
    """Create job_billing and expenses tables (idempotent)."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    existing_tables = inspector.get_table_names()

    # Create job_billing table if missing
    if 'job_billing' not in existing_tables:
        op.create_table('job_billing',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('job_id', sa.Integer(), nullable=False),
            sa.Column('agent_count', sa.Integer(), nullable=True),
            sa.Column('hourly_rate_net', sa.Numeric(precision=12, scale=2), nullable=False),
            sa.Column('first_hour_rate_net', sa.Numeric(precision=12, scale=2), nullable=True),
            sa.Column('notice_fee_net', sa.Numeric(precision=12, scale=2), nullable=True),
            sa.Column('vat_rate', sa.Numeric(precision=5, scale=4), nullable=False, server_default='0.20'),
            sa.Column('billable_hours_override', sa.Numeric(precision=6, scale=2), nullable=True),
            sa.Column('billable_hours_calculated', sa.Numeric(precision=6, scale=2), nullable=False, server_default='0'),
            sa.Column('first_hour_units', sa.Numeric(precision=6, scale=2), nullable=False, server_default='0'),
            sa.Column('revenue_net_snapshot', sa.Numeric(precision=12, scale=2), nullable=True),
            sa.Column('revenue_vat_snapshot', sa.Numeric(precision=12, scale=2), nullable=True),
            sa.Column('revenue_gross_snapshot', sa.Numeric(precision=12, scale=2), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.ForeignKeyConstraint(['job_id'], ['jobs.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('job_id')
        )
        # Create indexes for job_billing
        existing_indexes = [idx['name'] for idx in inspector.get_indexes('job_billing')] if 'job_billing' in inspector.get_table_names() else []
        if 'ix_job_billing_job_id' not in existing_indexes:
            op.create_index(op.f('ix_job_billing_job_id'), 'job_billing', ['job_id'], unique=True)

    # Create expenses table if missing
    if 'expenses' not in existing_tables:
        op.create_table('expenses',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('date', sa.Date(), nullable=False),
            sa.Column('category', sa.String(length=32), nullable=False),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('amount_net', sa.Numeric(precision=12, scale=2), nullable=False),
            sa.Column('vat_rate', sa.Numeric(precision=5, scale=4), nullable=False, server_default='0.20'),
            sa.Column('vat_amount', sa.Numeric(precision=12, scale=2), nullable=False, server_default='0.00'),
            sa.Column('amount_gross', sa.Numeric(precision=12, scale=2), nullable=False, server_default='0.00'),
            sa.Column('job_id', sa.Integer(), nullable=True),
            sa.Column('paid_with', sa.String(length=16), nullable=True),
            sa.Column('supplier', sa.String(length=128), nullable=True),
            sa.Column('receipt_url', sa.Text(), nullable=True),
            sa.Column('created_by', sa.Integer(), nullable=False),
            sa.Column('status', sa.String(length=16), nullable=False, server_default='logged'),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
            sa.ForeignKeyConstraint(['job_id'], ['jobs.id'], ondelete='SET NULL'),
            sa.PrimaryKeyConstraint('id')
        )
        # Create indexes for expenses
        existing_exp_indexes = [idx['name'] for idx in inspector.get_indexes('expenses')] if 'expenses' in inspector.get_table_names() else []
        if 'ix_expenses_date' not in existing_exp_indexes:
            op.create_index(op.f('ix_expenses_date'), 'expenses', ['date'])
        if 'ix_expenses_job_id' not in existing_exp_indexes:
            op.create_index(op.f('ix_expenses_job_id'), 'expenses', ['job_id'])
        if 'ix_expenses_category' not in existing_exp_indexes:
            op.create_index(op.f('ix_expenses_category'), 'expenses', ['category'])
        if 'ix_expenses_created_by' not in existing_exp_indexes:
            op.create_index(op.f('ix_expenses_created_by'), 'expenses', ['created_by'])

    # Backfill job_billing for existing jobs (if table exists)
    if 'job_billing' in inspector.get_table_names():
        connection = op.get_bind()
        connection.execute(sa.text("""
            INSERT INTO job_billing (
                job_id, 
                hourly_rate_net, 
                vat_rate, 
                billable_hours_calculated, 
                first_hour_units,
                created_at,
                updated_at
            )
            SELECT 
                id, 
                45.00, 
                0.20, 
                0, 
                0,
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP
            FROM jobs 
            WHERE id NOT IN (SELECT job_id FROM job_billing);
        """))


def downgrade():
    """Drop job_billing and expenses tables."""
    
    # Drop indexes first
    op.drop_index(op.f('ix_expenses_created_by'), table_name='expenses')
    op.drop_index(op.f('ix_expenses_category'), table_name='expenses')
    op.drop_index(op.f('ix_expenses_job_id'), table_name='expenses')
    op.drop_index(op.f('ix_expenses_date'), table_name='expenses')
    
    op.drop_index(op.f('ix_job_billing_job_id'), table_name='job_billing')
    
    # Drop tables
    op.drop_table('expenses')
    op.drop_table('job_billing')