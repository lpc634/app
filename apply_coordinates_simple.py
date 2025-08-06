#!/usr/bin/env python3
"""
Safe script to apply coordinate columns migration for production deployment.
"""

import os
import sys
from datetime import datetime

# Add src to path
sys.path.insert(0, 'src')

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

from flask import Flask
from src.extensions import db
from sqlalchemy import text, inspect

def create_app():
    """Create Flask app with proper database configuration"""
    app = Flask(__name__)
    
    # Configure database
    DATABASE_URL = os.environ.get('DATABASE_URL')
    if DATABASE_URL:
        if DATABASE_URL.startswith("postgres://"):
            DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
        app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL
        print(f"Using PostgreSQL database: {DATABASE_URL[:50]}...")
        db_type = "PostgreSQL"
    else:
        db_path = os.path.join(os.path.dirname(__file__), 'database', 'app.db')
        app.config['SQLALCHEMY_DATABASE_URI'] = f"sqlite:///{db_path}"
        print(f"Using SQLite database: {db_path}")
        db_type = "SQLite"
    
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    
    # Initialize database
    db.init_app(app)
    
    return app, db_type

def check_and_add_columns(app):
    """Check and add missing coordinate columns"""
    with app.app_context():
        try:
            inspector = inspect(db.engine)
            
            # Check if vehicle_sightings table exists
            if 'vehicle_sightings' not in inspector.get_table_names():
                print("ERROR: vehicle_sightings table does not exist!")
                return False
            
            # Get current columns
            columns = inspector.get_columns('vehicle_sightings')
            column_names = [col['name'] for col in columns]
            
            print(f"vehicle_sightings table exists with {len(column_names)} columns")
            
            # Check for coordinate columns
            has_latitude = 'latitude' in column_names
            has_longitude = 'longitude' in column_names
            
            print(f"Latitude column exists: {has_latitude}")
            print(f"Longitude column exists: {has_longitude}")
            
            # Add missing columns
            columns_added = 0
            
            if not has_latitude:
                print("Adding latitude column...")
                db.session.execute(text("ALTER TABLE vehicle_sightings ADD COLUMN latitude REAL"))
                columns_added += 1
                print("Latitude column added successfully")
            
            if not has_longitude:
                print("Adding longitude column...")
                db.session.execute(text("ALTER TABLE vehicle_sightings ADD COLUMN longitude REAL"))
                columns_added += 1
                print("Longitude column added successfully")
            
            if columns_added > 0:
                db.session.commit()
                print(f"Successfully added {columns_added} columns")
            else:
                print("All columns already exist - no changes needed")
            
            return True
            
        except Exception as e:
            print(f"Error: {e}")
            db.session.rollback()
            return False

def test_queries(app):
    """Test the vehicle queries"""
    with app.app_context():
        try:
            # Import both models to resolve relationships
            from src.models.user import User
            from src.models.vehicle import VehicleSighting
            
            print("Testing vehicle sighting query...")
            
            # Test the exact query from the failing route
            test_plate = 'TEST123'
            sightings = VehicleSighting.query.filter_by(registration_plate=test_plate).all()
            
            print(f"Query successful! Found {len(sightings)} sightings for {test_plate}")
            return True
            
        except Exception as e:
            print(f"Query test failed: {e}")
            import traceback
            traceback.print_exc()
            return False

def main():
    """Main function"""
    print("Vehicle Sightings Coordinates Migration Tool")
    print("=" * 50)
    print(f"Started at: {datetime.now()}")
    
    # Create app
    app, db_type = create_app()
    
    # Add missing columns
    print("\n1. Checking and adding missing columns...")
    if not check_and_add_columns(app):
        print("Migration failed!")
        return False
    
    # Test queries
    print("\n2. Testing vehicle queries...")
    if not test_queries(app):
        print("Query testing failed!")
        return False
    
    print("\n" + "=" * 50)
    print("SUCCESS! Migration completed successfully!")
    print("vehicle_sightings table now has latitude and longitude columns")
    print("Vehicle queries are working correctly")
    print(f"Completed at: {datetime.now()}")
    
    return True

if __name__ == '__main__':
    try:
        success = main()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)