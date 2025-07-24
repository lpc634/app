# Create this file: add_columns.py

import os
import sys

# Add current directory to path
sys.path.insert(0, os.path.dirname(__file__))

# Import your app
from main import app
from src.extensions import db

def add_maps_columns():
    with app.app_context():
        try:
            # Use the newer SQLAlchemy syntax
            with db.engine.connect() as connection:
                try:
                    connection.execute(db.text("ALTER TABLE jobs ADD COLUMN location_lat VARCHAR(50);"))
                    print("✅ Added location_lat column")
                except Exception as e:
                    print(f"location_lat: {e}")
                
                try:
                    connection.execute(db.text("ALTER TABLE jobs ADD COLUMN location_lng VARCHAR(50);"))
                    print("✅ Added location_lng column")
                except Exception as e:
                    print(f"location_lng: {e}")
                
                try:
                    connection.execute(db.text("ALTER TABLE jobs ADD COLUMN maps_link TEXT;"))
                    print("✅ Added maps_link column")
                except Exception as e:
                    print(f"maps_link: {e}")
                
                connection.commit()
                print("🎉 Migration completed!")
                
        except Exception as e:
            print(f"❌ Error: {e}")

if __name__ == "__main__":
    add_maps_columns()