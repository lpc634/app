# --- Load environment variables from .env file FIRST ---
from dotenv import load_dotenv
load_dotenv()

# --- Standard Library and System Imports ---
import os
import sys
import requests
from datetime import timedelta

# --- Get Git SHA for version tracking ---
GIT_SHA = os.environ.get('GIT_SHA', 'dev')

# --- Add 'src' to the Python path ---
sys.path.insert(0, 'src')

# --- Flask and Extension Imports ---
from flask import Flask, send_from_directory, jsonify
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from flask_migrate import Migrate

# --- Application-specific Imports ---
from src.extensions import db
from src.models.user import User
from src.models.vehicle import VehicleSighting
from src.models.vehicle_details import VehicleDetails
from src.scheduler import init_scheduler
from src.models.user import Setting

# --- Route Blueprint Imports ---
from src.routes.user import user_bp
from src.routes.intelligence import intelligence_bp
from src.routes.auth import auth_bp, check_if_token_revoked
from src.routes.availability import availability_bp
from src.routes.jobs import jobs_bp
from src.routes.notifications import notifications_bp
from src.routes.fcm_notifications import fcm_bp
from src.routes.weather import weather_bp
from src.routes.analytics import analytics_bp
from src.routes.agent import agent_bp
from src.routes.health import health_bp
# REMOVED: from src.routes.utils import utils_bp
from src.routes.admin import admin_bp
from src.routes.vehicles import vehicles_bp
from src.routes.invoices import invoices_bp
from src.routes.telegram import telegram_bp, telegram_api_bp, agent_telegram_bp
from src.routes.police_interactions import bp as police_bp
from src.routes.forms import forms_bp
from src.routes.authority_to_act import authority_bp


# --- Flask App Initialization ---
static_folder_path = os.path.join(os.path.dirname(__file__), 'dist')
app = Flask(__name__, static_folder=static_folder_path)

# --- App Configuration ---
SECRET = os.environ.get('SECRET_KEY', 'v3-services-secret-key-change-in-production')
app.config['SECRET_KEY'] = SECRET
app.config['JWT_SECRET_KEY'] = SECRET
app.config['JWT_ALGORITHM'] = 'HS256'
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=24)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# --- UPLOAD FOLDER CONFIGURATION (FINAL HEROKU FIX) ---
UPLOAD_FOLDER = os.path.join('/tmp', 'uploads')
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
# ----------------------------------------------------

# --- AWS S3 Configuration ---
app.config['AWS_ACCESS_KEY_ID'] = os.environ.get('AWS_ACCESS_KEY_ID')
app.config['AWS_SECRET_ACCESS_KEY'] = os.environ.get('AWS_SECRET_ACCESS_KEY')
app.config['AWS_S3_BUCKET'] = os.environ.get('AWS_S3_BUCKET')
app.config['AWS_S3_REGION'] = os.environ.get('AWS_S3_REGION')
# --------------------------------

# --- VAPID Keys for Push Notifications ---
app.config['VAPID_PUBLIC_KEY'] = os.environ.get('VAPID_PUBLIC_KEY', 'BCVp6sM-3kVT43iVnAUrkXYc2gVdofIMc3tB4p7Q2Qv5G2b5P2iRzBEe-s2w9i5n-8T0aHkXyGNIk2N8yA9fUo8=')
app.config['VAPID_PRIVATE_KEY'] = os.environ.get('VAPID_PRIVATE_KEY', 'jVpVIp5k2wOgrqI2nvy5kY7rBCEy5d2o1d5sJ6sW1Yg=')

# --- Database Configuration for Heroku ---
DATABASE_URL = os.environ.get('DATABASE_URL')
if DATABASE_URL:
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
    app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL
else:
    db_dir = os.path.join(os.path.dirname(__file__), 'database')
    os.makedirs(db_dir, exist_ok=True)
    app.config['SQLALCHEMY_DATABASE_URI'] = f"sqlite:///{os.path.join(db_dir, 'app.db')}"

# --- Email Configuration ---
app.config['MAIL_SERVER'] = os.environ.get('MAIL_SERVER', 'smtp.gmail.com')
app.config['MAIL_PORT'] = os.environ.get('MAIL_PORT', 587)
app.config['MAIL_USE_TLS'] = os.environ.get('MAIL_USE_TLS', 'True').lower() == 'true'
app.config['MAIL_USERNAME'] = os.environ.get('MAIL_USERNAME')
app.config['MAIL_PASSWORD'] = os.environ.get('MAIL_PASSWORD')
app.config['MAIL_DEFAULT_SENDER'] = os.environ.get('MAIL_DEFAULT_SENDER', 'V3 Services <no-reply@v3-services.com>')

