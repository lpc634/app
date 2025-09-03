"""Supplier invoicing schema and VAT support

Revision ID: supplier_invoicing_20250903
Revises: add_job_billing_20250821
Create Date: 2025-09-03
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'supplier_invoicing_20250903'
down_revision = 'add_job_billing_20250821'
branch_labels = None
depends_on = None


def upgrade():
    # 1) supplier_profiles
    op.create_table(
        'supplier_profiles',
        sa.Column('id', sa.Integer(), primary_key=True, nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('display_name', sa.String(length=255), nullable=True),
        sa.Column('vat_registered', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('vat_number', sa.String(length=64), nullable=True),
        sa.Column('invoice_prefix', sa.String(length=32), nullable=False, server_default='SUP-'),
        sa.Column('auto_link_on_signup', sa.Boolean(), nullable=False, server_default=sa.text('true')),
    )
    op.create_index(op.f('ix_supplier_profiles_email'), 'supplier_profiles', ['email'], unique=True)

    # 2) users: vat_number (nullable)
    with op.batch_alter_table('users') as batch:
        batch.add_column(sa.Column('vat_number', sa.String(length=64), nullable=True))

    # 3) job_assignments: supplied_by_email, supplier_headcount
    with op.batch_alter_table('job_assignments') as batch:
        batch.add_column(sa.Column('supplied_by_email', sa.String(length=255), nullable=True))
        batch.add_column(sa.Column('supplier_headcount', sa.Integer(), nullable=True))
    op.create_index(op.f('ix_job_assignments_supplied_by_email'), 'job_assignments', ['supplied_by_email'], unique=False)

    # 4) invoices: supplier_id (FK), vat_rate (Numeric)
    with op.batch_alter_table('invoices') as batch:
        batch.add_column(sa.Column('supplier_id', sa.Integer(), nullable=True))
        batch.add_column(sa.Column('vat_rate', sa.Numeric(precision=5, scale=4), nullable=True))
        batch.create_foreign_key('fk_invoices_supplier_id', 'supplier_profiles', ['supplier_id'], ['id'])

    # 5) invoice_lines: new table (separate from invoice_jobs) with unique job_assignment_id
    op.create_table(
        'invoice_lines',
        sa.Column('id', sa.Integer(), primary_key=True, nullable=False),
        sa.Column('invoice_id', sa.Integer(), nullable=False),
        sa.Column('job_assignment_id', sa.Integer(), nullable=False),
        sa.Column('hours', sa.Numeric(precision=6, scale=2), nullable=False),
        sa.Column('rate_per_hour', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('headcount', sa.Integer(), nullable=False),
        sa.Column('line_total', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.ForeignKeyConstraint(['invoice_id'], ['invoices.id'], name='fk_invoice_lines_invoice_id', ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['job_assignment_id'], ['job_assignments.id'], name='fk_invoice_lines_job_assignment_id', ondelete='RESTRICT')
    )
    op.create_unique_constraint('uq_invoice_lines_job_assignment_id', 'invoice_lines', ['job_assignment_id'])
    op.create_index(op.f('ix_invoice_lines_invoice_id'), 'invoice_lines', ['invoice_id'], unique=False)

    # Seed supplier_profiles with Hermes
    conn = op.get_bind()
    try:
        conn.execute(sa.text(
            """
            INSERT INTO supplier_profiles (email, display_name, vat_registered, vat_number, invoice_prefix, auto_link_on_signup)
            VALUES (:email, :display_name, :vat_registered, :vat_number, :invoice_prefix, :auto_link)
            ON CONFLICT (email) DO NOTHING
            """
        ), {
            'email': 'hermes@pavli.group',
            'display_name': 'Hermes (Supplier)',
            'vat_registered': True,
            'vat_number': None,
            'invoice_prefix': 'SUP-',
            'auto_link': True,
        })
    except Exception:
        # Best-effort seed; ignore failures on unsupported DBs
        pass


def downgrade():
    # Drop invoice_lines indexes and table
    op.drop_index(op.f('ix_invoice_lines_invoice_id'), table_name='invoice_lines')
    op.drop_constraint('uq_invoice_lines_job_assignment_id', 'invoice_lines', type_='unique')
    op.drop_table('invoice_lines')

    # invoices
    with op.batch_alter_table('invoices') as batch:
        batch.drop_constraint('fk_invoices_supplier_id', type_='foreignkey')
        batch.drop_column('supplier_id')
        batch.drop_column('vat_rate')

    # job_assignments
    op.drop_index(op.f('ix_job_assignments_supplied_by_email'), table_name='job_assignments')
    with op.batch_alter_table('job_assignments') as batch:
        batch.drop_column('supplied_by_email')
        batch.drop_column('supplier_headcount')

    # users
    with op.batch_alter_table('users') as batch:
        batch.drop_column('vat_number')

    # supplier_profiles
    op.drop_index(op.f('ix_supplier_profiles_email'), table_name='supplier_profiles')
    op.drop_table('supplier_profiles')


