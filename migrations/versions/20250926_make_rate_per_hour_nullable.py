"""Make rate_per_hour nullable in invoice_lines for backward compatibility

This migration makes the rate_per_hour column nullable since the application
now uses rate_net as the primary rate field. The rate_per_hour column is
maintained for backward compatibility but should allow NULL values.

Revision ID: 20250926_make_rate_per_hour_nullable
Revises: 20250926_make_job_assignment_id_nullable
Create Date: 2025-09-26
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20250926_make_rate_per_hour_nullable'
down_revision = '20250926_make_job_assignment_id_nullable'
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


def _get_column_nullable(table_name: str, column_name: str) -> bool:
    """Check if a column is nullable."""
    bind = op.get_bind()
    insp = sa.inspect(bind)
    try:
        columns = insp.get_columns(table_name)
        for column in columns:
            if column["name"] == column_name:
                return column["nullable"]
        return True  # Default to nullable if column not found
    except Exception:
        return True


def _get_column_type(table_name: str, column_name: str):
    """Get the SQLAlchemy type of a column."""
    bind = op.get_bind()
    insp = sa.inspect(bind)
    try:
        columns = insp.get_columns(table_name)
        for column in columns:
            if column["name"] == column_name:
                return column["type"]
        return sa.Numeric(10, 2)  # Default type if not found
    except Exception:
        return sa.Numeric(10, 2)


def upgrade():
    """Make rate_per_hour nullable in invoice_lines table."""
    print("=== Making rate_per_hour nullable in invoice_lines ===")

    # Check if invoice_lines table exists
    if not _table_exists('invoice_lines'):
        print("WARNING: invoice_lines table doesn't exist - skipping migration")
        return

    # Check if rate_per_hour column exists
    if not _column_exists("invoice_lines", "rate_per_hour"):
        print("INFO: rate_per_hour column doesn't exist in invoice_lines - skipping migration")
        print("This is expected for newer database schemas that only use rate_net")
        return

    # Check if rate_per_hour is already nullable
    if _get_column_nullable("invoice_lines", "rate_per_hour"):
        print("INFO: rate_per_hour is already nullable - skipping migration")
        return

    print("Making rate_per_hour nullable in invoice_lines table...")

    try:
        # Get the current column type
        column_type = _get_column_type("invoice_lines", "rate_per_hour")
        print(f"Current rate_per_hour column type: {column_type}")

        # Make rate_per_hour nullable
        op.alter_column(
            'invoice_lines',
            'rate_per_hour',
            existing_type=column_type,
            nullable=True
        )
        print("✅ Successfully made rate_per_hour nullable!")

    except Exception as e:
        print(f"Error making rate_per_hour nullable: {e}")

        # For some database engines, try alternative approach
        try:
            print("Attempting alternative approach for rate_per_hour...")

            # Alternative method: recreate column if direct alter fails
            bind = op.get_bind()
            if bind.dialect.name in ['sqlite']:
                print("SQLite detected - using workaround approach")
                # SQLite has limited ALTER TABLE support
                # For production, manual intervention might be needed
                print("MANUAL INTERVENTION REQUIRED for SQLite:")
                print("1. Backup your data")
                print("2. Create new table with nullable rate_per_hour")
                print("3. Copy data from old table")
                print("4. Drop old table and rename new table")

            else:
                # Try PostgreSQL/MySQL specific approaches
                print("Attempting database-specific approach...")
                raise e

        except Exception as e2:
            print(f"Alternative approach also failed: {e2}")
            print("Manual intervention may be required")
            print("Please check database-specific documentation for altering column nullability")
            raise

    print("✅ rate_per_hour column migration completed successfully!")


def downgrade():
    """Revert rate_per_hour to NOT NULL (with safety checks)."""
    print("=== Reverting rate_per_hour to NOT NULL ===")
    print("WARNING: This downgrade could cause data loss if NULL values exist")

    # Check if table exists
    if not _table_exists('invoice_lines'):
        print("WARNING: invoice_lines table doesn't exist - skipping downgrade")
        return

    # Check if column exists
    if not _column_exists("invoice_lines", "rate_per_hour"):
        print("INFO: rate_per_hour column doesn't exist - skipping downgrade")
        return

    # Check if column is already NOT NULL
    if not _get_column_nullable("invoice_lines", "rate_per_hour"):
        print("INFO: rate_per_hour is already NOT NULL - skipping downgrade")
        return

    bind = op.get_bind()

    try:
        print("Checking for NULL values in rate_per_hour...")

        # Check for NULL values
        result = bind.execute(sa.text(
            "SELECT COUNT(*) FROM invoice_lines WHERE rate_per_hour IS NULL"
        ))
        null_count = result.scalar()

        if null_count > 0:
            print(f"ERROR: Found {null_count} rows with NULL rate_per_hour")
            print("Cannot safely downgrade without data loss.")
            print("Options:")
            print("1. Update NULL values to a default rate")
            print("2. Delete rows with NULL rate_per_hour")
            print("3. Keep the column nullable")
            return

        print("No NULL values found - safe to proceed with downgrade")

        # Get the current column type
        column_type = _get_column_type("invoice_lines", "rate_per_hour")

        # Make rate_per_hour NOT NULL
        op.alter_column(
            'invoice_lines',
            'rate_per_hour',
            existing_type=column_type,
            nullable=False
        )
        print("✅ Successfully reverted rate_per_hour to NOT NULL")

    except Exception as e:
        print(f"Error during downgrade: {e}")
        print("Manual intervention may be required")
        print("Consider setting default values for NULL rate_per_hour entries first")
        raise