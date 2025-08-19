from alembic import opimport sqlalchemy as sa
revision = "add_coordinates_to_vehicle_sightings"
down_revision = None  # leave as None; acts as a base placeholder
branch_labels = None
depends_on = Nonedef upgrade():
    # No-op placeholder to satisfy missing parent revision on Heroku
    pass

def downgrade():
    pass