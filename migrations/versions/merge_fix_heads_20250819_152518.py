from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "merge_fix_heads_20250819"
down_revision = "fcpr_20250819a7"
branch_labels = None
depends_on = None

def upgrade():
    # Merge migration: no schema changes.
    pass

def downgrade():
    # Would re-split branches; keep as no-op.
    pass
