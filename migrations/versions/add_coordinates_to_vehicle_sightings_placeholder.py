from alembic import op
import sqlalchemy as sa

# Revision identifiers, used by Alembic.
revision = "acvs_20250819a1"
down_revision = None  # base placeholder, keep None
branch_labels = None
depends_on = None

def upgrade():
    # No-op placeholder to satisfy missing parent revision on Heroku
    pass

def downgrade():
    pass
