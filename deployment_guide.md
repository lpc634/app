# V3 Services Field Agent Deployment System
## Complete Deployment and User Guide

### Table of Contents
1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Installation Guide](#installation-guide)
4. [Configuration](#configuration)
5. [Deployment](#deployment)
6. [User Guides](#user-guides)
7. [API Documentation](#api-documentation)
8. [Troubleshooting](#troubleshooting)
9. [Maintenance](#maintenance)

---

## System Overview

The V3 Services Field Agent Deployment System is a comprehensive solution designed to enable rapid deployment of field agents for urgent jobs. The system consists of three main components:

### Components
- **Backend API**: Flask-based REST API with SQLite database
- **Web Dashboard**: React-based admin interface for job and agent management
- **Mobile App**: React-based mobile application for field agents

### Key Features
- Real-time job assignment and notifications
- Agent availability management with weekly scheduling
- Urgent job prioritization with instant notifications
- Weather integration for job locations
- Comprehensive analytics and reporting
- Automated weekly availability reminders
- Role-based access control (Admin vs Agent)

### Technology Stack
- **Backend**: Python Flask, SQLite, JWT Authentication, APScheduler
- **Frontend**: React, Tailwind CSS, shadcn/ui, Recharts
- **Notifications**: Firebase Cloud Messaging (FCM) ready
- **Weather**: OpenWeatherMap API integration
- **Deployment**: Docker-ready, cloud-deployable

---

## Architecture

### System Architecture Diagram
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Dashboard │    │   Mobile App    │    │  External APIs  │
│   (Admin UI)    │    │  (Agent UI)     │    │ (Weather, FCM)  │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          │              HTTP/REST API                  │
          │                      │                      │
          └──────────────┬───────┴──────────────────────┘
                         │
                ┌────────▼────────┐
                │   Backend API   │
                │   (Flask)       │
                └────────┬────────┘
                         │
                ┌────────▼────────┐
                │   SQLite DB     │
                │   (Data Store)  │
                └─────────────────┘
```

### Database Schema
```sql
-- Users (Admins and Agents)
users: id, email, password_hash, first_name, last_name, role, phone, created_at, updated_at

-- Agent Availability
availability: id, agent_id, date, is_available, is_away, notes, created_at, updated_at

-- Jobs
jobs: id, title, job_type, address, postcode, arrival_time, agents_required, 
      lead_agent_name, instructions, urgency_level, status, created_at, updated_at

-- Job Assignments
assignments: id, job_id, agent_id, status, assigned_at, responded_at, created_at, updated_at

-- Notifications
notifications: id, user_id, title, message, type, is_read, sent_at, created_at, updated_at

-- JWT Token Blacklist
token_blacklist: id, jti, created_at
```

---



## Installation Guide

### Prerequisites
- Python 3.11+ 
- Node.js 20+
- npm or pnpm
- Git

### Backend Setup

#### 1. Clone and Setup Backend
```bash
# Navigate to backend directory
cd v3-services-backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Initialize database
python src/main.py
# This will create the SQLite database and default admin user
```

#### 2. Environment Configuration
Create `.env` file in backend root:
```env
# Database
DATABASE_URL=sqlite:///v3_services.db

# JWT Configuration
JWT_SECRET_KEY=your-super-secret-jwt-key-change-this-in-production
JWT_ACCESS_TOKEN_EXPIRES=3600

# Weather API (Optional)
OPENWEATHER_API_KEY=your-openweather-api-key

# Firebase Cloud Messaging (Optional)
FCM_SERVER_KEY=your-fcm-server-key

# Flask Configuration
FLASK_ENV=production
FLASK_DEBUG=False
```

#### 3. Start Backend Server
```bash
# Development
python src/main.py

# Production (with Gunicorn)
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 src.main:app
```

### Web Dashboard Setup

#### 1. Install Dependencies
```bash
cd v3-services-dashboard
npm install
# or
pnpm install
```

#### 2. Environment Configuration
Create `.env` file in dashboard root:
```env
VITE_API_BASE_URL=http://localhost:5000/api
# For production, use your actual API URL
# VITE_API_BASE_URL=https://your-api-domain.com/api
```

#### 3. Build and Start
```bash
# Development
npm run dev
# or
pnpm run dev

# Production build
npm run build
# or
pnpm run build

# Serve production build
npm run preview
# or
pnpm run preview
```

### Mobile App Setup

#### 1. Install Dependencies
```bash
cd v3-services-mobile
npm install
# or
pnpm install
```

#### 2. Environment Configuration
Create `.env` file in mobile app root:
```env
VITE_API_BASE_URL=http://localhost:5000/api
# For production, use your actual API URL
# VITE_API_BASE_URL=https://your-api-domain.com/api
```

#### 3. Build and Start
```bash
# Development
npm run dev
# or
pnpm run dev

# Production build
npm run build
# or
pnpm run build
```

---

## Configuration

### Backend Configuration

#### Database Configuration
The system uses SQLite by default for simplicity. For production, consider PostgreSQL:

```python
# In src/main.py, update database URI
app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://user:password@localhost/v3services'
```

#### JWT Configuration
```python
# Strong secret key for JWT tokens
JWT_SECRET_KEY = 'your-256-bit-secret-key'
JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=1)
```

#### CORS Configuration
```python
# Allow specific origins in production
CORS(app, origins=['https://your-dashboard-domain.com', 'https://your-mobile-domain.com'])
```

#### Scheduler Configuration
```python
# Weekly reminder schedule (Sundays at 6 PM)
scheduler.add_job(
    func=send_weekly_reminders,
    trigger="cron",
    day_of_week=6,  # Sunday
    hour=18,        # 6 PM
    minute=0,
    id='weekly_reminders'
)
```

### Frontend Configuration

#### API Base URL
Update the API base URL in both frontend applications:

```javascript
// In hooks/useAuth.jsx
const API_BASE_URL = process.env.VITE_API_BASE_URL || 'http://localhost:5000/api'
```

#### Build Configuration
```javascript
// vite.config.js
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',  // Allow external connections
    port: 5173
  },
  build: {
    outDir: 'dist',
    sourcemap: false  // Disable in production
  }
})
```

---

## Deployment

### Production Deployment Options

#### Option 1: Traditional Server Deployment

##### Backend Deployment
```bash
# Install production dependencies
pip install gunicorn supervisor

# Create systemd service
sudo nano /etc/systemd/system/v3-backend.service
```

```ini
[Unit]
Description=V3 Services Backend
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/path/to/v3-services-backend
Environment=PATH=/path/to/v3-services-backend/venv/bin
ExecStart=/path/to/v3-services-backend/venv/bin/gunicorn -w 4 -b 0.0.0.0:5000 src.main:app
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start service
sudo systemctl enable v3-backend
sudo systemctl start v3-backend
```

##### Frontend Deployment with Nginx
```bash
# Build frontend applications
cd v3-services-dashboard && npm run build
cd v3-services-mobile && npm run build

# Configure Nginx
sudo nano /etc/nginx/sites-available/v3-services
```

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Dashboard
    location / {
        root /path/to/v3-services-dashboard/dist;
        try_files $uri $uri/ /index.html;
    }

    # Mobile app
    location /mobile {
        alias /path/to/v3-services-mobile/dist;
        try_files $uri $uri/ /mobile/index.html;
    }

    # API proxy
    location /api {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

#### Option 2: Docker Deployment

##### Backend Dockerfile
```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY src/ ./src/
COPY v3_services.db ./

EXPOSE 5000
CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5000", "src.main:app"]
```

##### Frontend Dockerfile
```dockerfile
FROM node:20-alpine as build

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
```

##### Docker Compose
```yaml
version: '3.8'
services:
  backend:
    build: ./v3-services-backend
    ports:
      - "5000:5000"
    environment:
      - FLASK_ENV=production
    volumes:
      - ./data:/app/data

  dashboard:
    build: ./v3-services-dashboard
    ports:
      - "80:80"
    depends_on:
      - backend

  mobile:
    build: ./v3-services-mobile
    ports:
      - "8080:80"
    depends_on:
      - backend
```

#### Option 3: Cloud Deployment

##### Heroku Deployment
```bash
# Backend
cd v3-services-backend
echo "web: gunicorn src.main:app" > Procfile
git init && git add . && git commit -m "Initial commit"
heroku create v3-services-backend
heroku config:set JWT_SECRET_KEY=your-secret-key
git push heroku main

# Frontend (using static hosting)
cd v3-services-dashboard
npm run build
# Deploy dist/ folder to Netlify, Vercel, or similar
```

##### AWS Deployment
- **Backend**: Deploy to AWS Elastic Beanstalk or ECS
- **Frontend**: Deploy to AWS S3 + CloudFront
- **Database**: Use AWS RDS for PostgreSQL

---

## User Guides

### Admin User Guide

#### Getting Started
1. **Login**: Access the web dashboard at your domain
   - Default credentials: `admin@v3services.com` / `admin123`
   - Change default password immediately

2. **Dashboard Overview**
   - View today's jobs and available agents
   - Monitor pending responses and system status
   - Quick access to urgent actions

#### Managing Agents
1. **View Agents**: Navigate to "Agents" section
2. **Agent Status**: See real-time availability
3. **Agent Performance**: View response rates and statistics

#### Creating Jobs
1. **New Job**: Click "Create Job" button
2. **Fill Details**:
   - Job title and type
   - Complete address with postcode
   - Arrival time and date
   - Number of agents required
   - Urgency level (Low/Standard/URGENT)
   - Special instructions

3. **Job Assignment**: System automatically notifies available agents
4. **Monitor Responses**: Track agent responses in real-time
5. **Job Management**: Update status, cancel, or mark as completed

#### Analytics and Reporting
1. **Dashboard Metrics**: View key performance indicators
2. **Agent Analytics**: Monitor individual agent performance
3. **Job Statistics**: Track job completion rates
4. **Response Analysis**: Analyze response times by urgency

### Agent User Guide

#### Getting Started
1. **Download App**: Access mobile app at your provided URL
2. **Login**: Use credentials provided by admin
3. **Setup Profile**: Complete your profile information

#### Managing Availability
1. **Daily Toggle**: Quick availability toggle on dashboard
2. **Weekly Planning**: Set availability for next 14 days
3. **Add Notes**: Include special notes about availability
4. **Weekly Reminders**: Respond to Sunday evening reminders

#### Responding to Jobs
1. **Notifications**: Receive instant job notifications
2. **Job Details**: Review job information, location, and requirements
3. **Quick Response**: Accept or decline within the app
4. **Urgent Jobs**: Prioritized notifications for urgent assignments

#### Profile and Performance
1. **View Stats**: Check your acceptance rate and response time
2. **Update Profile**: Keep contact information current
3. **Notification Settings**: Manage notification preferences

---


## API Documentation

### Authentication Endpoints

#### POST /api/auth/login
Login user and receive JWT token.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "access_token": "jwt_token_here",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "role": "admin"
  }
}
```

#### POST /api/auth/logout
Logout user and blacklist token.

**Headers:** `Authorization: Bearer <token>`

#### GET /api/auth/me
Get current user information.

**Headers:** `Authorization: Bearer <token>`

### User Management Endpoints

#### GET /api/users
Get all users (admin only).

**Query Parameters:**
- `role`: Filter by role (admin/agent)

#### POST /api/users
Create new user (admin only).

**Request Body:**
```json
{
  "email": "agent@example.com",
  "password": "password123",
  "first_name": "Jane",
  "last_name": "Smith",
  "role": "agent",
  "phone": "+44 7700 900123"
}
```

#### PUT /api/users/{id}
Update user information.

#### DELETE /api/users/{id}
Delete user (admin only).

### Availability Endpoints

#### GET /api/availability/{agent_id}
Get agent availability.

**Query Parameters:**
- `start_date`: Start date (YYYY-MM-DD)
- `end_date`: End date (YYYY-MM-DD)

#### POST /api/availability
Set agent availability.

**Request Body:**
```json
{
  "agent_id": 1,
  "start_date": "2024-12-06",
  "end_date": "2024-12-06",
  "is_available": true,
  "notes": "Available all day"
}
```

#### POST /api/availability/toggle/{agent_id}
Quick toggle today's availability.

### Job Management Endpoints

#### GET /api/jobs
Get all jobs.

**Query Parameters:**
- `status`: Filter by status (open/filled/completed/cancelled)
- `urgency`: Filter by urgency level

#### POST /api/jobs
Create new job (admin only).

**Request Body:**
```json
{
  "title": "Security Guard - Shopping Center",
  "job_type": "Security",
  "address": "123 High Street, London, SW1A 1AA",
  "postcode": "SW1A 1AA",
  "arrival_time": "2024-12-06 14:00:00",
  "agents_required": 2,
  "lead_agent_name": "John Smith",
  "instructions": "Uniform required. Report to main entrance.",
  "urgency_level": "URGENT"
}
```

#### PUT /api/jobs/{id}
Update job information.

#### DELETE /api/jobs/{id}
Delete job (admin only).

### Assignment Endpoints

#### GET /api/assignments/agent/{agent_id}
Get agent's job assignments.

#### POST /api/assignments/{id}/respond
Agent responds to job assignment.

**Request Body:**
```json
{
  "response": "accept"  // or "decline"
}
```

### Notification Endpoints

#### GET /api/notifications
Get user notifications.

**Query Parameters:**
- `limit`: Number of notifications to return
- `unread_only`: Return only unread notifications

#### POST /api/notifications/{id}/read
Mark notification as read.

#### POST /api/notifications/mark-all-read
Mark all notifications as read.

#### DELETE /api/notifications/{id}
Delete notification.

### Analytics Endpoints

#### GET /api/analytics/dashboard
Get dashboard analytics (admin only).

**Response:**
```json
{
  "today": {
    "jobs_scheduled": 5,
    "filled_jobs": 3,
    "open_jobs": 2,
    "available_agents": 12
  },
  "this_week": {
    "total_jobs": 25,
    "completion_rate": 85
  },
  "pending_actions": {
    "open_jobs": 2,
    "pending_responses": 3
  }
}
```

#### GET /api/analytics/agents
Get agent performance analytics.

#### GET /api/analytics/jobs
Get job statistics.

#### GET /api/analytics/response-rates
Get response rate analytics.

### Weather Endpoints

#### GET /api/weather/forecast
Get weather forecast for location.

**Query Parameters:**
- `postcode`: UK postcode
- `lat`: Latitude (alternative to postcode)
- `lon`: Longitude (alternative to postcode)

---

## Troubleshooting

### Common Issues

#### Backend Issues

**Issue: Database connection errors**
```
Solution:
1. Check database file permissions
2. Verify SQLite installation
3. Check database path in configuration
4. Ensure database is initialized
```

**Issue: JWT token errors**
```
Solution:
1. Verify JWT_SECRET_KEY is set
2. Check token expiration settings
3. Clear browser localStorage
4. Restart backend server
```

**Issue: CORS errors**
```
Solution:
1. Verify CORS configuration in main.py
2. Check frontend API base URL
3. Ensure backend allows frontend origin
4. Test with browser dev tools
```

#### Frontend Issues

**Issue: API connection failed**
```
Solution:
1. Check API base URL in .env file
2. Verify backend server is running
3. Test API endpoints directly
4. Check browser network tab for errors
```

**Issue: Build failures**
```
Solution:
1. Clear node_modules and reinstall
2. Check Node.js version compatibility
3. Verify all dependencies are installed
4. Check for TypeScript errors
```

**Issue: Authentication not working**
```
Solution:
1. Clear browser localStorage
2. Check JWT token format
3. Verify API endpoints
4. Test with different browser
```

### Debugging

#### Backend Debugging
```bash
# Enable debug mode
export FLASK_DEBUG=True
python src/main.py

# Check logs
tail -f logs/app.log

# Database inspection
sqlite3 v3_services.db
.tables
.schema users
```

#### Frontend Debugging
```bash
# Check console errors
# Open browser dev tools -> Console

# Network debugging
# Open browser dev tools -> Network

# Local storage inspection
# Application -> Local Storage
```

### Performance Issues

#### Database Performance
```sql
-- Add indexes for better performance
CREATE INDEX idx_availability_agent_date ON availability(agent_id, date);
CREATE INDEX idx_assignments_agent ON assignments(agent_id);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
```

#### API Performance
```python
# Enable response caching
from flask_caching import Cache
cache = Cache(app, config={'CACHE_TYPE': 'simple'})

@cache.cached(timeout=300)
def get_dashboard_data():
    # Cached for 5 minutes
    pass
```

---

## Maintenance

### Regular Maintenance Tasks

#### Daily Tasks
- Monitor system logs for errors
- Check database size and performance
- Verify notification delivery
- Monitor API response times

#### Weekly Tasks
- Review agent performance metrics
- Check job completion rates
- Update system dependencies
- Backup database

#### Monthly Tasks
- Security audit and updates
- Performance optimization
- User feedback review
- System capacity planning

### Database Maintenance

#### Backup Procedures
```bash
# SQLite backup
cp v3_services.db v3_services_backup_$(date +%Y%m%d).db

# PostgreSQL backup
pg_dump v3services > v3services_backup_$(date +%Y%m%d).sql
```

#### Data Cleanup
```sql
-- Remove old notifications (older than 30 days)
DELETE FROM notifications WHERE created_at < datetime('now', '-30 days');

-- Remove old blacklisted tokens
DELETE FROM token_blacklist WHERE created_at < datetime('now', '-7 days');

-- Archive completed jobs (older than 90 days)
-- Consider moving to archive table instead of deleting
```

### Security Maintenance

#### Regular Security Tasks
- Update all dependencies
- Review user access permissions
- Monitor failed login attempts
- Check for security vulnerabilities

#### Security Checklist
- [ ] JWT secret key is strong and unique
- [ ] HTTPS enabled in production
- [ ] Database access is restricted
- [ ] API rate limiting is configured
- [ ] Input validation is comprehensive
- [ ] Error messages don't leak sensitive information

### Monitoring and Alerts

#### Key Metrics to Monitor
- API response times
- Database query performance
- User authentication success rate
- Job assignment response rate
- System resource usage

#### Alert Thresholds
- API response time > 2 seconds
- Database connection failures
- High error rates (>5%)
- Low agent response rates (<70%)
- System resource usage >80%

### Scaling Considerations

#### Horizontal Scaling
- Load balancer for multiple backend instances
- Database read replicas
- CDN for frontend assets
- Microservices architecture

#### Vertical Scaling
- Increase server resources
- Database optimization
- Caching implementation
- Code optimization

---

## Support and Contact

### Technical Support
- **Documentation**: This guide and inline code comments
- **Issue Tracking**: Use project repository issues
- **Emergency Contact**: System administrator

### System Information
- **Version**: 1.0.0
- **Last Updated**: December 2024
- **License**: Proprietary - V3 Services Ltd
- **Support Level**: Full system support included

### Change Management
- All changes should be tested in staging environment
- Database changes require backup before execution
- Frontend changes should be tested across browsers
- API changes require version compatibility checks

---

*This completes the comprehensive deployment and user guide for the V3 Services Field Agent Deployment System. For additional support or questions, please contact the system administrator.*

