"""add agent invoice numbering system

Revision ID: add_agent_invoice_numbering
Revises: make_job_title_nullable
Create Date: 2025-01-13 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'aain_20250819a3'
down_revision = 'telegram_integration_restore'
branch_labels = None
depends_on = None


def upgrade():
    """Add agent invoice numbering system with unique constraints and backfill."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    
    # Check if columns already exist
    users_columns = [col['name'] for col in inspector.get_columns('users')]
    invoices_columns = [col['name'] for col in inspector.get_columns('invoices')]
    
    # Add agent_invoice_next to users table if it doesn't exist
    if 'agent_invoice_next' not in users_columns:
        op.add_column('users', sa.Column('agent_invoice_next', sa.Integer(), nullable=False, server_default='1'))
        print("Added agent_invoice_next column to users table")
    else:
        print("agent_invoice_next column already exists in users table")
    
    # Add agent_invoice_number to invoices table if it doesn't exist
    if 'agent_invoice_number' not in invoices_columns:
        op.add_column('invoices', sa.Column('agent_invoice_number', sa.Integer(), nullable=True))
        print("Added agent_invoice_number column to invoices table")
    else:
        print("agent_invoice_number column already exists in invoices table")
    
    # Create filtered unique index for agent invoice numbers
    # This ensures uniqueness per agent only when agent_invoice_number is not NULL
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_invoices_agent_agentno
        ON invoices (agent_id, agent_invoice_number)
        WHERE agent_invoice_number IS NOT NULL
    """)
    
    # Backfill agent_invoice_next based on existing invoices
    # Use dialect-specific SQL (SQLite can't use UPDATE ... FROM)
    bind = op.get_bind()
    if bind.dialect.name == 'sqlite':
        op.execute(
            """
            UPDATE users
            SET agent_invoice_next = COALESCE(
              (
                SELECT MAX(invoices.agent_invoice_number)
                FROM invoices
                WHERE invoices.agent_id = users.id AND invoices.agent_invoice_number IS NOT NULL
              ),
              0
            ) + 1
            """
        )
    else:
        op.execute(
            """
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
            """
        )
    
    # Remove server default after backfill (skip on SQLite)
    bind = op.get_bind()
    if bind.dialect.name != 'sqlite':
        op.alter_column('users', 'agent_invoice_next', server_default=None)


def downgrade():
    """Remove agent invoice numbering system."""
    # Drop the unique index
    op.execute("DROP INDEX IF EXISTS uq_invoices_agent_agentno")
    
    # Drop the columns
    op.drop_column('invoices', 'agent_invoice_number')
    op.drop_column('users', 'agent_invoice_next')