# --- Telegram Integration Configuration ---
from distutils.util import strtobool

def env_bool(name, default=False):
    val = os.getenv(name)
    return bool(strtobool(val)) if val is not None else default

# Compute TELEGRAM_ENABLED server-side with proper validation
TELEGRAM_ENABLED = (
    env_bool("TELEGRAM_ENABLED", False) and 
    bool(os.getenv("TELEGRAM_BOT_TOKEN")) and 
    bool(os.getenv("TELEGRAM_WEBHOOK_SECRET"))
)

app.config['TELEGRAM_ENABLED'] = TELEGRAM_ENABLED
app.config['TELEGRAM_BOT_TOKEN'] = os.environ.get("TELEGRAM_BOT_TOKEN", "")
app.config['TELEGRAM_BOT_USERNAME'] = os.environ.get("TELEGRAM_BOT_USERNAME", "V3JobsBot")
app.config['TELEGRAM_WEBHOOK_SECRET'] = os.environ.get("TELEGRAM_WEBHOOK_SECRET", "")
app.config['PUBLIC_BASE_URL'] = os.environ.get("PUBLIC_BASE_URL", "https://v3-app.herokuapp.com")
# Admin Telegram group (optional)
app.config['TELEGRAM_ADMIN_CHAT_ID'] = os.environ.get('TELEGRAM_ADMIN_CHAT_ID')
app.config['TELEGRAM_ADMIN_THREAD_ID'] = os.environ.get('TELEGRAM_ADMIN_THREAD_ID')
app.config['TELEGRAM_SET_WEBHOOK_ON_START'] = os.environ.get('TELEGRAM_SET_WEBHOOK_ON_START', 'false')
app.config['NOTIFICATIONS_ENABLED'] = env_bool('NOTIFICATIONS_ENABLED', True)

# --- CORS Configuration for Heroku ---
LIVE_APP_URL = os.environ.get('LIVE_APP_URL', 'https://v3-app-49c3d1eff914.herokuapp.com')
origins = ["http://localhost:5173", "http://localhost:5174", "http://localhost:5175", "http://localhost:5176"]
if LIVE_APP_URL:
    origins.append(LIVE_APP_URL)

CORS(app, origins=origins, supports_credentials=True, allow_headers=["Content-Type", "Authorization"], methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])

# --- Initialize Extensions ---
db.init_app(app)
migrate = Migrate(app, db)
jwt = JWTManager(app)

# --- JWT Configuration ---
@jwt.token_in_blocklist_loader
def check_if_token_is_revoked_wrapper(jwt_header, jwt_payload):
    return check_if_token_revoked(jwt_header, jwt_payload)


# --- User lookup loader for get_current_user() (Flask-JWT-Extended v4+) ---
@jwt.user_lookup_loader
def load_user_from_jwt(_jwt_header, jwt_data):
    """Resolve the current user from the JWT subject (sub).

    Tokens are issued with identity=str(user.id), so convert to int safely.
    """
    identity = jwt_data.get("sub")
    try:
        user_id = int(identity) if identity is not None else None
    except (TypeError, ValueError):
        user_id = None
    return User.query.get(user_id) if user_id is not None else None



# --- Register Blueprints ---
app.register_blueprint(user_bp, url_prefix='/api')
app.register_blueprint(intelligence_bp, url_prefix='/api')
app.register_blueprint(auth_bp, url_prefix='/api')
app.register_blueprint(availability_bp, url_prefix='/api')
app.register_blueprint(jobs_bp, url_prefix='/api')
app.register_blueprint(notifications_bp, url_prefix='/api')
app.register_blueprint(fcm_bp, url_prefix='/api')
app.register_blueprint(weather_bp, url_prefix='/api')
app.register_blueprint(analytics_bp, url_prefix='/api')
app.register_blueprint(agent_bp, url_prefix='/api')
app.register_blueprint(health_bp, url_prefix='/api')
# REMOVED: app.register_blueprint(utils_bp, url_prefix='/api')
app.register_blueprint(admin_bp, url_prefix='/api')
# --- THIS LINE IS NOW UNCOMMENTED ---
app.register_blueprint(vehicles_bp, url_prefix='/api')
app.register_blueprint(invoices_bp, url_prefix='/api')
app.register_blueprint(telegram_bp)
app.register_blueprint(telegram_api_bp)
app.register_blueprint(agent_telegram_bp)
app.register_blueprint(police_bp, url_prefix='/api')
app.register_blueprint(forms_bp, url_prefix='/api')
app.register_blueprint(authority_bp, url_prefix='/api')


