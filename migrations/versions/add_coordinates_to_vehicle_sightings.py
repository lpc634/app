"""Add coordinates to vehicle sightings

Revision ID: add_coordinates_to_sightings
Revises: 25573440985f
Create Date: 2024-01-01 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'acvs_20250819b1'
down_revision = 'acvs_20250819a1'
branch_labels = None
depends_on = None

def upgrade():
    """Add latitude and longitude columns to vehicle_sightings table if they don't exist."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    
    # Check if columns already exist
    try:
        vehicle_sightings_columns = [col['name'] for col in inspector.get_columns('vehicle_sightings')]
        
        # Add columns only if they don't exist
        if 'latitude' not in vehicle_sightings_columns or 'longitude' not in vehicle_sightings_columns:
            with op.batch_alter_table('vehicle_sightings', schema=None) as batch_op:
                if 'latitude' not in vehicle_sightings_columns:
                    batch_op.add_column(sa.Column('latitude', sa.Float(), nullable=True))
                    print("Added latitude column to vehicle_sightings table")
                else:
                    print("latitude column already exists in vehicle_sightings table")
                
                if 'longitude' not in vehicle_sightings_columns:
                    batch_op.add_column(sa.Column('longitude', sa.Float(), nullable=True))
                    print("Added longitude column to vehicle_sightings table")
                else:
                    print("longitude column already exists in vehicle_sightings table")
        else:
            print("Both latitude and longitude columns already exist in vehicle_sightings table")
    except Exception as e:
        print(f"Error checking vehicle_sightings table: {e}")
        # If table doesn't exist, we'll let the error propagate
        raise

def downgrade():
    # Remove latitude and longitude columns from vehicle_sightings table
    with op.batch_alter_table('vehicle_sightings', schema=None) as batch_op:
        batch_op.drop_column('longitude')
        batch_op.drop_column('latitude')