#!/usr/bin/env python3
"""
Migration script to add is_read column to authority_to_act_tokens table
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
    """Add is_read column to authority_to_act_tokens table"""
    with app.app_context():
        print("Adding is_read column to authority_to_act_tokens table...")

        try:
            # Check if column already exists
            from sqlalchemy import inspect
            inspector = inspect(db.engine)
            columns = [col['name'] for col in inspector.get_columns('authority_to_act_tokens')]

            if 'is_read' in columns:
                print("✅ Column 'is_read' already exists, skipping migration")
                return

            # Add the column
            with db.engine.connect() as conn:
                if DATABASE_URL and 'postgresql' in DATABASE_URL:
                    # PostgreSQL
                    conn.execute(db.text(
                        "ALTER TABLE authority_to_act_tokens ADD COLUMN is_read BOOLEAN DEFAULT FALSE NOT NULL"
                    ))
                else:
                    # SQLite
                    conn.execute(db.text(
                        "ALTER TABLE authority_to_act_tokens ADD COLUMN is_read INTEGER DEFAULT 0 NOT NULL"
                    ))
                conn.commit()

            print("✅ Migration completed successfully!")
            print(f"Added 'is_read' column to authority_to_act_tokens table")

        except Exception as e:
            print(f"❌ Migration failed: {str(e)}")
            raise

if __name__ == '__main__':
    run_migration()
