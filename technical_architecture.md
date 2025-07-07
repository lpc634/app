# V3 Services Field Agent Deployment System - Technical Architecture

## Executive Summary

This document outlines the technical architecture for V3 Services Ltd's field agent deployment system. The system consists of a mobile app for field agents, a web dashboard for administrators, and a backend API with push notification capabilities.

## System Overview

The system enables rapid deployment of field agents for urgent jobs through:
- **Mobile App**: Agent availability management and job notifications
- **Web Dashboard**: Admin job creation and agent management
- **Backend API**: Data management, notifications, and business logic
- **External Integrations**: Weather API and push notification services

## Technology Stack

### Backend
- **Framework**: Flask (Python)
  - Rationale: Fast development, excellent ecosystem, good for MVP
  - Lightweight and flexible for rapid prototyping
  - Strong support for REST APIs and real-time features

- **Database**: SQLite (development) / PostgreSQL (production)
  - SQLite for rapid MVP development and testing
  - PostgreSQL for production scalability

- **Authentication**: JWT (JSON Web Tokens)
  - Stateless authentication suitable for mobile apps
  - Secure and scalable

- **Push Notifications**: Firebase Cloud Messaging (FCM)
  - Cross-platform support (iOS/Android)
  - Reliable delivery and free tier

- **Task Scheduling**: APScheduler
  - Python-native scheduling for weekly reminders
  - Persistent job storage

### Frontend - Web Dashboard
- **Framework**: React
  - Component-based architecture
  - Rich ecosystem and rapid development
  - Excellent for admin dashboards

- **UI Library**: Material-UI (MUI)
  - Professional appearance
  - Responsive design out of the box
  - Comprehensive component library

- **State Management**: React Context + Hooks
  - Sufficient for MVP complexity
  - No additional dependencies

### Mobile App
- **Framework**: React Native
  - Cross-platform development (iOS/Android)
  - Code reuse with web dashboard
  - Native performance and features

- **Navigation**: React Navigation
  - Standard navigation solution
  - Deep linking support

- **Push Notifications**: React Native Firebase
  - Native push notification handling
  - Background processing capabilities

### External Services
- **Weather API**: OpenWeatherMap API
  - Reliable UK weather data
  - Free tier available
  - Postcode/location-based forecasts

## System Architecture

```
┌─────────────────┐    ┌─────────────────┐
│   Mobile App    │    │  Web Dashboard  │
│  (React Native) │    │     (React)     │
└─────────┬───────┘    └─────────┬───────┘
          │                      │
          │      HTTPS/REST      │
          │                      │
    ┌─────┴──────────────────────┴─────┐
    │         Backend API              │
    │         (Flask)                  │
    │                                  │
    │  ┌─────────┐  ┌─────────────┐   │
    │  │Database │  │  Scheduler  │   │
    │  │(SQLite) │  │(APScheduler)│   │
    │  └─────────┘  └─────────────┘   │
    └─────┬────────────────────────────┘
          │
    ┌─────┴─────┐
    │ External  │
    │ Services  │
    │           │
    │ • FCM     │
    │ • Weather │
    └───────────┘
```

## Database Schema

### Users Table
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL, -- 'agent' or 'admin'
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(20),
    fcm_token VARCHAR(255), -- For push notifications
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Agent Availability Table
```sql
CREATE TABLE agent_availability (
    id INTEGER PRIMARY KEY,
    agent_id INTEGER REFERENCES users(id),
    date DATE NOT NULL,
    is_available BOOLEAN DEFAULT FALSE,
    is_away BOOLEAN DEFAULT FALSE, -- For holiday periods
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(agent_id, date)
);
```

