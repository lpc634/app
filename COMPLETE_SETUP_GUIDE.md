# V3 Services - Complete Local Setup

## 🚀 Quick Start (5 minutes)

### Step 1: Create Project Structure
```bash
mkdir v3-services-system
cd v3-services-system
```

### Step 2: Backend Setup
```bash
# Create backend directory
mkdir v3-services-backend
cd v3-services-backend

# Create directory structure
mkdir -p src/models src/routes src/database

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Create requirements.txt
cat > requirements.txt << 'EOF'
Flask==3.0.0
Flask-SQLAlchemy==3.1.1
Flask-JWT-Extended==4.6.0
Flask-CORS==4.0.0
bcrypt==4.1.2
requests==2.31.0
APScheduler==3.10.4
python-dateutil==2.8.2
EOF

# Install dependencies
pip install -r requirements.txt
```

### Step 3: Copy Backend Files
Copy the following files into your `src/` directory:

**File: src/main.py**
```python
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from flask import Flask, send_from_directory, jsonify
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from src.models.user import db
from src.routes.user import user_bp
from src.routes.auth import auth_bp, check_if_token_revoked
from src.routes.availability import availability_bp
from src.routes.jobs import jobs_bp
from src.routes.notifications import notifications_bp
from src.routes.weather import weather_bp
from src.routes.analytics import analytics_bp
from src.scheduler import init_scheduler, get_scheduler_status

app = Flask(__name__, static_folder=os.path.join(os.path.dirname(__file__), 'static'))

# Configuration
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'v3-services-secret-key-change-in-production')
app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', 'jwt-secret-change-in-production')
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = False

# Database configuration
app.config['SQLALCHEMY_DATABASE_URI'] = f"sqlite:///{os.path.join(os.path.dirname(__file__), 'database', 'app.db')}"
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize extensions
db.init_app(app)
jwt = JWTManager(app)
CORS(app, origins="*")

# JWT configuration
@jwt.token_in_blocklist_loader
def check_if_token_is_revoked(jwt_header, jwt_payload):
    return check_if_token_revoked(jwt_header, jwt_payload)

@jwt.expired_token_loader
def expired_token_callback(jwt_header, jwt_payload):
    return jsonify({'error': 'Token has expired'}), 401

@jwt.invalid_token_loader
def invalid_token_callback(error):
    return jsonify({'error': 'Invalid token'}), 401

@jwt.unauthorized_loader
def missing_token_callback(error):
    return jsonify({'error': 'Authorization token is required'}), 401

# Register blueprints
app.register_blueprint(user_bp, url_prefix='/api')
app.register_blueprint(auth_bp, url_prefix='/api')
app.register_blueprint(availability_bp, url_prefix='/api')
app.register_blueprint(jobs_bp, url_prefix='/api')
app.register_blueprint(notifications_bp, url_prefix='/api')
app.register_blueprint(weather_bp, url_prefix='/api')
app.register_blueprint(analytics_bp, url_prefix='/api')

# Health check endpoint
@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy',
        'service': 'V3 Services Backend API',
        'version': '1.0.0'
    }), 200

# Create database tables and default admin
with app.app_context():
    db.create_all()
    
    from src.models.user import User
    admin_user = db.session.query(db.exists().where(
        (User.email == 'admin@v3services.com') & (User.role == 'admin')
    )).scalar()
    
    if not admin_user:
        admin = User(
            email='admin@v3services.com',
            role='admin',
            first_name='Admin',
            last_name='User'
        )
        admin.set_password('admin123')
        db.session.add(admin)
        db.session.commit()
        print("Default admin user created: admin@v3services.com / admin123")
    
    init_scheduler(app)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
```

### Step 4: Start Backend
```bash
python src/main.py
```

You should see:
```
Default admin user created: admin@v3services.com / admin123
* Running on all addresses (0.0.0.0)
* Running on http://127.0.0.1:5000
```

### Step 5: Test Backend
Open http://localhost:5000/api/health - you should see:
```json
{
  "status": "healthy",
  "service": "V3 Services Backend API",
  "version": "1.0.0"
}
```

## 📝 Next Steps

1. **Copy the remaining backend files** (I'll provide them next)
2. **Set up the frontend applications**
3. **Test the complete system**

Let me know when you have the backend running and I'll provide the remaining files!

