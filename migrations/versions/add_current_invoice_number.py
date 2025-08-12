"""add current_invoice_number field for flexible numbering

Revision ID: add_current_invoice_number
Revises: add_agent_invoice_numbering
Create Date: 2025-08-12 15:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_current_invoice_number'
down_revision = 'add_agent_invoice_numbering'
branch_labels = None
depends_on = None


def upgrade():
    """Add current_invoice_number field for flexible per-agent numbering system."""
    # Add current_invoice_number to users table
    op.add_column('users', sa.Column('current_invoice_number', sa.Integer(), nullable=True, default=0))
    
    # Backfill current_invoice_number from agent_invoice_next (backward compatibility)
    # Set current_invoice_number to agent_invoice_next - 1 (representing the last used number)
    op.execute("""
        UPDATE users 
        SET current_invoice_number = COALESCE(agent_invoice_next - 1, 0)
        WHERE agent_invoice_next IS NOT NULL
    """)
    
    # For users with no agent_invoice_next, set to 0 (fresh start)
    op.execute("""
        UPDATE users 
        SET current_invoice_number = 0
        WHERE agent_invoice_next IS NULL
    """)


def downgrade():
    """Remove current_invoice_number field."""
    op.drop_column('users', 'current_invoice_number')