from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "merge_fix_heads_20250819"
down_revision = (
    "a1b2c3d4e5f6",
    "acvs_20250819b1",
    "atel_20250819a5",
    "fcm_tokens_001",
    "fcpr_20250819a7",
    "vtck_20250819a6",
)
branch_labels = None
depends_on = None

def upgrade():
    # Merge migration: no schema changes.
    pass

def downgrade():
    # Would re-split branches; keep as no-op.
    pass
