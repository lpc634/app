#!/usr/bin/env python
"""Script to fix CRM note foreign key migration."""

import sys
sys.path.insert(0, '.')

from main import app
from src.extensions import db

print("Running CRM Note Foreign Key Fix migration...")

with app.app_context():
    conn = db.engine.connect()
    try:
        # Import the upgrade function
        from migrations.versions.fix_crm_note_foreign_key_20251112_204044 import upgrade
        upgrade()
        print("✓ Migration completed successfully!")
    except Exception as e:
        print(f"✗ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        conn.close()
