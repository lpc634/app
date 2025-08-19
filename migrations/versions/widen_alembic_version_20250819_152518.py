"""Widen alembic_version.version_num to prevent future StringDataRightTruncation

Revision ID: widen_alembic_version
Revises: merge_fix_heads_20250819
Create Date: 2025-08-19T15:25:18.592559

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'widen_version_20250819'
down_revision = 'merge_fix_heads_20250819'
branch_labels = None
depends_on = None

def upgrade():
    """Widen alembic_version.version_num from VARCHAR(32) to VARCHAR(64)."""
    try:
        # Only apply if using PostgreSQL and column is currently 32 chars
        bind = op.get_bind()
        if bind.dialect.name == 'postgresql':
            # Check current column length
            result = bind.execute("""
                SELECT character_maximum_length 
                FROM information_schema.columns 
                WHERE table_name = 'alembic_version' 
                AND column_name = 'version_num'
            """).fetchone()
            
            if result and result[0] == 32:
                op.alter_column('alembic_version', 'version_num', 
                              type_=sa.String(length=64),
                              existing_type=sa.String(length=32))
                print("Widened alembic_version.version_num to VARCHAR(64)")
            else:
                print("alembic_version.version_num already >= 64 chars, skipping")
        else:
            print("Not PostgreSQL, skipping alembic_version widening")
    except Exception as e:
        print(f"Failed to widen alembic_version.version_num: {e}")
        # Don't fail the migration for this optional change
        pass

def downgrade():
    """Revert alembic_version.version_num back to VARCHAR(32)."""
    try:
        bind = op.get_bind()
        if bind.dialect.name == 'postgresql':
            op.alter_column('alembic_version', 'version_num',
                          type_=sa.String(length=32),
                          existing_type=sa.String(length=64))
    except Exception as e:
        print(f"Failed to revert alembic_version.version_num: {e}")
        pass
