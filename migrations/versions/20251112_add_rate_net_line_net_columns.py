"""Add rate_net and line_net columns to invoice_lines table

This migration adds the new primary columns rate_net and line_net that are used
by the supplier invoicing system. These columns store the per-hour rate and line
total for invoice lines.

Revision ID: 20251112_add_rate_net_line_net
Revises: 20251108_add_telegram_to_crm_users
Create Date: 2025-11-12
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20251112_add_rate_net_line_net'
down_revision = '20251108_add_telegram_to_crm_users'
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
    """Add rate_net and line_net columns to invoice_lines table."""
    print("=== Adding rate_net and line_net columns to invoice_lines ===")

    # Check if invoice_lines table exists
    if not _table_exists('invoice_lines'):
        print("WARNING: invoice_lines table doesn't exist - skipping migration")
        return

    # Add rate_net column if it doesn't exist
    if not _column_exists('invoice_lines', 'rate_net'):
        print("Adding rate_net column...")
        try:
            op.add_column('invoice_lines',
                sa.Column('rate_net', sa.Numeric(precision=10, scale=2), nullable=True))
            print("✅ Successfully added rate_net column")
        except Exception as e:
            print(f"Error adding rate_net column: {e}")
    else:
        print("INFO: rate_net column already exists")

    # Add line_net column if it doesn't exist
    if not _column_exists('invoice_lines', 'line_net'):
        print("Adding line_net column...")
        try:
            op.add_column('invoice_lines',
                sa.Column('line_net', sa.Numeric(precision=12, scale=2), nullable=True))
            print("✅ Successfully added line_net column")
        except Exception as e:
            print(f"Error adding line_net column: {e}")
    else:
        print("INFO: line_net column already exists")

    print("\n✅ Migration completed!")
    print("\nColumn system:")
    print("  PRIMARY COLUMNS (new):")
    print("    - rate_net: Primary rate per hour field")
    print("    - line_net: Primary line total field")
    print("  LEGACY COLUMNS (for backward compatibility):")
    print("    - rate_per_hour: Legacy rate field")
    print("    - line_total: Legacy line total field")


def downgrade():
    """Remove rate_net and line_net columns from invoice_lines table."""
    print("=== Removing rate_net and line_net columns from invoice_lines ===")

    # Check if table exists
    if not _table_exists('invoice_lines'):
        print("WARNING: invoice_lines table doesn't exist - skipping downgrade")
        return

    # Remove line_net column
    if _column_exists('invoice_lines', 'line_net'):
        print("Removing line_net column...")
        try:
            op.drop_column('invoice_lines', 'line_net')
            print("✅ Successfully removed line_net column")
        except Exception as e:
            print(f"Error removing line_net column: {e}")

    # Remove rate_net column
    if _column_exists('invoice_lines', 'rate_net'):
        print("Removing rate_net column...")
        try:
            op.drop_column('invoice_lines', 'rate_net')
            print("✅ Successfully removed rate_net column")
        except Exception as e:
            print(f"Error removing rate_net column: {e}")

    print("\n✅ Downgrade completed!")
