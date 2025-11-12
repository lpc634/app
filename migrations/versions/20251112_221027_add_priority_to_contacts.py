"""Add priority field to crm_contacts

Revision ID: 20251112_221027
Revises: 20251112_add_rate_net_line_net
Create Date: 2025-11-12 22:10:27

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20251112_221027'
down_revision = '20251112_add_rate_net_line_net'
branch_labels = None
depends_on = None


def _table_exists(table_name: str) -> bool:
    """Check if a table exists in the database."""
    bind = op.get_bind()
    insp = sa.inspect(bind)
    try:
        tables = insp.get_table_names()
        return table_name in tables
    except Exception:
        return False


def _column_exists(table_name: str, column_name: str) -> bool:
    """Check if a column exists in the specified table."""
    bind = op.get_bind()
    insp = sa.inspect(bind)
    try:
        columns = [c["name"] for c in insp.get_columns(table_name)]
        return column_name in columns
    except Exception:
        return False


def upgrade():
    """Add priority field to crm_contacts table."""
    print("=== Adding priority field to crm_contacts ===")

    # Check if crm_contacts table exists
    if not _table_exists('crm_contacts'):
        print("WARNING: crm_contacts table doesn't exist - skipping migration")
        return

    # Add priority column if it doesn't exist
    if not _column_exists('crm_contacts', 'priority'):
        print("Adding priority column...")
        try:
            op.add_column('crm_contacts',
                sa.Column('priority', sa.String(20), nullable=True, server_default='none'))
            print("✅ Successfully added priority column")

            # Create index on priority for faster filtering
            print("Creating index on priority column...")
            op.create_index('ix_crm_contacts_priority', 'crm_contacts', ['priority'])
            print("✅ Successfully created index on priority")

        except Exception as e:
            print(f"Error adding priority column: {e}")
    else:
        print("INFO: priority column already exists")

    print("\n✅ Migration completed!")
    print("\nPriority options:")
    print("  - urgent: 🔴 Urgent contacts requiring immediate attention")
    print("  - hot: 🟡 Hot leads with high conversion potential")
    print("  - nurture: 🔵 Long-term nurture contacts")
    print("  - routine: ⚪ Routine contacts")
    print("  - none: No priority set (default)")


def downgrade():
    """Remove priority field from crm_contacts table."""
    print("=== Removing priority field from crm_contacts ===")

    # Check if table exists
    if not _table_exists('crm_contacts'):
        print("WARNING: crm_contacts table doesn't exist - skipping downgrade")
        return

    # Remove index first
    try:
        op.drop_index('ix_crm_contacts_priority', table_name='crm_contacts')
        print("✅ Dropped index on priority column")
    except Exception as e:
        print(f"Note: Could not drop index: {e}")

    # Remove priority column
    if _column_exists('crm_contacts', 'priority'):
        print("Removing priority column...")
        try:
            op.drop_column('crm_contacts', 'priority')
            print("✅ Successfully removed priority column")
        except Exception as e:
            print(f"Error removing priority column: {e}")

    print("\n✅ Downgrade completed!")
