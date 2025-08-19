"""make job title nullable and sync with address

Revision ID: make_job_title_nullable
Revises: add_coordinates_to_vehicle_sightings
Create Date: 2025-01-13 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'mjtn_20250819a2'
down_revision = 'acvs_20250819a1'
branch_labels = None
depends_on = None


def upgrade():
    """Make jobs.title nullable and update existing records."""
    # Make title column nullable
    op.alter_column('jobs', 'title',
                   existing_type=sa.String(length=100),
                   nullable=True)
    
    # Update existing records where title is NULL or empty to use address
    op.execute("""
        UPDATE jobs 
        SET title = address 
        WHERE title IS NULL OR TRIM(title) = ''
    """)


def downgrade():
    """Revert jobs.title to non-nullable (with data loss warning)."""
    # First ensure all titles have values (copy from address)
    op.execute("""
        UPDATE jobs 
        SET title = COALESCE(address, 'Unknown Job') 
        WHERE title IS NULL OR TRIM(title) = ''
    """)
    
    # Make title column non-nullable again
    op.alter_column('jobs', 'title',
                   existing_type=sa.String(length=100),
                   nullable=False)