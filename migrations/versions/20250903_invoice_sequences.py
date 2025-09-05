"""Add invoice_sequences table for supplier numbering

Revision ID: invoice_sequences_20250903
Revises: supplier_invoicing_20250903
Create Date: 2025-09-03
"""

from alembic import op
import sqlalchemy as sa

revision = 'invoice_sequences_20250903'
down_revision = 'supplier_invoicing_20250903'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if 'invoice_sequences' not in inspector.get_table_names():
        op.create_table(
            'invoice_sequences',
            sa.Column('id', sa.Integer(), primary_key=True, nullable=False),
            sa.Column('prefix', sa.String(length=32), nullable=False),
            sa.Column('year', sa.Integer(), nullable=False),
            sa.Column('next_seq', sa.Integer(), nullable=False, server_default='1'),
        )
        op.create_unique_constraint('uq_invoice_sequences_prefix_year', 'invoice_sequences', ['prefix', 'year'])


def downgrade():
    op.drop_constraint('uq_invoice_sequences_prefix_year', 'invoice_sequences', type_='unique')
    op.drop_table('invoice_sequences')


