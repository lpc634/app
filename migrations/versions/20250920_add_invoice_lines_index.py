"""Add index on invoice_lines.job_assignment_id for performance

This index improves performance of the union query used in agent invoice
endpoint to include legacy invoices linked via job assignments.

Revision ID: 20250920_add_invoice_lines_index
Revises: 20250920_backfill_invoices_agent_id
Create Date: 2025-09-20
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20250920_add_invoice_lines_index'
down_revision = '20250920_backfill_invoices_agent_id'
branch_labels = None
depends_on = None


def _has_table(table: str) -> bool:
    """Check if a table exists."""
    bind = op.get_bind()
    insp = sa.inspect(bind)
    try:
        tables = insp.get_table_names()
        return table in tables
    except Exception:
        return False


def _has_column(table: str, col: str) -> bool:
    """Check if a column exists in a table."""
    bind = op.get_bind()
    insp = sa.inspect(bind)
    try:
        columns = [c["name"] for c in insp.get_columns(table)]
        return col in columns
    except Exception:
        return False


def _has_index(table: str, index_name: str) -> bool:
    """Check if an index exists."""
    bind = op.get_bind()
    insp = sa.inspect(bind)
    try:
        indexes = [idx["name"] for idx in insp.get_indexes(table)]
        return index_name in indexes
    except Exception:
        return False


def upgrade():
    """Add index on invoice_lines.job_assignment_id if missing."""

    # Only proceed if table and column exist
    if not _has_table("invoice_lines") or not _has_column("invoice_lines", "job_assignment_id"):
        print("WARNING: invoice_lines table or job_assignment_id column not found - skipping index")
        return

    # Check if index already exists
    index_name = "ix_invoice_lines_job_assignment_id"
    if _has_index("invoice_lines", index_name):
        print(f"Index {index_name} already exists - skipping")
        return

    try:
        print(f"Creating index {index_name} on invoice_lines.job_assignment_id...")
        op.create_index(
            index_name,
            "invoice_lines",
            ["job_assignment_id"],
            unique=False
        )
        print(f"✅ Index {index_name} created successfully")

    except Exception as e:
        print(f"Warning: Could not create index {index_name}: {e}")
        # Don't fail the migration for index creation issues


def downgrade():
    """Remove the index if it exists."""
    index_name = "ix_invoice_lines_job_assignment_id"

    if _has_table("invoice_lines") and _has_index("invoice_lines", index_name):
        try:
            op.drop_index(index_name, table_name="invoice_lines")
            print(f"Dropped index {index_name}")
        except Exception as e:
            print(f"Warning: Could not drop index {index_name}: {e}")
    else:
        print(f"Index {index_name} not found - skipping")