"""
Check and fix CRM setup - check tables and create users
"""

from src.extensions import db
from src.models.crm_user import CRMUser
from main import app
import sqlalchemy as sa

with app.app_context():
    print("=== Checking CRM Tables ===")

    # Check which CRM tables exist
    inspector = sa.inspect(db.engine)
    tables = inspector.get_table_names()
    crm_tables = [t for t in tables if t.startswith('crm')]

    print(f"Found {len(crm_tables)} CRM tables:")
    for table in crm_tables:
        print(f"  - {table}")

    print("\n=== Checking crm_users Table ===")
    if 'crm_users' in crm_tables:
        print("✅ crm_users table exists")

        # Try to create users
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
            print("✅ Created Lance's CRM account")

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
            print("✅ Created Tom's CRM account")

        db.session.commit()
        print("\n=== CRM Users Summary ===")
        users = CRMUser.query.all()
        for user in users:
            print(f"  - {user.username} ({user.email}) - Super Admin: {user.is_super_admin}")
    else:
        print("❌ crm_users table DOES NOT EXIST")
        print("    Migration needs to be run manually")
