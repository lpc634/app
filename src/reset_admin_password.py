# reset_admin_password.py

from main import app, db
from src.models.user import User
import os

# --- THIS IS THE ONLY CHANGE ---
ADMIN_EMAIL = "info@v3-services.com"
NEW_PASSWORD = "admin123!"  # <-- CHOOSE YOUR NEW PASSWORD HERE

with app.app_context():
    admin_user = User.query.filter_by(email=ADMIN_EMAIL).first()

    if admin_user:
        admin_user.set_password(NEW_PASSWORD)
        db.session.commit()
        print(f"Password for admin user '{ADMIN_EMAIL}' has been successfully reset.")
    else:
        print(f"Admin user with email '{ADMIN_EMAIL}' not found.")