"""Add site_postcode to contact_form_submissions

Revision ID: 20251124_add_site_postcode
Revises:
Create Date: 2025-11-24

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20251124_add_site_postcode'
down_revision = None  # Will be set automatically by alembic
branch_labels = None
depends_on = None


def upgrade():
    # Check if column already exists
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    # Get existing columns
    columns = [col['name'] for col in inspector.get_columns('contact_form_submissions')]

    # Only add if column doesn't exist
    if 'site_postcode' not in columns:
        op.add_column('contact_form_submissions',
            sa.Column('site_postcode', sa.String(length=20), nullable=True)
        )


def downgrade():
    op.drop_column('contact_form_submissions', 'site_postcode')
