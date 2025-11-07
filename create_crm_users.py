"""
Create initial CRM users for Lance and Tom
Run this script once after deploying the migration
"""

from src.extensions import db
from src.models.crm_user import CRMUser
from main import app

with app.app_context():
    print("Creating CRM users...")

    # Check if users already exist
    if CRMUser.query.filter_by(username='lance').first():
        print("⚠️  Lance's CRM account already exists, skipping...")
    else:
        # Create Lance's CRM account
        lance = CRMUser(
            username='lance',
            email='lance@v3-services.com',
            is_super_admin=True
        )
        lance.set_password('lance123')  # CHANGE THIS PASSWORD!
        db.session.add(lance)
        print("✅ Created Lance's CRM account (username: lance, password: lance123)")

    if CRMUser.query.filter_by(username='tom').first():
        print("⚠️  Tom's CRM account already exists, skipping...")
    else:
        # Create Tom's CRM account
        tom = CRMUser(
            username='tom',
            email='tom@v3-services.com',
            is_super_admin=True
        )
        tom.set_password('tom123')  # CHANGE THIS PASSWORD!
        db.session.add(tom)
        print("✅ Created Tom's CRM account (username: tom, password: tom123)")

    db.session.commit()

    print("\n" + "="*60)
    print("CRM USERS CREATED SUCCESSFULLY!")
    print("="*60)
    print("\n📌 IMPORTANT: Both accounts have temporary passwords!")
    print("   - Lance: username='lance', password='lance123'")
    print("   - Tom: username='tom', password='tom123'")
    print("\n⚠️  CHANGE THESE PASSWORDS IMMEDIATELY!\n")

    # Show all CRM users
    print("Current CRM users:")
    users = CRMUser.query.all()
    for user in users:
        print(f"  - {user.username} ({user.email}) - Super Admin: {user.is_super_admin}")
