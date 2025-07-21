import sys
import os

# Add the current directory to Python path
sys.path.insert(0, '.')
sys.path.insert(0, 'src')

# Import your Flask app
from main import app
from src.models.user import User, db

print("Starting user debug...")

with app.app_context():
    try:
        users = User.query.all()
        print(f"\n=== FOUND {len(users)} USERS IN DATABASE ===")
        
        for user in users:
            print(f"Email: {user.email}")
            print(f"Role: {user.role}")
            print(f"Name: {user.first_name} {user.last_name}")
            print(f"Has password hash: {bool(user.password_hash)}")
            print("---")
        
        # Check for the specific users you're trying to login with
        admin_user = User.query.filter_by(email='admin@v3services.com').first()
        info_user = User.query.filter_by(email='info@v3-services.com').first()
        
        print("\n=== SPECIFIC USER CHECK ===")
        print(f"admin@v3services.com exists: {bool(admin_user)}")
        print(f"info@v3-services.com exists: {bool(info_user)}")
        
        # Create info@v3-services.com if it doesn't exist
        if not info_user:
            print("\nCreating info@v3-services.com...")
            new_admin = User(
                email='info@v3-services.com',
                role='admin',
                first_name='Info',
                last_name='Admin'
            )
            new_admin.set_password('admin123')
            db.session.add(new_admin)
            db.session.commit()
            print(" Created info@v3-services.com with password: admin123")
        else:
            print("info@v3-services.com already exists")
            
    except Exception as e:
        print(f"ERROR: {e}")
        print("Make sure you're running this from the same directory as main.py")
