"""
Manually create crm_users table and users
"""

from src.extensions import db
from main import app
import sqlalchemy as sa

with app.app_context():
    print("=== Creating crm_users table ===")

    # Create table using raw SQL
    conn = db.engine.connect()

    # Check if table already exists
    result = conn.execute(sa.text("""
        SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = 'crm_users'
        );
    """))
    exists = result.scalar()

    if exists:
        print("✅ crm_users table already exists")
    else:
        print("Creating crm_users table...")
        conn.execute(sa.text("""
            CREATE TABLE crm_users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(120) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                is_super_admin BOOLEAN DEFAULT FALSE,
                imap_server VARCHAR(255),
                imap_port INTEGER,
                imap_email VARCHAR(255),
                imap_password VARCHAR(255),
                imap_use_ssl BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """))
        conn.commit()
        print("✅ crm_users table created")

    conn.close()

    # Now import and use the model
    from src.models.crm_user import CRMUser

    print("\n=== Creating CRM Users ===")

    # Check if Lance exists
    if CRMUser.query.filter_by(username='lance').first():
        print("⚠️  Lance's CRM account already exists")
    else:
        lance = CRMUser(
            username='lance',
            email='lance@v3-services.com',
            is_super_admin=True
        )
        lance.set_password('lance123')
        db.session.add(lance)
        print("✅ Created Lance's CRM account (username: lance, password: lance123)")

    # Check if Tom exists
    if CRMUser.query.filter_by(username='tom').first():
        print("⚠️  Tom's CRM account already exists")
    else:
        tom = CRMUser(
            username='tom',
            email='tom@v3-services.com',
            is_super_admin=True
        )
        tom.set_password('tom123')
        db.session.add(tom)
        print("✅ Created Tom's CRM account (username: tom, password: tom123)")

    db.session.commit()

    print("\n" + "="*60)
    print("CRM SETUP COMPLETE!")
    print("="*60)
    print("\n⚠️  IMPORTANT: Change default passwords immediately!")
    print("   - Lance: username='lance', password='lance123'")
    print("   - Tom: username='tom', password='tom123'")

    # Show all CRM users
    print("\nCurrent CRM users:")
    users = CRMUser.query.all()
    for user in users:
        print(f"  - {user.username} ({user.email}) - Super Admin: {user.is_super_admin}")

    # Now update crm_contacts foreign key
    print("\n=== Updating crm_contacts foreign key ===")
    conn = db.engine.connect()

    # Drop existing foreign key constraints
    conn.execute(sa.text("""
        DO $$
        BEGIN
            ALTER TABLE crm_contacts DROP CONSTRAINT IF EXISTS crm_contacts_owner_id_fkey;
            ALTER TABLE crm_contacts DROP CONSTRAINT IF EXISTS fk_crm_contacts_owner_id;
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END $$;
    """))

    # Make owner_id nullable
    conn.execute(sa.text('ALTER TABLE crm_contacts ALTER COLUMN owner_id DROP NOT NULL'))

    # Set all existing contacts to NULL owner_id
    conn.execute(sa.text('UPDATE crm_contacts SET owner_id = NULL'))

    # Add new foreign key to crm_users table
    conn.execute(sa.text('ALTER TABLE crm_contacts ADD CONSTRAINT fk_crm_contacts_owner_id FOREIGN KEY (owner_id) REFERENCES crm_users(id)'))

    conn.commit()
    conn.close()

    print("✅ Foreign key updated to point to crm_users table")
