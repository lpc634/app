"""Fix invoice_lines schema to match model expectations

Adds missing work_date column and renames columns to match current model:
- Adds work_date column (required for multi-day invoicing)
- Renames rate_per_hour -> rate_net
- Renames line_total -> line_net
- Adds notes column
- Makes job_assignment_id nullable (for backward compatibility)
- Adds proper indexes

Revision ID: 20250920_fix_invoice_lines_schema
Revises: 20250909_add_police_interactions
Create Date: 2025-09-20
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20250920_fix_invoice_lines_schema'
down_revision = '20250909_add_police_interactions'
branch_labels = None
depends_on = None


def _has_column(conn, table, column):
    """Check if a column exists in a table."""
    insp = sa.inspect(conn)
    try:
        columns = [c["name"] for c in insp.get_columns(table)]
        return column in columns
    except Exception:
        return False


def _has_index(conn, table, index_name):
    """Check if an index exists."""
    insp = sa.inspect(conn)
    try:
        indexes = [idx["name"] for idx in insp.get_indexes(table)]
        return index_name in indexes
    except Exception:
        return False


def upgrade():
    """Add missing columns and rename existing ones to match model."""
    bind = op.get_bind()

    # Check if invoice_lines table exists
    insp = sa.inspect(bind)
    tables = insp.get_table_names()

    if 'invoice_lines' not in tables:
        # Table doesn't exist, this should have been created by previous migration
        print("WARNING: invoice_lines table doesn't exist - may need to run previous migrations first")
        return

    # 1. Add work_date column if missing
    if not _has_column(bind, "invoice_lines", "work_date"):
        print("Adding work_date column to invoice_lines...")
        op.add_column("invoice_lines", sa.Column("work_date", sa.Date(), nullable=True))

        # Backfill work_date using invoice.issue_date, then invoice.created_at if available, then today
        print("Backfilling work_date from invoice dates...")

        # Handle SQLite vs PostgreSQL syntax differences
        if bind.dialect.name == 'sqlite':
            # SQLite syntax
            bind.execute(sa.text("""
                UPDATE invoice_lines
                SET work_date = COALESCE(
                    (SELECT i.issue_date FROM invoices i WHERE i.id = invoice_lines.invoice_id),
                    date('now')
                )
                WHERE work_date IS NULL
            """))
        else:
            # PostgreSQL syntax
            bind.execute(sa.text("""
                UPDATE invoice_lines il
                SET work_date = COALESCE(
                    i.issue_date::date,
                    CASE WHEN i.created_at IS NOT NULL THEN i.created_at::date ELSE CURRENT_DATE END
                )
                FROM invoices i
                WHERE il.invoice_id = i.id AND il.work_date IS NULL
            """))

        # Now make it NOT NULL
        op.alter_column("invoice_lines", "work_date", nullable=False)
        print("work_date column added and backfilled successfully.")

    # 2. Add notes column if missing
    if not _has_column(bind, "invoice_lines", "notes"):
        print("Adding notes column to invoice_lines...")
        op.add_column("invoice_lines", sa.Column("notes", sa.Text(), nullable=True))

    # 3. Rename columns to match model expectations
    if _has_column(bind, "invoice_lines", "rate_per_hour") and not _has_column(bind, "invoice_lines", "rate_net"):
        print("Renaming rate_per_hour to rate_net...")
        op.alter_column("invoice_lines", "rate_per_hour", new_column_name="rate_net")

    if _has_column(bind, "invoice_lines", "line_total") and not _has_column(bind, "invoice_lines", "line_net"):
        print("Renaming line_total to line_net...")
        op.alter_column("invoice_lines", "line_total", new_column_name="line_net")

    # 4. Make job_assignment_id nullable for backward compatibility
    if _has_column(bind, "invoice_lines", "job_assignment_id"):
        try:
            print("Making job_assignment_id nullable for backward compatibility...")
            op.alter_column("invoice_lines", "job_assignment_id", nullable=True)
        except Exception as e:
            print(f"Note: Could not make job_assignment_id nullable: {e}")

    # 5. Add indexes if they don't exist
    if not _has_index(bind, "invoice_lines", "ix_invoice_lines_work_date"):
        print("Adding index on work_date...")
        op.create_index("ix_invoice_lines_work_date", "invoice_lines", ["work_date"])

    if not _has_index(bind, "invoice_lines", "ix_invoice_lines_invoice_id_work_date"):
        print("Adding composite index on invoice_id, work_date...")
        op.create_index("ix_invoice_lines_invoice_id_work_date", "invoice_lines", ["invoice_id", "work_date"])

    print("invoice_lines schema migration completed successfully.")


def downgrade():
    """
    Safe no-op downgrade - we don't want to lose data.
    The renamed columns will keep their new names.
    """
    print("Downgrade: Keeping schema changes to avoid data loss.")
    # Optionally drop indexes if needed:
    # op.drop_index("ix_invoice_lines_work_date", table_name="invoice_lines")
    # op.drop_index("ix_invoice_lines_invoice_id_work_date", table_name="invoice_lines")
    pass