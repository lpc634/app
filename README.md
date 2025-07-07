# V3 Services Field Agent Deployment System

A comprehensive solution for rapid deployment of field agents for urgent jobs, featuring real-time notifications, availability management, and administrative oversight.

## 🚀 Quick Start

### System Components
- **Backend API**: Flask-based REST API with SQLite database
- **Web Dashboard**: React admin interface for job and agent management  
- **Mobile App**: React mobile application for field agents

### Prerequisites
- Python 3.11+
- Node.js 20+
- npm or pnpm

### Installation

1. **Backend Setup**
```bash
cd v3-services-backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python src/main.py  # Starts server and creates default admin
```

2. **Web Dashboard**
```bash
cd v3-services-dashboard
npm install
npm run dev  # Starts on http://localhost:5174
```

3. **Mobile App**
```bash
cd v3-services-mobile
npm install  
npm run dev  # Starts on http://localhost:5175
```

### Default Login
- **Admin Dashboard**: `admin@v3services.com` / `admin123`
- **Agent Mobile**: Create agent accounts via admin dashboard

## 📋 Features

### For Administrators
- **Job Management**: Create and assign urgent jobs to available agents
- **Agent Oversight**: Monitor agent availability and performance
- **Real-time Dashboard**: Track job status and system metrics
- **Analytics**: Comprehensive reporting on agent performance and job completion
- **Weather Integration**: Automatic weather forecasts for job locations

### For Field Agents  
- **Availability Management**: Set daily/weekly availability with notes
- **Job Notifications**: Instant notifications for new job assignments
- **Quick Response**: Accept or decline jobs with one tap
- **Performance Tracking**: View personal statistics and response rates
- **Weekly Reminders**: Automated availability update reminders

### System Features
- **Real-time Notifications**: Instant job assignment alerts
- **Urgent Job Prioritization**: Special handling for urgent assignments
- **Role-based Access**: Secure admin and agent interfaces
- **Mobile-first Design**: Optimized for field agent mobile usage
- **Automated Scheduling**: Weekly availability reminder system

## 🏗️ Architecture

```
Web Dashboard (Admin) ←→ Backend API ←→ Mobile App (Agents)
                            ↓
                       SQLite Database
                            ↓
                    External APIs (Weather, FCM)
```

### Technology Stack
- **Backend**: Python Flask, SQLite, JWT, APScheduler
- **Frontend**: React, Tailwind CSS, shadcn/ui, Recharts
- **Notifications**: Firebase Cloud Messaging ready
- **Weather**: OpenWeatherMap API integration

## 📱 Screenshots

### Admin Dashboard
- Real-time job and agent overview
- Job creation and management interface
- Analytics and performance metrics
- Agent availability monitoring

### Mobile App
- Agent dashboard with availability toggle
- Job assignment notifications
- Quick accept/decline interface
- Personal performance statistics

## 🔧 Configuration

### Environment Variables

**Backend (.env)**
```env
JWT_SECRET_KEY=your-secret-key
OPENWEATHER_API_KEY=your-weather-api-key
FCM_SERVER_KEY=your-fcm-key
```

**Frontend (.env)**
```env
VITE_API_BASE_URL=http://localhost:5000/api
```

## 🚀 Deployment

### Development
```bash
# Start all services
./start-dev.sh  # If available, or start each component manually
```

### Production
- **Docker**: Use provided Dockerfiles and docker-compose.yml
- **Traditional**: Deploy with Nginx + Gunicorn
- **Cloud**: Deploy to Heroku, AWS, or similar platforms

See [Deployment Guide](deployment_guide.md) for detailed instructions.

## 📖 Documentation

- **[Complete Deployment Guide](deployment_guide.md)**: Comprehensive setup and deployment instructions
- **[Technical Architecture](technical_architecture.md)**: Detailed system architecture and design decisions
- **[Integration Test Plan](integration_test_plan.md)**: Testing procedures and quality assurance
- **[API Documentation](deployment_guide.md#api-documentation)**: Complete REST API reference

## 🧪 Testing

### Run Integration Tests
```bash
python3 integration_test.py
```

### Test Coverage
- Authentication and authorization
- Job creation and assignment workflow
- Agent availability management
- Notification system
- Analytics and reporting

## 🔒 Security Features

- JWT-based authentication
- Role-based access control (Admin/Agent)
- Password hashing with bcrypt
- CORS configuration for secure API access
- Input validation and sanitization
- Token blacklisting for secure logout

## 📊 Key Metrics

The system tracks and displays:
- Agent response rates and times
- Job completion statistics
- System performance metrics
- Availability patterns
- Urgent job handling efficiency

## 🛠️ Development

### Project Structure
```
v3-services-backend/          # Flask API backend
├── src/
│   ├── main.py              # Main application
│   ├── models/              # Database models
│   └── routes/              # API endpoints
├── requirements.txt         # Python dependencies
└── v3_services.db          # SQLite database

v3-services-dashboard/        # React admin dashboard
├── src/
│   ├── components/          # React components
│   ├── hooks/              # Custom hooks
│   └── App.jsx             # Main app component
└── package.json            # Node dependencies

v3-services-mobile/          # React mobile app
├── src/
│   ├── components/          # Mobile components
│   ├── hooks/              # Shared hooks
│   └── App.jsx             # Mobile app root
└── package.json            # Node dependencies
```

### Adding Features
1. **Backend**: Add routes in `src/routes/`, models in `src/models/`
2. **Frontend**: Add components in `src/components/`, update routing in `App.jsx`
3. **Database**: Update models and run migrations
4. **Tests**: Add test cases to integration test suite

## 🤝 Contributing

1. Follow existing code style and patterns
2. Add tests for new features
3. Update documentation for API changes
4. Test across all components before submitting

## 📞 Support

- **Technical Issues**: Check troubleshooting section in deployment guide
- **Feature Requests**: Submit via project repository
- **Emergency Support**: Contact system administrator

## 📄 License

Proprietary - V3 Services Ltd. All rights reserved.

---

**Built for V3 Services Ltd** - Enabling rapid field agent deployment for urgent situations.

