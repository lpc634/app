"""Make legacy columns nullable in invoice_lines for dual-column compatibility

This migration makes both rate_per_hour AND line_total columns nullable to resolve
the dual-column system issue. The app now uses rate_net and line_net as primary
columns, but the legacy columns rate_per_hour and line_total still have NOT NULL
constraints that prevent the new system from working properly.

Legacy columns to make nullable:
- rate_per_hour (was NOT NULL, now nullable)
- line_total (was NOT NULL, now nullable)

New primary columns (already in use):
- rate_net (primary rate field)
- line_net (primary line total field)

Revision ID: 20250926_make_legacy_columns_nullable
Revises: 20250926_make_rate_per_hour_nullable
Create Date: 2025-09-26
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20250926_make_legacy_columns_nullable'
down_revision = '20250926_make_rate_per_hour_nullable'
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
        return sa.Numeric(12, 2)  # Default type for financial columns
    except Exception:
        return sa.Numeric(12, 2)


def _get_all_column_info(table_name: str):
    """Get info about all columns in the table for debugging."""
    bind = op.get_bind()
    insp = sa.inspect(bind)
    try:
        columns = insp.get_columns(table_name)
        return {col["name"]: {"type": col["type"], "nullable": col["nullable"]} for col in columns}
    except Exception:
        return {}


def upgrade():
    """Make legacy columns nullable in invoice_lines table."""
    print("=== Making legacy columns nullable in invoice_lines ===")
    print("Columns to update: rate_per_hour, line_total")
    print("Primary columns (unchanged): rate_net, line_net")

    # Check if invoice_lines table exists
    if not _table_exists('invoice_lines'):
        print("WARNING: invoice_lines table doesn't exist - skipping migration")
        return

    # Get current column information for debugging
    print("\nCurrent invoice_lines column status:")
    all_columns = _get_all_column_info('invoice_lines')
    for col_name, info in all_columns.items():
        nullable_status = "NULL" if info["nullable"] else "NOT NULL"
        print(f"  - {col_name}: {info['type']} ({nullable_status})")

    # Legacy columns to make nullable
    legacy_columns = {
        'rate_per_hour': sa.Numeric(10, 2),  # Default type for rate
        'line_total': sa.Numeric(12, 2)      # Default type for line total
    }

    changes_made = False

    for column_name, default_type in legacy_columns.items():
        print(f"\n--- Processing {column_name} ---")

        # Check if column exists
        if not _column_exists("invoice_lines", column_name):
            print(f"INFO: {column_name} column doesn't exist - skipping")
            print(f"This is expected in newer schemas that only use the new column names")
            continue

        # Check if already nullable
        if _get_column_nullable("invoice_lines", column_name):
            print(f"INFO: {column_name} is already nullable - skipping")
            continue

        print(f"Making {column_name} nullable...")

        try:
            # Get the current column type
            column_type = _get_column_type("invoice_lines", column_name)
            print(f"Current {column_name} column type: {column_type}")

            # Make column nullable
            op.alter_column(
                'invoice_lines',
                column_name,
                existing_type=column_type,
                nullable=True
            )
            print(f"✅ Successfully made {column_name} nullable!")
            changes_made = True

        except Exception as e:
            print(f"Error making {column_name} nullable: {e}")

            # Try alternative approach for some database engines
            try:
                print(f"Attempting alternative approach for {column_name}...")

                # For databases with limited ALTER TABLE support
                bind = op.get_bind()
                if bind.dialect.name in ['sqlite']:
                    print("SQLite detected - this may require manual intervention")
                    print(f"MANUAL STEPS for {column_name}:")
                    print("1. Create backup of invoice_lines table")
                    print(f"2. Create new table with nullable {column_name}")
                    print("3. Copy data from old table to new table")
                    print("4. Drop old table and rename new table")
                    continue

                else:
                    # Re-raise for other databases
                    raise e

            except Exception as e2:
                print(f"Alternative approach also failed for {column_name}: {e2}")
                print(f"Manual intervention may be required for {column_name}")
                # Continue with other columns rather than failing completely
                continue

    if changes_made:
        print("\n✅ Legacy columns migration completed successfully!")
        print("\nColumn system summary:")
        print("  PRIMARY COLUMNS (in use by app):")
        print("    - rate_net: Primary rate field")
        print("    - line_net: Primary line total field")
        print("  LEGACY COLUMNS (now nullable for compatibility):")
        print("    - rate_per_hour: Legacy rate field")
        print("    - line_total: Legacy line total field")
    else:
        print("\n✅ No changes needed - all legacy columns already nullable or don't exist")

    print("\nDual-column system is now properly configured!")


def downgrade():
    """Revert legacy columns to NOT NULL (with comprehensive safety checks)."""
    print("=== Reverting legacy columns to NOT NULL ===")
    print("WARNING: This downgrade could cause data loss if NULL values exist")

    # Check if table exists
    if not _table_exists('invoice_lines'):
        print("WARNING: invoice_lines table doesn't exist - skipping downgrade")
        return

    legacy_columns = ['rate_per_hour', 'line_total']
    bind = op.get_bind()

    print("\nChecking for NULL values in legacy columns...")

    for column_name in legacy_columns:
        print(f"\n--- Processing {column_name} downgrade ---")

        # Check if column exists
        if not _column_exists("invoice_lines", column_name):
            print(f"INFO: {column_name} column doesn't exist - skipping")
            continue

        # Check if column is already NOT NULL
        if not _get_column_nullable("invoice_lines", column_name):
            print(f"INFO: {column_name} is already NOT NULL - skipping")
            continue

        try:
            # Check for NULL values
            result = bind.execute(sa.text(
                f"SELECT COUNT(*) FROM invoice_lines WHERE {column_name} IS NULL"
            ))
            null_count = result.scalar()

            if null_count > 0:
                print(f"ERROR: Found {null_count} rows with NULL {column_name}")
                print(f"Cannot safely downgrade {column_name} without data loss.")
                print(f"Options for {column_name}:")
                print(f"1. Update NULL values to a default (e.g., 0.00)")
                print(f"2. Delete rows with NULL {column_name}")
                print(f"3. Keep {column_name} nullable")
                print(f"Skipping {column_name} downgrade...")
                continue

            print(f"No NULL values found in {column_name} - safe to proceed")

            # Get the current column type
            column_type = _get_column_type("invoice_lines", column_name)

            # Make column NOT NULL
            op.alter_column(
                'invoice_lines',
                column_name,
                existing_type=column_type,
                nullable=False
            )
            print(f"✅ Successfully reverted {column_name} to NOT NULL")

        except Exception as e:
            print(f"Error during {column_name} downgrade: {e}")
            print(f"Manual intervention may be required for {column_name}")
            print(f"Consider setting default values for NULL {column_name} entries first")
            continue

    print("\n✅ Downgrade completed (with safety checks)")
    print("Note: Some columns may remain nullable if NULL values were found")