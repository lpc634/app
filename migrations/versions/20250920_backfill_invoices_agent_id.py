"""Backfill invoices.agent_id for historical invoices

Legacy invoices may have agent_id=NULL, causing them to disappear from
agent portal. This migration backfills agent_id from related job assignments
via two paths:
1. invoice_lines.job_assignment_id -> job_assignments.agent_id
2. invoice_jobs.job_id -> job_assignments.agent_id (fallback)

Revision ID: 20250920_backfill_invoices_agent_id
Revises: 20250920_add_work_date_only
Create Date: 2025-09-20
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20250920_backfill_invoices_agent_id'
down_revision = '20250920_add_work_date_only'
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


def _has_table(table: str) -> bool:
    """Check if a table exists."""
    bind = op.get_bind()
    insp = sa.inspect(bind)
    try:
        tables = insp.get_table_names()
        return table in tables
    except Exception:
        return False


def upgrade():
    """Backfill invoices.agent_id from job assignment data."""
    bind = op.get_bind()

    # Only proceed if invoices table and agent_id column exist
    if not _has_table("invoices") or not _has_column("invoices", "agent_id"):
        print("WARNING: invoices table or agent_id column not found - skipping backfill")
        return

    # Check how many invoices have NULL agent_id
    result = bind.execute(sa.text("SELECT COUNT(*) FROM invoices WHERE agent_id IS NULL")).scalar()
    print(f"Found {result} invoices with NULL agent_id")

    if result == 0:
        print("No invoices need agent_id backfill - skipping")
        return

    updated_count = 0

    # ---- Path A: Use invoice_lines.job_assignment_id -> job_assignments.agent_id ----
    if (_has_table("invoice_lines") and
        _has_column("invoice_lines", "job_assignment_id") and
        _has_table("job_assignments") and
        _has_column("job_assignments", "agent_id")):

        print("Backfilling via invoice_lines -> job_assignments...")

        try:
            result = bind.execute(sa.text("""
                WITH picked AS (
                    SELECT
                        il.invoice_id,
                        ja.agent_id,
                        ROW_NUMBER() OVER (PARTITION BY il.invoice_id ORDER BY il.id) AS rn
                    FROM invoice_lines il
                    JOIN job_assignments ja ON ja.id = il.job_assignment_id
                    WHERE ja.agent_id IS NOT NULL
                )
                UPDATE invoices i
                SET agent_id = p.agent_id
                FROM picked p
                WHERE p.rn = 1 AND p.invoice_id = i.id AND i.agent_id IS NULL
                RETURNING i.id
            """))

            path_a_count = len(result.fetchall()) if hasattr(result, 'fetchall') else result.rowcount
            updated_count += path_a_count
            print(f"Path A: Updated {path_a_count} invoices via invoice_lines")

        except Exception as e:
            print(f"Path A failed: {e}")

    # ---- Path B (fallback): Use invoice_jobs.job_id -> job_assignments.agent_id ----
    if (_has_table("invoice_jobs") and
        _has_column("invoice_jobs", "job_id") and
        _has_table("job_assignments") and
        _has_column("job_assignments", "job_id") and
        _has_column("job_assignments", "agent_id")):

        print("Backfilling via invoice_jobs -> job_assignments...")

        try:
            # Use a more robust approach that handles the case where created_at might not exist
            result = bind.execute(sa.text("""
                WITH picked AS (
                    SELECT
                        ij.invoice_id,
                        ja.agent_id,
                        ROW_NUMBER() OVER (
                            PARTITION BY ij.invoice_id
                            ORDER BY ja.id DESC
                        ) AS rn
                    FROM invoice_jobs ij
                    JOIN job_assignments ja ON ja.job_id = ij.job_id
                    WHERE ja.agent_id IS NOT NULL
                )
                UPDATE invoices i
                SET agent_id = p.agent_id
                FROM picked p
                WHERE p.rn = 1 AND p.invoice_id = i.id AND i.agent_id IS NULL
                RETURNING i.id
            """))

            path_b_count = len(result.fetchall()) if hasattr(result, 'fetchall') else result.rowcount
            updated_count += path_b_count
            print(f"Path B: Updated {path_b_count} invoices via invoice_jobs")

        except Exception as e:
            print(f"Path B failed: {e}")

    # Final verification
    remaining_null = bind.execute(sa.text("SELECT COUNT(*) FROM invoices WHERE agent_id IS NULL")).scalar()
    print(f"✅ Backfill complete: {updated_count} invoices updated, {remaining_null} still NULL")

    if remaining_null > 0:
        print("WARNING: Some invoices still have NULL agent_id - these may be orphaned records")


def downgrade():
    """Safe no-op downgrade to preserve data integrity."""
    print("Downgrade: Keeping agent_id values to avoid breaking invoice relationships")
    # We don't want to null out agent_id as that would break the agent portal again
    pass