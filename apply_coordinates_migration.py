#!/usr/bin/env python3
"""
Safe script to apply coordinate columns migration for production deployment.
This script ensures the migration is applied correctly whether on local SQLite or production PostgreSQL.
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
from flask_migrate import upgrade
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

def check_table_structure(app):
    """Check current table structure"""
    with app.app_context():
        try:
            inspector = inspect(db.engine)
            
            # Check if vehicle_sightings table exists
            if 'vehicle_sightings' not in inspector.get_table_names():
                print("❌ ERROR: vehicle_sightings table does not exist!")
                return False, [], []
            
            # Get current columns
            columns = inspector.get_columns('vehicle_sightings')
            column_names = [col['name'] for col in columns]
            
            print(f"✅ vehicle_sightings table exists with {len(column_names)} columns")
            
            # Check for coordinate columns
            has_latitude = 'latitude' in column_names
            has_longitude = 'longitude' in column_names
            
            print(f"📍 Latitude column exists: {has_latitude}")
            print(f"📍 Longitude column exists: {has_longitude}")
            
            missing_columns = []
            if not has_latitude:
                missing_columns.append('latitude')
            if not has_longitude:
                missing_columns.append('longitude')
            
            return True, column_names, missing_columns
            
        except Exception as e:
            print(f"❌ Error checking table structure: {e}")
            return False, [], []

def apply_migration_safely(app):
    """Apply the coordinates migration safely"""
    with app.app_context():
        try:
            print("\n🔄 Applying coordinates migration...")
            
            # Apply the specific migration
            result = db.session.execute(text("""
                DO $$
                BEGIN
                    -- Add latitude column if it doesn't exist
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'vehicle_sightings' AND column_name = 'latitude'
                    ) THEN
                        ALTER TABLE vehicle_sightings ADD COLUMN latitude REAL;
                        RAISE NOTICE 'Added latitude column';
                    ELSE
                        RAISE NOTICE 'Latitude column already exists';
                    END IF;
                    
                    -- Add longitude column if it doesn't exist  
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'vehicle_sightings' AND column_name = 'longitude'
                    ) THEN
                        ALTER TABLE vehicle_sightings ADD COLUMN longitude REAL;
                        RAISE NOTICE 'Added longitude column';
                    ELSE
                        RAISE NOTICE 'Longitude column already exists';
                    END IF;
                END
                $$;
            """))
            
            db.session.commit()
            print("✅ PostgreSQL migration completed successfully!")
            return True
            
        except Exception as e:
            # This might be SQLite, try SQLite syntax
            try:
                db.session.rollback()
                print("🔄 Trying SQLite migration...")
                
                # For SQLite, we need to check column existence differently
                inspector = inspect(db.engine)
                columns = [col['name'] for col in inspector.get_columns('vehicle_sightings')]
                
                if 'latitude' not in columns:
                    db.session.execute(text("ALTER TABLE vehicle_sightings ADD COLUMN latitude REAL"))
                    print("✅ Added latitude column")
                else:
                    print("ℹ️  Latitude column already exists")
                    
                if 'longitude' not in columns:
                    db.session.execute(text("ALTER TABLE vehicle_sightings ADD COLUMN longitude REAL"))
                    print("✅ Added longitude column")
                else:
                    print("ℹ️  Longitude column already exists")
                
                db.session.commit()
                print("✅ SQLite migration completed successfully!")
                return True
                
            except Exception as e2:
                print(f"❌ Migration failed: {e2}")
                db.session.rollback()
                return False

def test_query_after_migration(app):
    """Test the vehicle query that was failing"""
    with app.app_context():
        try:
            from src.models.vehicle import VehicleSighting
            
            print("\n🧪 Testing vehicle sighting query...")
            
            # Test the exact query from the failing route
            test_plate = 'TEST123'
            sightings = VehicleSighting.query.filter_by(registration_plate=test_plate).all()
            
            print(f"✅ Query successful! Found {len(sightings)} sightings for {test_plate}")
            
            # Test creating a new sighting with coordinates
            test_sighting = VehicleSighting(
                registration_plate='TEST456',
                address_seen='Test Location',
                latitude=52.2511019,
                longitude=-1.3718209,
                notes='Test sighting with coordinates',
                is_dangerous=False,
                agent_id=1  # This would need to exist
            )
            
            # Just validate the object can be created (don't save to avoid foreign key issues)
            print(f"✅ VehicleSighting object created with coordinates: lat={test_sighting.latitude}, lng={test_sighting.longitude}")
            
            return True
            
        except Exception as e:
            print(f"❌ Query test failed: {e}")
            import traceback
            traceback.print_exc()
            return False

def main():
    """Main function to apply the migration"""
    print("🚀 Vehicle Sightings Coordinates Migration Tool")
    print("=" * 60)
    print(f"⏰ Started at: {datetime.now()}")
    
    # Create app
    app, db_type = create_app()
    
    # Check current structure
    print("\n1️⃣  Checking current database structure...")
    table_exists, current_columns, missing_columns = check_table_structure(app)
    
    if not table_exists:
        print("❌ Cannot proceed - vehicle_sightings table doesn't exist!")
        return False
    
    if not missing_columns:
        print("✅ All coordinate columns already exist!")
    else:
        print(f"📝 Missing columns: {missing_columns}")
        
        # Apply migration
        print("\n2️⃣  Applying migration...")
        if not apply_migration_safely(app):
            print("❌ Migration failed!")
            return False
    
    # Verify structure after migration
    print("\n3️⃣  Verifying migration results...")
    table_exists, new_columns, still_missing = check_table_structure(app)
    
    if still_missing:
        print(f"❌ Migration incomplete - still missing: {still_missing}")
        return False
    
    # Test queries
    print("\n4️⃣  Testing vehicle queries...")
    if not test_query_after_migration(app):
        print("❌ Query testing failed!")
        return False
    
    print("\n" + "=" * 60)
    print("🎉 SUCCESS! Coordinates migration completed successfully!")
    print("✅ vehicle_sightings table now has latitude and longitude columns")
    print("✅ Vehicle queries are working correctly")
    print("✅ Ready for production deployment")
    print(f"⏰ Completed at: {datetime.now()}")
    
    return True

if __name__ == '__main__':
    try:
        success = main()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\n⚠️  Migration interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n💥 Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)