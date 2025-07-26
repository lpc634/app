"""add verification tracking columns

Revision ID: verification_tracking_001
Revises: c135f3c2dd6c
Create Date: 2025-07-26 12:20:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'verification_tracking_001'
down_revision = 'c135f3c2dd6c'
branch_labels = None
depends_on = None


def upgrade():
    """Add verification tracking columns to users table"""
    
    # Add verification_notes column (Text, nullable)
    op.add_column('users', sa.Column('verification_notes', sa.Text(), nullable=True))
    
    # Add verified_by column (Integer, foreign key to users.id, nullable)
    op.add_column('users', sa.Column('verified_by', sa.Integer(), nullable=True))
    
    # Add verified_at column (DateTime, nullable)
    op.add_column('users', sa.Column('verified_at', sa.DateTime(), nullable=True))
    
    # Create foreign key constraint for verified_by
    op.create_foreign_key(
        'fk_users_verified_by',  # constraint name
        'users',                 # source table
        'users',                 # target table
        ['verified_by'],         # source columns
        ['id']                   # target columns
    )


def downgrade():
    """Remove verification tracking columns from users table"""
    
    # Drop foreign key constraint first
    op.drop_constraint('fk_users_verified_by', 'users', type_='foreignkey')
    
    # Drop columns
    op.drop_column('users', 'verified_at')
    op.drop_column('users', 'verified_by')
    op.drop_column('users', 'verification_notes')