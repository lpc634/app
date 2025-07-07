# V3 Services Backend - Local Setup Guide

## Quick Start

1. **Create the backend directory:**
```bash
mkdir v3-services-backend
cd v3-services-backend
```

2. **Create the project structure:**
```bash
mkdir -p src/models src/routes
touch src/__init__.py src/models/__init__.py src/routes/__init__.py
```

3. **Create virtual environment:**
```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

4. **Create requirements.txt:**
```
Flask==3.0.0
Flask-SQLAlchemy==3.1.1
Flask-JWT-Extended==4.6.0
Flask-CORS==4.0.0
bcrypt==4.1.2
requests==2.31.0
APScheduler==3.10.4
python-dateutil==2.8.2
```

5. **Install dependencies:**
```bash
pip install -r requirements.txt
```

6. **Copy the source files** (provided below)

7. **Run the backend:**
```bash
python src/main.py
```

The backend will start on http://localhost:5000 with:
- Default admin: admin@v3services.com / admin123
- API endpoints available at /api/*
- Database automatically created

## Files to Create

Copy each of the following files into your project structure...

