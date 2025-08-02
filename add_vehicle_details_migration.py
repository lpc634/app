#!/usr/bin/env python3
"""
Migration script to add vehicle detail columns to existing vehicle_sightings table.
Run this script after deploying the updated model to add the new columns.
"""

import os
import sys
from flask import Flask
from sqlalchemy import text

# Add the project root to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.extensions import db
from src.models.vehicle import VehicleSighting
from src.models.user import User

def create_app():
    app = Flask(__name__)
    
    # Configure database - adjust this path if needed
    database_url = os.environ.get('DATABASE_URL', 'sqlite:///vehicle_intelligence.db')
    app.config['SQLALCHEMY_DATABASE_URI'] = database_url
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    
    db.init_app(app)
    return app

def add_vehicle_detail_columns():
    """Add make, model, colour columns to vehicle_sightings table if they don't exist."""
    
    app = create_app()
    
    with app.app_context():
        try:
            # Check if the table exists
            inspector = db.inspect(db.engine)
            tables = inspector.get_table_names()
            
            if 'vehicle_sightings' not in tables:
                print("vehicle_sightings table does not exist. Creating all tables...")
                db.create_all()
                print("All tables created successfully!")
                return
            
            # Check which columns exist
            columns = [col['name'] for col in inspector.get_columns('vehicle_sightings')]
            print(f"Existing columns: {columns}")
            
            # Add missing columns
            columns_to_add = []
            if 'make' not in columns:
                columns_to_add.append(('make', 'VARCHAR(50)'))
            if 'model' not in columns:
                columns_to_add.append(('model', 'VARCHAR(50)'))
            if 'colour' not in columns:
                columns_to_add.append(('colour', 'VARCHAR(30)'))
            
            if columns_to_add:
                print(f"Adding columns: {[col[0] for col in columns_to_add]}")
                
                for column_name, column_type in columns_to_add:
                    sql = text(f"ALTER TABLE vehicle_sightings ADD COLUMN {column_name} {column_type}")
                    db.session.execute(sql)
                
                db.session.commit()
                print("Vehicle detail columns added successfully!")
            else:
                print("All vehicle detail columns already exist.")
                
        except Exception as e:
            print(f"Error: {e}")
            db.session.rollback()
            raise

if __name__ == '__main__':
    add_vehicle_detail_columns()