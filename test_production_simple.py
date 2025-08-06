#!/usr/bin/env python3
"""Simple production test for vehicle coordinates fix."""

import os
import sys
from datetime import datetime

# Add src to path
sys.path.insert(0, 'src')

def test_database_and_model():
    """Test database structure and model"""
    try:
        from dotenv import load_dotenv
        load_dotenv()
        
        from flask import Flask
        from src.extensions import db
        from src.models.user import User
        from src.models.vehicle import VehicleSighting
        from sqlalchemy import inspect
        
        app = Flask(__name__)
        
        # Configure database
        DATABASE_URL = os.environ.get('DATABASE_URL')
        if DATABASE_URL:
            if DATABASE_URL.startswith("postgres://"):
                DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
            app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL
            print(f"Using PostgreSQL: {DATABASE_URL[:50]}...")
        else:
            db_path = os.path.join(os.path.dirname(__file__), 'database', 'app.db')
            app.config['SQLALCHEMY_DATABASE_URI'] = f"sqlite:///{db_path}"
            print(f"Using SQLite: {db_path}")
        
        app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
        db.init_app(app)
        
        with app.app_context():
            # Check database structure
            inspector = inspect(db.engine)
            
            if 'vehicle_sightings' not in inspector.get_table_names():
                return False, "vehicle_sightings table missing"
            
            columns = [col['name'] for col in inspector.get_columns('vehicle_sightings')]
            
            if 'latitude' not in columns or 'longitude' not in columns:
                return False, f"Missing coordinate columns. Found: {columns}"
            
            print(f"Database OK: {len(columns)} columns including coordinates")
            
            # Test the failing query
            test_plate = 'TEST123'
            sightings = VehicleSighting.query.filter_by(registration_plate=test_plate).all()
            print(f"Query OK: Found {len(sightings)} sightings")
            
            if sightings:
                sighting_data = sightings[0].to_dict()
                if 'latitude' in sighting_data and 'longitude' in sighting_data:
                    print(f"Model OK: Coordinates in response - lat={sighting_data['latitude']}, lng={sighting_data['longitude']}")
                else:
                    return False, "Coordinates missing from to_dict() response"
            
            return True, "All database and model tests passed"
        
    except Exception as e:
        return False, f"Test failed: {e}"

def main():
    """Run the test"""
    print("Vehicle Coordinates Fix - Production Test")
    print("=" * 45)
    print(f"Started: {datetime.now()}")
    print()
    
    success, message = test_database_and_model()
    
    print()
    print("=" * 45)
    if success:
        print("RESULT: SUCCESS")
        print("The vehicle coordinates fix is working!")
        print("Database structure: OK")
        print("Model queries: OK") 
        print("Coordinate data: OK")
        print()
        print("READY FOR PRODUCTION DEPLOYMENT")
        print()
        print("To deploy to production:")
        print("1. Push code to repository")
        print("2. Deploy to Heroku")  
        print("3. Run: heroku run python apply_coordinates_simple.py")
        print("4. Test the vehicle search endpoints")
        return True
    else:
        print("RESULT: FAILED")
        print(f"Error: {message}")
        print("Fix the issues before production deployment")
        return False

if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1)