from alembic import op
import sqlalchemy as sa
# 1) Ensure folder exists
mkdir -Force migrations\versions | Out-Null

# 2) Create the merge migration file
merge_all_heads_20250819 = "merge_all_heads_20250819"
@"
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "merge_all_heads_20250819"
down_revision = (
    "a1b2c3d4e5f6",
    "add_coordinates_to_sightings",
    "fcm_tokens_001",
    "add_telegram_integration",
    "verification_tracking_001",
    "fix_coordinates_production",
)
branch_labels = None
depends_on = None

def upgrade():
    # Merge migration: no schema changes.
    pass

def downgrade():
    # Would re-split branches; keep as no-op.
    pass