### Jobs Table
```sql
CREATE TABLE jobs (
    id INTEGER PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    job_type VARCHAR(100) NOT NULL,
    address TEXT NOT NULL,
    postcode VARCHAR(10),
    arrival_time TIMESTAMP NOT NULL,
    agents_required INTEGER NOT NULL,
    lead_agent_name VARCHAR(255),
    instructions TEXT,
    urgency_level VARCHAR(20) DEFAULT 'Standard', -- 'Low', 'Standard', 'URGENT'
    status VARCHAR(50) DEFAULT 'open', -- 'open', 'filled', 'completed', 'cancelled'
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Job Assignments Table
```sql
CREATE TABLE job_assignments (
    id INTEGER PRIMARY KEY,
    job_id INTEGER REFERENCES jobs(id),
    agent_id INTEGER REFERENCES users(id),
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'accepted', 'declined'
    response_time TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(job_id, agent_id)
);
```

### Notifications Table
```sql
CREATE TABLE notifications (
    id INTEGER PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50), -- 'job_offer', 'job_confirmation', 'reminder', 'job_filled'
    job_id INTEGER REFERENCES jobs(id),
    is_read BOOLEAN DEFAULT FALSE,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## API Endpoints Structure

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/refresh` - Refresh JWT token

### Agent Management
- `GET /api/agents` - List all agents (admin only)
- `GET /api/agents/{id}` - Get agent details
- `PUT /api/agents/{id}` - Update agent profile
- `POST /api/agents/{id}/fcm-token` - Update FCM token

### Availability Management
- `GET /api/availability/{agent_id}` - Get agent availability
- `POST /api/availability` - Set availability for date range
- `PUT /api/availability/{id}` - Update specific availability
- `DELETE /api/availability/{id}` - Remove availability

### Job Management
- `GET /api/jobs` - List jobs (filtered by role)
- `POST /api/jobs` - Create new job (admin only)
- `GET /api/jobs/{id}` - Get job details
- `PUT /api/jobs/{id}` - Update job (admin only)
- `DELETE /api/jobs/{id}` - Cancel job (admin only)

### Job Assignments
- `POST /api/jobs/{id}/assign` - Assign job to agents
- `POST /api/jobs/{id}/respond` - Agent response (accept/decline)
- `GET /api/assignments/agent/{id}` - Get agent's assignments

### Notifications
- `GET /api/notifications` - Get user notifications
- `PUT /api/notifications/{id}/read` - Mark notification as read
- `POST /api/notifications/send` - Send push notification

### Weather Integration
- `GET /api/weather/{postcode}` - Get weather forecast for location

### Dashboard Analytics
- `GET /api/analytics/agents` - Agent performance metrics
- `GET /api/analytics/jobs` - Job statistics
- `GET /api/analytics/response-rates` - Response rate analytics

## Mobile App User Flow

### Agent Availability Management
1. Agent opens app and logs in
2. Views current availability status
3. Can toggle daily availability or set weekly schedule
4. Can set "Away" periods for holidays
5. Receives weekly reminder notifications

### Job Notification Flow
1. Admin creates job in web dashboard
2. System identifies available agents for job date
3. Push notification sent to eligible agents
4. Agent receives notification with job details and weather
5. Agent accepts or declines job
6. If accepted, receives confirmation with full details
7. Agent automatically marked unavailable for rest of day

## Web Dashboard User Flow

### Job Creation and Management
1. Admin logs into web dashboard
2. Views agent availability calendar
3. Creates new job with all required details
4. System sends notifications to eligible agents
5. Admin monitors real-time responses
6. When job filled, system notifies all agents
7. Admin can view job history and export data

### Agent Management
1. Admin views live agent availability
2. Can see weekly schedules and away periods
3. Views agent performance metrics
4. Can export data for reporting

## Security Considerations

### Authentication & Authorization
- JWT tokens with expiration
- Role-based access control (agent vs admin)
- Secure password hashing (bcrypt)
- HTTPS enforcement

### Data Protection
- Input validation and sanitization
- SQL injection prevention (parameterized queries)
- Rate limiting on API endpoints
- Secure FCM token handling

### Mobile App Security
- Secure token storage (Keychain/Keystore)
- Certificate pinning for API calls
- Biometric authentication option

## Performance Considerations

### Database Optimization
- Indexes on frequently queried fields
- Efficient queries for availability lookups
- Connection pooling

### Caching Strategy
- Redis for session storage (future enhancement)
- Client-side caching for static data
- API response caching where appropriate

### Push Notification Optimization
- Batch notifications where possible
- Retry logic for failed deliveries
- Notification deduplication

## Deployment Strategy

### Development Environment
- Local development with SQLite
- Docker containers for consistency
- Environment-specific configuration

### Production Deployment
- Cloud hosting (AWS/DigitalOcean)
- PostgreSQL database
- Load balancer for high availability
- Automated backups

### Mobile App Distribution
- Internal testing via TestFlight (iOS) and Firebase App Distribution (Android)
- Future: App Store/Play Store distribution

## Monitoring and Logging

### Application Monitoring
- Error tracking and alerting
- Performance monitoring
- Push notification delivery tracking

### Business Metrics
- Agent response rates
- Job fill rates
- System usage analytics

## Future Enhancements

### Phase 2 Features
- GPS tracking for travel time estimates
- In-app messaging between agents and admins
- Photo uploads for job completion
- Integration with payroll systems

### Scalability Improvements
- Microservices architecture
- Redis caching layer
- CDN for static assets
- Database sharding

This architecture provides a solid foundation for the MVP while allowing for future growth and enhancement of the V3 Services field agent deployment system.

