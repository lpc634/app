from alembic import op
import sqlalchemy as sa

# Revision identifiers, used by Alembic.
revision = "acvs_20250819a1"
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None

def upgrade():
    # No-op placeholder to satisfy missing parent revision on Heroku
    pass

def downgrade():
    pass
