"""add verification tracking columns

Revision ID: verification_tracking_001
Revises: c135f3c2dd6c
Create Date: 2025-07-26 12:20:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'vtck_20250819a6'
down_revision = 'c135f3c2dd6c'
branch_labels = None
depends_on = None


def upgrade():
    """Add verification tracking columns to users table"""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    
    # Check if columns already exist
    users_columns = [col['name'] for col in inspector.get_columns('users')]
    
    # Add verification_notes column (Text, nullable)
    if 'verification_notes' not in users_columns:
        op.add_column('users', sa.Column('verification_notes', sa.Text(), nullable=True))
        print("Added verification_notes column")
    else:
        print("verification_notes column already exists")
    
    # Add verified_by column (Integer, foreign key to users.id, nullable)
    if 'verified_by' not in users_columns:
        op.add_column('users', sa.Column('verified_by', sa.Integer(), nullable=True))
        print("Added verified_by column")
    else:
        print("verified_by column already exists")
    
    # Add verified_at column (DateTime, nullable)
    if 'verified_at' not in users_columns:
        op.add_column('users', sa.Column('verified_at', sa.DateTime(), nullable=True))
        print("Added verified_at column")
    else:
        print("verified_at column already exists")
    
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