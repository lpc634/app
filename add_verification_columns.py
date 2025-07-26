#!/usr/bin/env python3
"""
Direct SQL migration to add verification tracking columns
"""

import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add src to path
sys.path.insert(0, 'src')

from flask import Flask
from src.extensions import db

def add_verification_columns():
    """Add verification tracking columns directly using SQL"""
    
    print("=== Adding Verification Tracking Columns ===\n")
    
    # Initialize Flask app
    app = Flask(__name__)
    
    # Configure database
    DATABASE_URL = os.environ.get('DATABASE_URL')
    if DATABASE_URL:
        if DATABASE_URL.startswith("postgres://"):
            DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
        app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL
        print(f"Using PostgreSQL database: {DATABASE_URL[:50]}...")
        db_type = 'postgresql'
    else:
        db_path = os.path.join(os.path.dirname(__file__), 'database', 'app.db')
        app.config['SQLALCHEMY_DATABASE_URI'] = f"sqlite:///{db_path}"
        print(f"Using SQLite database: {db_path}")
        db_type = 'sqlite'
    
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    
    # Initialize database
    db.init_app(app)
    
    with app.app_context():
        try:
            print("\n1. Checking current database schema...")
            
            # Check if columns already exist
            from sqlalchemy import inspect, text
            inspector = inspect(db.engine)
            columns = [col['name'] for col in inspector.get_columns('users')]
            
            missing_columns = []
            for col in ['verification_notes', 'verified_by', 'verified_at']:
                if col not in columns:
                    missing_columns.append(col)
            
            if not missing_columns:
                print("✓ All verification tracking columns already exist!")
                return True
            
            print(f"Missing columns: {missing_columns}")
            
            print("\n2. Adding missing columns...")
            
            # Add columns one by one
            if 'verification_notes' in missing_columns:
                print("   Adding verification_notes column...")
                if db_type == 'postgresql':
                    db.session.execute(text("ALTER TABLE users ADD COLUMN verification_notes TEXT"))
                else:
                    db.session.execute(text("ALTER TABLE users ADD COLUMN verification_notes TEXT"))
                print("   + verification_notes added")
            
            if 'verified_by' in missing_columns:
                print("   Adding verified_by column...")
                if db_type == 'postgresql':
                    db.session.execute(text("ALTER TABLE users ADD COLUMN verified_by INTEGER REFERENCES users(id)"))
                else:
                    db.session.execute(text("ALTER TABLE users ADD COLUMN verified_by INTEGER"))
                print("   + verified_by added")
            
            if 'verified_at' in missing_columns:
                print("   Adding verified_at column...")
                if db_type == 'postgresql':
                    db.session.execute(text("ALTER TABLE users ADD COLUMN verified_at TIMESTAMP"))
                else:
                    db.session.execute(text("ALTER TABLE users ADD COLUMN verified_at DATETIME"))
                print("   + verified_at added")
            
            # Commit changes
            db.session.commit()
            
            print("\n3. Verifying new schema...")
            
            # Verify columns were added
            inspector = inspect(db.engine)
            new_columns = [col['name'] for col in inspector.get_columns('users')]
            
            verification_columns = ['verification_notes', 'verified_by', 'verified_at']
            all_present = True
            for col in verification_columns:
                if col in new_columns:
                    print(f"+ Column '{col}' is present")
                else:
                    print(f"- Column '{col}' missing!")
                    all_present = False
            
            if all_present:
                print("\nAll verification tracking columns added successfully!")
                return True
            else:
                print("\nSome columns are still missing!")
                return False
            
        except Exception as e:
            print(f"\nMigration failed: {str(e)}")
            db.session.rollback()
            import traceback
            traceback.print_exc()
            return False

if __name__ == "__main__":
    success = add_verification_columns()
    if success:
        print("\nDatabase is ready for admin document verification system!")
        print("\nYou can now:")
        print("- Use the admin document review interface")
        print("- Approve/reject agent documents with notes")
        print("- Track verification history and admin actions")
    else:
        print("\nColumn addition failed - please check errors above")
        sys.exit(1)