"""Add work_date column to invoice_lines table

This migration only adds the missing work_date column that's required by the model.
It doesn't rename existing columns to avoid complex schema changes.

Revision ID: 20250920_add_work_date_only
Revises: 20250909_add_police_interactions
Create Date: 2025-09-20
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20250920_add_work_date_only'
down_revision = '20250909_add_police_interactions'
branch_labels = None
depends_on = None


def _has_column(table: str, col: str) -> bool:
    """Check if a column exists in a table."""
    bind = op.get_bind()
    insp = sa.inspect(bind)
    try:
        columns = [c["name"] for c in insp.get_columns(table)]
        return col in columns
    except Exception:
        return False


def upgrade():
    """Add work_date column to invoice_lines if it doesn't exist."""
    bind = op.get_bind()

    # Check if invoice_lines table exists
    insp = sa.inspect(bind)
    tables = insp.get_table_names()

    if 'invoice_lines' not in tables:
        print("WARNING: invoice_lines table doesn't exist - skipping migration")
        return

    # Only add work_date if it's missing
    if not _has_column("invoice_lines", "work_date"):
        print("Adding work_date column to invoice_lines...")

        # Add column as nullable first
        op.add_column("invoice_lines", sa.Column("work_date", sa.Date(), nullable=True))

        # Build a safe COALESCE list from columns that actually exist in invoices table
        print("Checking available date columns in invoices table...")
        coalesce_parts = []

        # Check for common date columns that might exist
        date_candidates = ["issue_date", "created_at", "created", "inserted_at", "date_created"]
        available_columns = []

        for candidate in date_candidates:
            if _has_column("invoices", candidate):
                available_columns.append(candidate)
                print(f"   Found: invoices.{candidate}")

        # Build COALESCE parts based on database dialect
        if bind.dialect.name == 'sqlite':
            # SQLite syntax with subqueries
            for col in available_columns:
                coalesce_parts.append(f"(SELECT i.{col} FROM invoices i WHERE i.id = invoice_lines.invoice_id)")
            coalesce_parts.append("date('now')")  # SQLite current date
        else:
            # PostgreSQL syntax
            for col in available_columns:
                coalesce_parts.append(f"i.{col}::date")
            coalesce_parts.append("CURRENT_DATE")  # PostgreSQL current date

        if not coalesce_parts:
            # Fallback if no date columns found
            if bind.dialect.name == 'sqlite':
                coalesce_parts = ["date('now')"]
            else:
                coalesce_parts = ["CURRENT_DATE"]

        coalesce_sql = ", ".join(coalesce_parts)
        print(f"Backfilling work_date using: COALESCE({coalesce_sql})")

        # Execute the backfill query
        try:
            if bind.dialect.name == 'sqlite':
                # SQLite doesn't support UPDATE ... FROM
                bind.execute(sa.text(f"""
                    UPDATE invoice_lines
                    SET work_date = COALESCE({coalesce_sql})
                    WHERE work_date IS NULL
                """))
            else:
                # PostgreSQL with FROM clause
                bind.execute(sa.text(f"""
                    UPDATE invoice_lines il
                    SET work_date = COALESCE({coalesce_sql})
                    FROM invoices i
                    WHERE il.invoice_id = i.id AND il.work_date IS NULL
                """))

            print("work_date backfill completed successfully")

        except Exception as e:
            print(f"Error during backfill: {e}")
            # If backfill fails, set all to current date as fallback
            if bind.dialect.name == 'sqlite':
                bind.execute(sa.text("UPDATE invoice_lines SET work_date = date('now') WHERE work_date IS NULL"))
            else:
                bind.execute(sa.text("UPDATE invoice_lines SET work_date = CURRENT_DATE WHERE work_date IS NULL"))
            print("Applied fallback: set all work_date to current date")

        # Now make it NOT NULL
        op.alter_column("invoice_lines", "work_date", nullable=False)
        print("work_date column is now NOT NULL")

        # Add index for performance
        try:
            existing_indexes = [idx["name"] for idx in insp.get_indexes("invoice_lines")]
            if "ix_invoice_lines_work_date" not in existing_indexes:
                op.create_index("ix_invoice_lines_work_date", "invoice_lines", ["work_date"])
                print("Added index on work_date")

            if "ix_invoice_lines_invoice_id_work_date" not in existing_indexes:
                op.create_index("ix_invoice_lines_invoice_id_work_date", "invoice_lines", ["invoice_id", "work_date"])
                print("Added composite index on invoice_id, work_date")

        except Exception as e:
            print(f"Warning: Could not create indexes: {e}")

        print("✅ work_date column added successfully!")

    else:
        print("work_date column already exists - skipping")


def downgrade():
    """Safe no-op downgrade to preserve data."""
    print("Downgrade: Keeping work_date column to avoid data loss")
    # Optionally remove indexes:
    # op.drop_index("ix_invoice_lines_work_date", table_name="invoice_lines")
    # op.drop_index("ix_invoice_lines_invoice_id_work_date", table_name="invoice_lines")
    # op.drop_column("invoice_lines", "work_date")
    pass