"""Fix CRM email config security - encrypt passwords and fix FK

Revision ID: 20251119_fix_crm_email_config_security
Revises: 20251108_add_telegram_to_crm_users
Create Date: 2025-11-19

This migration:
1. Drops old crm_email_configs table (wrong FK to users.id)
2. Creates new secure crm_email_configs table with correct FK to crm_users.id
3. Migrates existing plain-text IMAP passwords from crm_users to encrypted CRMEmailConfig
4. Adds imap_use_ssl column to new table

SECURITY CRITICAL: This migration encrypts all IMAP passwords!
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import table, column
from sqlalchemy import String, Integer, Boolean, Text, DateTime
from datetime import datetime
import os
from cryptography.fernet import Fernet


# revision identifiers, used by Alembic.
revision = '20251119_fix_crm_email_config_security'
down_revision = '20251112_221027'
branch_labels = None
depends_on = None


def get_cipher():
    """Get encryption cipher"""
    key = os.environ.get('CRM_EMAIL_ENCRYPTION_KEY')
    if not key:
        # Generate a key for development
        key = Fernet.generate_key()
        print(f"WARNING: Generated new encryption key. Set CRM_EMAIL_ENCRYPTION_KEY={key.decode()}")
    if isinstance(key, str):
        key = key.encode()
    return Fernet(key)


def upgrade():
    print("Starting CRM email config security migration...")

    # Step 1: Drop old table if it exists (wrong FK)
    try:
        op.drop_table('crm_email_configs')
        print("✓ Dropped old crm_email_configs table")
    except Exception:
        print("✓ Old table doesn't exist or already dropped")

    # Step 2: Create new secure table with correct FK to crm_users
    op.create_table(
        'crm_email_configs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('crm_user_id', sa.Integer(), nullable=False),
        sa.Column('email_address', sa.String(length=120), nullable=False),
        sa.Column('imap_server', sa.String(length=100), nullable=False),
        sa.Column('imap_port', sa.Integer(), nullable=False),
        sa.Column('imap_use_ssl', sa.Boolean(), nullable=False, server_default='1'),
        sa.Column('encrypted_password', sa.Text(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='1'),
        sa.Column('last_sync', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['crm_user_id'], ['crm_users.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('crm_user_id')
    )
    op.create_index('ix_crm_email_configs_crm_user_id', 'crm_email_configs', ['crm_user_id'])
    print("✓ Created new secure crm_email_configs table")

    # Step 3: Migrate existing IMAP credentials from crm_users to encrypted storage
    connection = op.get_bind()

    # Get all CRM users with IMAP configuration
    result = connection.execute(sa.text("""
        SELECT id, imap_server, imap_port, imap_email, imap_password, imap_use_ssl
        FROM crm_users
        WHERE imap_server IS NOT NULL AND imap_email IS NOT NULL AND imap_password IS NOT NULL
    """))

    cipher = get_cipher()
    migrated_count = 0

    for row in result:
        user_id = row[0]
        imap_server = row[1]
        imap_port = row[2] or 993
        imap_email = row[3]
        plain_password = row[4]
        imap_use_ssl = row[5] if row[5] is not None else True

        try:
            # Encrypt the password
            encrypted_password = cipher.encrypt(plain_password.encode()).decode()

            # Insert into new secure table
            connection.execute(sa.text("""
                INSERT INTO crm_email_configs
                (crm_user_id, email_address, imap_server, imap_port, imap_use_ssl, encrypted_password, is_active, created_at, updated_at)
                VALUES (:user_id, :email, :server, :port, :use_ssl, :encrypted_pw, 1, :now, :now)
            """), {
                'user_id': user_id,
                'email': imap_email,
                'server': imap_server,
                'port': imap_port,
                'use_ssl': imap_use_ssl,
                'encrypted_pw': encrypted_password,
                'now': datetime.utcnow()
            })

            migrated_count += 1
            print(f"✓ Migrated and encrypted credentials for user {user_id}")

        except Exception as e:
            print(f"⚠ Failed to migrate user {user_id}: {e}")

    print(f"✓ Migration complete: {migrated_count} users migrated to secure storage")
    print("⚠ WARNING: Old plain-text passwords still exist in crm_users table")
    print("⚠ They will be ignored by the application and should be manually cleared later")


def downgrade():
    """Downgrade is not supported for security reasons"""
    print("ERROR: Cannot downgrade this security migration!")
    print("Downgrading would expose encrypted passwords.")
    raise Exception("Security migration cannot be downgraded")
