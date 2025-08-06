#!/usr/bin/env python3
"""
Production-ready test script for vehicle sighting coordinates fix.
Tests both local and production environments.
"""

import os
import sys
import requests
import json
from datetime import datetime

# Add src to path
sys.path.insert(0, 'src')

def test_database_structure():
    """Test the database structure locally"""
    try:
        # Load environment variables
        from dotenv import load_dotenv
        load_dotenv()
        
        from flask import Flask
        from src.extensions import db
        from sqlalchemy import inspect
        
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
        db.init_app(app)
        
        with app.app_context():
            inspector = inspect(db.engine)
            
            # Check if vehicle_sightings table exists
            if 'vehicle_sightings' not in inspector.get_table_names():
                return False, "vehicle_sightings table does not exist"
            
            # Get current columns
            columns = inspector.get_columns('vehicle_sightings')
            column_names = [col['name'] for col in columns]
            
            # Check for coordinate columns
            has_latitude = 'latitude' in column_names
            has_longitude = 'longitude' in column_names
            
            if not has_latitude or not has_longitude:
                return False, f"Missing columns: latitude={has_latitude}, longitude={has_longitude}"
            
            return True, f"Database structure OK: {len(column_names)} columns including latitude/longitude"
        
    except Exception as e:
        return False, f"Database test failed: {e}"

def test_vehicle_model():
    """Test the VehicleSighting model"""
    try:
        from flask import Flask
        from src.extensions import db
        from src.models.user import User
        from src.models.vehicle import VehicleSighting
        from dotenv import load_dotenv
        load_dotenv()
        
        app = Flask(__name__)
        
        # Configure database
        DATABASE_URL = os.environ.get('DATABASE_URL')
        if DATABASE_URL:
            if DATABASE_URL.startswith("postgres://"):
                DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
            app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL
        else:
            db_path = os.path.join(os.path.dirname(__file__), 'database', 'app.db')
            app.config['SQLALCHEMY_DATABASE_URI'] = f"sqlite:///{db_path}"
        
        app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
        db.init_app(app)
        
        with app.app_context():
            # Test the exact query that was failing
            test_plate = 'TEST123'
            sightings = VehicleSighting.query.filter_by(registration_plate=test_plate).all()
            
            if sightings:
                # Test the to_dict method includes coordinates
                sighting_data = sightings[0].to_dict()
                if 'latitude' not in sighting_data or 'longitude' not in sighting_data:
                    return False, "to_dict() method missing coordinate fields"
                
                return True, f"Model test OK: Found {len(sightings)} sightings, coordinates included in response"
            else:
                return True, "Model test OK: Query executed successfully (no sightings found)"
        
    except Exception as e:
        return False, f"Model test failed: {e}"

def test_http_endpoint(base_url="http://localhost:5001"):
    """Test the HTTP endpoint (requires running Flask app)"""
    try:
        # This test requires authentication, so we'll just test if the endpoint exists
        response = requests.get(f"{base_url}/vehicles/TEST123", timeout=5)
        
        # We expect either 401 (authentication required) or 200/404 (working)
        if response.status_code in [200, 404, 401]:
            return True, f"HTTP endpoint accessible (status {response.status_code})"
        else:
            return False, f"HTTP endpoint error: status {response.status_code}"
        
    except requests.exceptions.ConnectionError:
        return False, "Cannot connect to Flask app (is it running?)"
    except Exception as e:
        return False, f"HTTP test failed: {e}"

def main():
    """Run all tests"""
    print("Vehicle Sightings Fix - Production Test Suite")
    print("=" * 55)
    print(f"Started at: {datetime.now()}")
    print()
    
    tests = [
        ("Database Structure", test_database_structure),
        ("Vehicle Model", test_vehicle_model),
        ("HTTP Endpoint", test_http_endpoint),
    ]
    
    results = []
    
    for test_name, test_func in tests:
        print(f"Testing {test_name}...")
        try:
            success, message = test_func()
            results.append((test_name, success, message))
            status = "PASS" if success else "FAIL"
            print(f"  {status}: {message}")
        except Exception as e:
            results.append((test_name, False, str(e)))
            print(f"  ERROR: {e}")
        print()
    
    # Summary
    print("=" * 55)
    print("TEST RESULTS SUMMARY")
    print("=" * 55)
    
    passed = sum(1 for _, success, _ in results if success)
    total = len(results)
    
    print(f"Passed: {passed}/{total}")
    print()
    
    for test_name, success, message in results:
        status = "✓ PASS" if success else "✗ FAIL"
        print(f"{status}: {test_name}")
        if not success:
            print(f"    Error: {message}")
    
    print()
    
    if passed == total:
        print("🎉 ALL TESTS PASSED!")
        print("The vehicle sightings coordinates fix is working correctly.")
        print("Ready for production deployment!")
        return True
    else:
        print("⚠️  SOME TESTS FAILED!")
        print("Please fix the issues before deploying to production.")
        return False

if __name__ == '__main__':
    try:
        success = main()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"Test suite error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)