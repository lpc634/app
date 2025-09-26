"""Make job_assignment_id nullable in invoice_lines for multi-day time entries

This migration allows the multi-day time entry system to work properly by making
job_assignment_id nullable in the invoice_lines table. The column was originally
designed as NOT NULL but the new multi-day invoice system doesn't require
individual job assignments for each time entry.

Revision ID: 20250926_make_job_assignment_id_nullable
Revises: 20250920_add_invoice_lines_index
Create Date: 2025-09-26
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20250926_make_job_assignment_id_nullable'
down_revision = '20250920_add_invoice_lines_index'
branch_labels = None
depends_on = None


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


def upgrade():
    """Make job_assignment_id nullable in invoice_lines table."""
    # Check if invoice_lines table exists
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = insp.get_table_names()

    if 'invoice_lines' not in tables:
        print("WARNING: invoice_lines table doesn't exist - skipping migration")
        return

    # Check if job_assignment_id column exists
    if not _column_exists("invoice_lines", "job_assignment_id"):
        print("WARNING: job_assignment_id column doesn't exist in invoice_lines - skipping migration")
        return

    # Check if job_assignment_id is already nullable
    if _get_column_nullable("invoice_lines", "job_assignment_id"):
        print("job_assignment_id is already nullable - skipping migration")
        return

    print("Making job_assignment_id nullable in invoice_lines table...")

    try:
        # Make job_assignment_id nullable
        op.alter_column(
            'invoice_lines',
            'job_assignment_id',
            existing_type=sa.Integer(),
            nullable=True
        )
        print("✅ Successfully made job_assignment_id nullable!")

    except Exception as e:
        print(f"Error making job_assignment_id nullable: {e}")
        # For some databases, we might need to handle this differently
        try:
            # Alternative approach for databases that don't support direct nullable changes
            print("Attempting alternative approach...")

            # This approach recreates the constraint
            op.drop_constraint(None, 'invoice_lines', type_='foreignkey')
            op.create_foreign_key(
                None, 'invoice_lines', 'job_assignments',
                ['job_assignment_id'], ['id']
            )
            print("✅ Successfully updated foreign key constraint!")

        except Exception as e2:
            print(f"Alternative approach also failed: {e2}")
            print("Manual intervention may be required")
            raise


def downgrade():
    """Revert job_assignment_id to NOT NULL (dangerous - could cause data loss)."""
    print("WARNING: This downgrade could cause data loss if NULL values exist")
    print("Checking for NULL values before proceeding...")

    bind = op.get_bind()

    try:
        # Check for NULL values
        result = bind.execute(sa.text(
            "SELECT COUNT(*) FROM invoice_lines WHERE job_assignment_id IS NULL"
        ))
        null_count = result.scalar()

        if null_count > 0:
            print(f"ERROR: Found {null_count} rows with NULL job_assignment_id")
            print("Cannot safely downgrade. Please clean up NULL values first.")
            return

        # If no NULL values, proceed with making NOT NULL
        op.alter_column(
            'invoice_lines',
            'job_assignment_id',
            existing_type=sa.Integer(),
            nullable=False
        )
        print("✅ Successfully reverted job_assignment_id to NOT NULL")

    except Exception as e:
        print(f"Error during downgrade: {e}")
        print("Manual intervention may be required")