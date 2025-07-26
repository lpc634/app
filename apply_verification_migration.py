#!/usr/bin/env python3
"""
Apply verification tracking columns migration to the database
"""

import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add src to path
sys.path.insert(0, 'src')

from flask import Flask
from flask_migrate import Migrate, upgrade
from src.extensions import db

def apply_migration():
    """Apply the verification tracking migration"""
    
    print("=== Applying Verification Tracking Migration ===\n")
    
    # Initialize Flask app
    app = Flask(__name__)
    
    # Configure database
    DATABASE_URL = os.environ.get('DATABASE_URL')
    if DATABASE_URL:
        if DATABASE_URL.startswith("postgres://"):
            DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
        app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL
        print(f"Using PostgreSQL database: {DATABASE_URL[:50]}...")
    else:
        db_path = os.path.join(os.path.dirname(__file__), 'database', 'app.db')
        app.config['SQLALCHEMY_DATABASE_URI'] = f"sqlite:///{db_path}"
        print(f"Using SQLite database: {db_path}")
    
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    
    # Initialize extensions
    db.init_app(app)
    migrate = Migrate(app, db, directory='migrations')
    
    with app.app_context():
        try:
            print("\n1. Checking current database schema...")
            
            # Check if columns already exist
            from sqlalchemy import inspect
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
            
            print("\n2. Applying migration...")
            
            # Apply the specific migration
            from alembic import command
            from alembic.config import Config
            
            alembic_cfg = Config('migrations/alembic.ini')
            alembic_cfg.set_main_option('script_location', 'migrations')
            
            # Run the upgrade
            upgrade()
            
            print("✓ Migration applied successfully!")
            
            print("\n3. Verifying new schema...")
            
            # Verify columns were added
            inspector = inspect(db.engine)
            new_columns = [col['name'] for col in inspector.get_columns('users')]
            
            verification_columns = ['verification_notes', 'verified_by', 'verified_at']
            for col in verification_columns:
                if col in new_columns:
                    print(f"✓ Column '{col}' added successfully")
                else:
                    print(f"✗ Column '{col}' missing!")
                    return False
            
            print("\n🎉 Verification tracking migration completed successfully!")
            return True
            
        except Exception as e:
            print(f"\n❌ Migration failed: {str(e)}")
            import traceback
            traceback.print_exc()
            return False

if __name__ == "__main__":
    success = apply_migration()
    if success:
        print("\n✅ Database is ready for admin document verification system!")
    else:
        print("\n❌ Migration failed - please check errors above")
        sys.exit(1)