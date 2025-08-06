"""Add coordinates to vehicle sightings

Revision ID: add_coordinates_to_sightings
Revises: 25573440985f
Create Date: 2024-01-01 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'add_coordinates_to_sightings'
down_revision = '25573440985f'
branch_labels = None
depends_on = None

def upgrade():
    # Add latitude and longitude columns to vehicle_sightings table
    with op.batch_alter_table('vehicle_sightings', schema=None) as batch_op:
        batch_op.add_column(sa.Column('latitude', sa.Float(), nullable=True))
        batch_op.add_column(sa.Column('longitude', sa.Float(), nullable=True))

def downgrade():
    # Remove latitude and longitude columns from vehicle_sightings table
    with op.batch_alter_table('vehicle_sightings', schema=None) as batch_op:
        batch_op.drop_column('longitude')
        batch_op.drop_column('latitude')