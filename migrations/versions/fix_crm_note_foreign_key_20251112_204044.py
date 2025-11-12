"""Fix CRM note foreign key to reference crm_users

Revision ID: 20251112_204044
Revises: 20251112_add_rate_net_line_net_columns
Create Date: 2025-11-12 20:40:44

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20251112_204044'
down_revision = '20251112_add_rate_net_line_net_columns'
branch_labels = None
depends_on = None


def upgrade():
    # Drop the existing foreign key constraint
    with op.batch_alter_table('crm_notes', schema=None) as batch_op:
        # Try to drop the constraint if it exists (name may vary by database)
        try:
            batch_op.drop_constraint('crm_notes_created_by_fkey', type_='foreignkey')
        except:
            pass

        # Add the new foreign key constraint pointing to crm_users
        batch_op.create_foreign_key(
            'crm_notes_created_by_crm_users_fkey',
            'crm_users',
            ['created_by'],
            ['id']
        )


def downgrade():
    # Reverse the change
    with op.batch_alter_table('crm_notes', schema=None) as batch_op:
        # Drop the new constraint
        try:
            batch_op.drop_constraint('crm_notes_created_by_crm_users_fkey', type_='foreignkey')
        except:
            pass

        # Restore the old foreign key pointing to users
        batch_op.create_foreign_key(
            'crm_notes_created_by_fkey',
            'users',
            ['created_by'],
            ['id']
        )
