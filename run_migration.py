#!/usr/bin/env python
"""Simple script to run the authority_to_act migration."""

import sys
sys.path.insert(0, '.')

from main import app
from src.extensions import db
from migrations.versions import add_authority_to_act_20251007

print("Running Authority to Act migration...")

with app.app_context():
    conn = db.engine.connect()
    try:
        # Import the upgrade function
        from migrations.versions.add_authority_to_act_20251007 import upgrade
        upgrade()
        print("✓ Migration completed successfully!")
    except Exception as e:
        print(f"✗ Migration failed: {e}")
        raise
    finally:
        conn.close()
