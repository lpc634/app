# --- Load environment variables from .env file FIRST ---
from dotenv import load_dotenv
load_dotenv()

# --- Standard Library and System Imports ---
import os
import sys
from datetime import timedelta

# --- Add 'src' to the Python path ---
sys.path.insert(0, 'src')

# --- Flask and Extension Imports ---
from flask import Flask, send_from_directory, jsonify
from flask_jwt_extended import JWTManager
from flask_cors import CORS

# --- Application-specific Imports ---
from src.models.user import db, User
from src.scheduler import init_scheduler

# --- Route Blueprint Imports ---
from src.routes.user import user_bp
from src.routes.auth import auth_bp, check_if_token_revoked
from src.routes.availability import availability_bp
from src.routes.jobs import jobs_bp
from src.routes.notifications import notifications_bp
from src.routes.weather import weather_bp
from src.routes.analytics import analytics_bp
from src.routes.agent import agent_bp
from src.routes.utils import utils_bp

# --- Flask App Initialization ---
# CHANGED: The static folder now points to a 'dist' directory INSIDE this project.
static_folder_path = os.path.join(os.path.dirname(__file__), 'dist')
app = Flask(__name__, static_folder=static_folder_path)

# --- App Configuration ---
SECRET = os.environ.get('SECRET_KEY', 'v3-services-secret-key-change-in-production')
app.config['SECRET_KEY'] = SECRET
app.config['JWT_SECRET_KEY'] = SECRET
app.config['JWT_ALGORITHM'] = 'HS256'
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=24)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# --- VAPID Keys for Push Notifications ---
app.config['VAPID_PUBLIC_KEY'] = 'BCVp6sM-3kVT43iVnAUrkXYc2gVdofIMc3tB4p7Q2Qv5G2b5P2iRzBEe-s2w9i5n-8T0aHkXyGNIk2N8yA9fUo8='
app.config['VAPID_PRIVATE_KEY'] = 'jVpVIp5k2wOgrqI2nvy5kY7rBCEy5d2o1d5sJ6sW1Yg='


# --- !! CRITICAL CHANGE: Database Configuration for Heroku !! ---
# This code now uses the Heroku Postgres DATABASE_URL when available.
DATABASE_URL = os.environ.get('DATABASE_URL')
if DATABASE_URL:
    # Heroku's DATABASE_URL starts with 'postgres://', but SQLAlchemy needs 'postgresql://'
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
    app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL
else:
    # Fallback to local SQLite database if DATABASE_URL is not set
    db_dir = os.path.join(os.path.dirname(__file__), 'database')
    os.makedirs(db_dir, exist_ok=True)
    app.config['SQLALCHEMY_DATABASE_URI'] = f"sqlite:///{os.path.join(db_dir, 'app.db')}"

# --- !! CRITICAL CHANGE: CORS Configuration for Heroku !! ---
# This code now allows your live Heroku app URL to make requests.
LIVE_APP_URL = os.environ.get('LIVE_APP_URL')
origins = ["http://localhost:5173", "http://localhost:5174"]
if LIVE_APP_URL:
    origins.append(LIVE_APP_URL)

CORS(app, origins=origins, supports_credentials=True, allow_headers=["Content-Type", "Authorization"], methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])


# --- Initialize Extensions ---
db.init_app(app)
jwt = JWTManager(app)

# --- JWT Configuration ---
@jwt.token_in_blocklist_loader
def check_if_token_is_revoked_wrapper(jwt_header, jwt_payload):
    return check_if_token_revoked(jwt_header, jwt_payload)

# ... (other JWT loaders are fine)

# --- Register Blueprints ---
app.register_blueprint(user_bp, url_prefix='/api')
app.register_blueprint(auth_bp, url_prefix='/api')
app.register_blueprint(availability_bp, url_prefix='/api')
app.register_blueprint(jobs_bp, url_prefix='/api')
app.register_blueprint(notifications_bp, url_prefix='/api')
app.register_blueprint(weather_bp, url_prefix='/api')
app.register_blueprint(analytics_bp, url_prefix='/api')
app.register_blueprint(agent_bp, url_prefix='/api')
app.register_blueprint(utils_bp, url_prefix='/api')

# --- Static File Serving for Frontend ---
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    if path and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    else:
        # If the path doesn't exist, it's a frontend route; serve index.html.
        return send_from_directory(app.static_folder, 'index.html')


# --- App Initialization Block ---
# NOTE: The db.create_all() is often handled by 'heroku run flask db upgrade' in production
# but for simplicity, we'll leave it here for the first deploy.
with app.app_context():
    db.create_all()
    # Initialize the background scheduler
    init_scheduler(app)

# --- Main Execution (Not used by Gunicorn/Heroku) ---
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)