# --- Version tracking routes and headers ---
@app.route('/__version')
def version():
    """Return the current git commit for version tracking"""
    return jsonify({'git': GIT_SHA})

@app.route('/api/__version')
def api_version():
    """Return the current git commit for version tracking (API scope)"""
    return jsonify({'git': GIT_SHA})

@app.after_request
def after_request(response):
    """Add X-App-Commit header to all responses"""
    response.headers['X-App-Commit'] = GIT_SHA
    return response


# --- Debug Route (add this right after the blueprint registrations) ---
@app.route('/api/debug/users')
def debug_users():
    from src.models.user import User
    users = User.query.all()
    user_data = []
    for user in users:
        user_data.append({
            'email': user.email,
            'role': user.role,
            'first_name': user.first_name,
            'last_name': user.last_name
        })
    return jsonify({'users': user_data, 'count': len(users)})

# Image proxy route for document serving from ngrok
@app.route('/api/images/<path:filename>')
def serve_uploaded_image(filename):
    """
    Proxy images from the ngrok server for document viewing
    This route fetches images from the ngrok server and serves them through the Flask app
    """
    print(f"Trying to serve image: {filename}")  # Add logging
    try:
        # The ngrok server URL where documents are stored
        NGROK_URL = "https://1b069dfae07e.ngrok-free.app"
        
        # Construct the full URL to the file on the ngrok server
        file_url = f"{NGROK_URL}/files/{filename}"
        
        app.logger.info(f"Proxying image request for: {filename} from {file_url}")
        
        # Fetch the file from the ngrok server
        response = requests.get(file_url, timeout=30)
        
        if response.status_code == 200:
            # Forward the content with appropriate headers
            from flask import Response
            return Response(
                response.content,
                mimetype=response.headers.get('Content-Type', 'image/jpeg'),
                headers={
                    'Cache-Control': 'public, max-age=3600',  # Cache for 1 hour
                    'Access-Control-Allow-Origin': '*'
                }
            )
        else:
            app.logger.error(f"Failed to fetch image from ngrok server: {response.status_code}")
            return jsonify({
                'error': 'Image not found on storage server',
                'status_code': response.status_code
            }), 404
            
    except requests.exceptions.Timeout:
        app.logger.error(f"Timeout fetching image: {filename}")
        return jsonify({'error': 'Storage server timeout'}), 504
        
    except requests.exceptions.ConnectionError:
        app.logger.error(f"Connection error fetching image: {filename}")
        return jsonify({'error': 'Cannot connect to storage server'}), 503
        
    except Exception as e:
        app.logger.error(f"Error proxying image {filename}: {str(e)}")
        return jsonify({'error': 'Failed to load image'}), 500

# --- Static File Serving for Frontend ---
@app.route('/service-worker.js')
def service_worker():
    """Serve service worker with correct MIME type"""
    return send_from_directory('Public', 'service-worker.js', mimetype='application/javascript')

@app.route('/firebase-messaging-sw.js')
def firebase_messaging_sw():
    """Serve Firebase messaging service worker with correct MIME type"""
    return send_from_directory('Public', 'firebase-messaging-sw.js', mimetype='application/javascript')

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    # Don't intercept API routes - let blueprints handle them
    if path.startswith('api/'):
        return jsonify({'error': 'API endpoint not found'}), 404
    
    if path != '' and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, 'index.html')

# --- Error Handler for 500 Errors ---
@app.errorhandler(500)
def internal_server_error(e):
    app.logger.error(f"Server error: {str(e)}")
    return jsonify({"error": "An internal server error occurred. Please try again."}), 500

# --- App Initialization Block ---
with app.app_context():
    db.create_all()  # Create tables first
    init_scheduler(app)  # Then initialize scheduler
    try:
        # Optionally set Telegram webhook on startup
        from src.integrations.telegram_client import ensure_webhook
        ensure_webhook()
    except Exception as e:
        app.logger.warning(f"Skipping Telegram webhook setup: {str(e)}")

    # Seed notifications toggle if missing
    try:
        key = 'notifications_enabled'
        if Setting.get(key, None) is None:
            default_enabled = str(app.config.get('NOTIFICATIONS_ENABLED', 'true')).lower() in ('1','true','yes','on')
            Setting.set_bool(key, default_enabled)
            app.logger.info(f"Seeded {key}={default_enabled}")
    except Exception as e:
        app.logger.warning(f"Unable to seed notifications setting: {e}")

# --- Main Execution (Not used by Gunicorn/Heroku) ---
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)
