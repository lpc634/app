"""Add CRM users authentication system

Revision ID: 20251107_add_crm_users_auth
Revises: 20251106_add_crm_tables
Create Date: 2025-11-07 16:30:22

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20251107_add_crm_users_auth'
down_revision = '20251106_add_crm_tables'
branch_labels = None
depends_on = None


def upgrade():
    # Create crm_users table
    op.create_table('crm_users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('username', sa.String(length=50), nullable=False),
        sa.Column('email', sa.String(length=120), nullable=False),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('is_super_admin', sa.Boolean(), nullable=True),
        sa.Column('imap_server', sa.String(length=255), nullable=True),
        sa.Column('imap_port', sa.Integer(), nullable=True),
        sa.Column('imap_email', sa.String(length=255), nullable=True),
        sa.Column('imap_password', sa.String(length=255), nullable=True),
        sa.Column('imap_use_ssl', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email'),
        sa.UniqueConstraint('username')
    )

    # Update owner_id in crm_contacts to point to crm_users instead of users
    # Use raw SQL to handle this safely
    conn = op.get_bind()

    # Step 1: Drop existing foreign key constraints
    conn.execute(sa.text("""
        DO $$
        BEGIN
            ALTER TABLE crm_contacts DROP CONSTRAINT IF EXISTS crm_contacts_owner_id_fkey;
            ALTER TABLE crm_contacts DROP CONSTRAINT IF EXISTS fk_crm_contacts_owner_id;
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END $$;
    """))

    # Step 2: Make owner_id nullable FIRST
    conn.execute(sa.text('ALTER TABLE crm_contacts ALTER COLUMN owner_id DROP NOT NULL'))

    # Step 3: Set all existing contacts to NULL owner_id
    conn.execute(sa.text('UPDATE crm_contacts SET owner_id = NULL'))

    # Step 4: Add new foreign key to crm_users table
    conn.execute(sa.text('ALTER TABLE crm_contacts ADD CONSTRAINT fk_crm_contacts_owner_id FOREIGN KEY (owner_id) REFERENCES crm_users(id)'))


def downgrade():
    # Remove owner_id from crm_contacts
    with op.batch_alter_table('crm_contacts', schema=None) as batch_op:
        batch_op.drop_constraint('fk_crm_contacts_owner_id', type_='foreignkey')
        batch_op.drop_column('owner_id')

    # Drop crm_users table
    op.drop_table('crm_users')
