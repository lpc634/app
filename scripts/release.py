"""Heroku release phase: bring the database schema up to date.

The Alembic chain only alters tables that db.create_all() made in the original
deployment, so it cannot build an empty database. On a database without the
base tables, create the schema from the models and stamp it at head instead.
"""
import sys
sys.path.insert(0, '.')

from flask_migrate import stamp, upgrade
from sqlalchemy import inspect, text

from main import app
from src.extensions import db

with app.app_context():
    if inspect(db.engine).has_table('users'):
        upgrade()
    else:
        db.create_all()
        stamp(revision='heads')
        # Same widening the skipped widen_version migrations applied, so later
        # revisions with long ids still fit.
        if db.engine.dialect.name == 'postgresql':
            with db.engine.begin() as conn:
                conn.execute(text("ALTER TABLE alembic_version ALTER COLUMN version_num TYPE VARCHAR(64)"))
        print('Empty database: created schema from models and stamped at head.')
