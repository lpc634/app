"""add agent invoice numbering system

Revision ID: add_agent_invoice_numbering
Revises: make_job_title_nullable
Create Date: 2025-01-13 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'aain_20250819a3'
down_revision = 'mjtn_20250819a2'
branch_labels = None
depends_on = None


def upgrade():
    """Add agent invoice numbering system with unique constraints and backfill."""
    # Add agent_invoice_next to users table
    op.add_column('users', sa.Column('agent_invoice_next', sa.Integer(), nullable=False, server_default='1'))
    
    # Add agent_invoice_number to invoices table  
    op.add_column('invoices', sa.Column('agent_invoice_number', sa.Integer(), nullable=True))
    
    # Create filtered unique index for agent invoice numbers
    # This ensures uniqueness per agent only when agent_invoice_number is not NULL
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_invoices_agent_agentno
        ON invoices (agent_id, agent_invoice_number)
        WHERE agent_invoice_number IS NOT NULL
    """)
    
    # Backfill agent_invoice_next based on existing invoices
    # Set each user's next number to their highest agent invoice number + 1, or 1 if none
    op.execute("""
        WITH mx AS (
            SELECT agent_id, MAX(agent_invoice_number) AS mxno
            FROM invoices
            WHERE agent_invoice_number IS NOT NULL
            GROUP BY agent_id
        )
        UPDATE users u
        SET agent_invoice_next = COALESCE(mx.mxno, 0) + 1
        FROM mx
        WHERE u.id = mx.agent_id
    """)
    
    # Remove server default after backfill
    op.alter_column('users', 'agent_invoice_next', server_default=None)


def downgrade():
    """Remove agent invoice numbering system."""
    # Drop the unique index
    op.execute("DROP INDEX IF EXISTS uq_invoices_agent_agentno")
    
    # Drop the columns
    op.drop_column('invoices', 'agent_invoice_number')
    op.drop_column('users', 'agent_invoice_next')