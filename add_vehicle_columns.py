#!/usr/bin/env python3
"""
Add vehicle detail columns to vehicle_sightings table.
Run this before deploying the updated code with vehicle details.
"""

import os
import sys
from flask import Flask
from sqlalchemy import text

# Add the project root to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.extensions import db

def create_app():
    app = Flask(__name__)
    
    # Configure database
    database_url = os.environ.get('DATABASE_URL', 'sqlite:///vehicle_intelligence.db')
    app.config['SQLALCHEMY_DATABASE_URI'] = database_url
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    
    db.init_app(app)
    return app

def add_vehicle_columns():
    """Add make, model, colour columns to vehicle_sightings table."""
    
    app = create_app()
    
    with app.app_context():
        try:
            # Check if the table exists
            inspector = db.inspect(db.engine)
            tables = inspector.get_table_names()
            
            if 'vehicle_sightings' not in tables:
                print("ERROR: vehicle_sightings table does not exist!")
                return False
            
            # Check which columns exist
            columns = [col['name'] for col in inspector.get_columns('vehicle_sightings')]
            print(f"Current columns: {columns}")
            
            # Add missing columns
            columns_to_add = []
            if 'make' not in columns:
                columns_to_add.append(('make', 'VARCHAR(50)'))
            if 'model' not in columns:
                columns_to_add.append(('model', 'VARCHAR(100)'))
            if 'colour' not in columns:
                columns_to_add.append(('colour', 'VARCHAR(30)'))
            
            if columns_to_add:
                print(f"Adding columns: {[col[0] for col in columns_to_add]}")
                
                for column_name, column_type in columns_to_add:
                    sql = text(f"ALTER TABLE vehicle_sightings ADD COLUMN {column_name} {column_type}")
                    db.session.execute(sql)
                    print(f"  ✓ Added {column_name} {column_type}")
                
                db.session.commit()
                print("✅ Vehicle detail columns added successfully!")
                return True
            else:
                print("✅ All vehicle detail columns already exist.")
                return True
                
        except Exception as e:
            print(f"❌ Error: {e}")
            db.session.rollback()
            return False

if __name__ == '__main__':
    success = add_vehicle_columns()
    sys.exit(0 if success else 1)