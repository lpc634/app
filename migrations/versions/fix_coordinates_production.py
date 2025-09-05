"""Add latitude and longitude columns to vehicle_sightings table for production

Revision ID: fix_coordinates_production
Revises: multiple
Create Date: 2025-08-06 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'fcpr_20250819a7'
down_revision = 'fcm_tokens_001'
branch_labels = None
depends_on = None

def upgrade():
    """Add latitude and longitude columns if they don't already exist."""
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    
    # Check if the table exists
    if 'vehicle_sightings' not in inspector.get_table_names():
        print("vehicle_sightings table does not exist, skipping...")
        return
        
    # Get existing columns
    existing_columns = [col['name'] for col in inspector.get_columns('vehicle_sightings')]
    
    # Only add columns if they don't exist
    columns_to_add = []
    if 'latitude' not in existing_columns:
        columns_to_add.append(('latitude', sa.Float(), True))
    if 'longitude' not in existing_columns:
        columns_to_add.append(('longitude', sa.Float(), True))
    
    if not columns_to_add:
        print("Latitude and longitude columns already exist, skipping...")
        return
    
    print(f"Adding {len(columns_to_add)} missing columns to vehicle_sightings table...")
    
    # Use batch operations for SQLite compatibility
    with op.batch_alter_table('vehicle_sightings', schema=None) as batch_op:
        for column_name, column_type, nullable in columns_to_add:
            print(f"Adding column: {column_name}")
            batch_op.add_column(sa.Column(column_name, column_type, nullable=nullable))
    
    print("Successfully added coordinate columns!")

def downgrade():
    """Remove latitude and longitude columns if they exist."""
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    
    # Check if the table exists
    if 'vehicle_sightings' not in inspector.get_table_names():
        print("vehicle_sightings table does not exist, skipping...")
        return
        
    # Get existing columns
    existing_columns = [col['name'] for col in inspector.get_columns('vehicle_sightings')]
    
    # Only remove columns if they exist
    columns_to_remove = []
    if 'longitude' in existing_columns:
        columns_to_remove.append('longitude')
    if 'latitude' in existing_columns:
        columns_to_remove.append('latitude')
    
    if not columns_to_remove:
        print("Latitude and longitude columns don't exist, skipping...")
        return
    
    print(f"Removing {len(columns_to_remove)} columns from vehicle_sightings table...")
    
    # Use batch operations for SQLite compatibility  
    with op.batch_alter_table('vehicle_sightings', schema=None) as batch_op:
        for column_name in columns_to_remove:
            print(f"Removing column: {column_name}")
            batch_op.drop_column(column_name)
    
    print("Successfully removed coordinate columns!")