"""Create (or reset) the admin login and the matching CRM super-admin.

Prompts for the password so it never lands in code, shell history or logs:

    heroku run -a v3-app python scripts/create_admin.py
"""
import sys
sys.path.insert(0, '.')

from getpass import getpass

from main import app
from src.extensions import db
from src.models.user import User
from src.models.crm_user import CRMUser

email = input('Admin email: ').strip().lower()
first_name = input('First name: ').strip()
last_name = input('Last name: ').strip()
username = input('CRM username: ').strip().lower()
password = getpass('Password: ')
if len(password) < 8 or password != getpass('Password again: '):
    sys.exit('Passwords must match and be at least 8 characters. Nothing was changed.')

with app.app_context():
    user = User.query.filter_by(email=email).first()
    if not user:
        user = User(email=email, first_name=first_name, last_name=last_name)
        db.session.add(user)
    user.role = 'admin'
    user.verification_status = 'verified'
    user.set_password(password)

    crm_user = CRMUser.query.filter_by(username=username).first()
    if not crm_user:
        crm_user = CRMUser(username=username, email=email)
        db.session.add(crm_user)
    crm_user.is_super_admin = True
    crm_user.set_password(password)

    db.session.commit()
    print(f"Admin login ready: {email} (main app) / {username} (CRM).")
