from alembic import op
import sqlalchemy as sa

# Revision identifiers, used by Alembic.
revision = "add_coordinates_to_vehicle_sightings"
down_revision = None  # leave as None; acts as a base placeholder
branch_labels = None
depends_on = None


def upgrade():
    # No-op placeholder to satisfy missing parent revision on Heroku
    pass


def downgrade():
    pass
