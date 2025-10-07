#!/usr/bin/env python3
"""
Migration script to add authority_to_act_tokens table
"""
import os
import sys
from datetime import datetime

# Add src to path
sys.path.insert(0, 'src')

from dotenv import load_dotenv
load_dotenv()

from flask import Flask
from src.extensions import db
from src.models.authority_to_act import AuthorityToActToken

# Initialize Flask app
app = Flask(__name__)

# Database configuration
DATABASE_URL = os.environ.get('DATABASE_URL')
if DATABASE_URL:
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
    app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL
else:
    db_dir = os.path.join(os.path.dirname(__file__), 'database')
    os.makedirs(db_dir, exist_ok=True)
    app.config['SQLALCHEMY_DATABASE_URI'] = f"sqlite:///{os.path.join(db_dir, 'app.db')}"

app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize database
db.init_app(app)

def run_migration():
    """Create authority_to_act_tokens table"""
    with app.app_context():
        print("Creating authority_to_act_tokens table...")

        # Create the table
        db.create_all()

        print("✅ Migration completed successfully!")
        print(f"Table 'authority_to_act_tokens' created")

if __name__ == '__main__':
    run_migration()
