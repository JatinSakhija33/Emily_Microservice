# Emily - Digital Marketing Agent

Emily is an AI-powered digital marketing agent built with modern web technologies. This repository contains the complete implementation of Emily, including frontend, backend, and database schemas.

*Last updated: January 2026*

## 🚀 Tech Stack

- **Frontend**: React + Vite + Tailwind CSS (deployed on Vercel)
- **Backend**: Python + FastAPI + LangGraph (deployed on Render)
- **Database**: Supabase (PostgreSQL)
- **AI Framework**: LangGraph (latest version)
- **LLM**: OpenAI for content generation
- **Authentication**: Supabase Auth
- **Scheduling**: APScheduler for background tasks

## 📁 Project Structure

```
Emily1.0/
├── frontend/                    # React + Vite frontend
│   ├── src/
│   │   ├── components/          # React components
│   │   │   ├── ContentDashboard.jsx
│   │   │   ├── ContentCalendar.jsx
│   │   │   ├── Login.jsx
│   │   │   ├── Onboarding.jsx
│   │   │   └── Dashboard.jsx
│   │   ├── contexts/            # React contexts (Auth)
│   │   ├── services/            # API services
│   │   └── lib/                 # Utilities
│   ├── dist/                    # Production build
│   ├── package.json
│   └── vite.config.js
├── backend/                     # FastAPI backend
│   ├── agents/                  # AI agents
│   │   └── content_creation_agent.py
│   ├── scheduler/               # Background scheduling
│   │   ├── content_scheduler.py
│   │   └── background_scheduler.py
│   ├── main.py                  # FastAPI application
│   ├── requirements.txt         # Python dependencies
│   └── Procfile                 # Render deployment config
├── database/                    # Database schema and files
│   ├── schema.sql              # User profiles and onboarding
│   ├── content_creation_schema.sql  # Content campaigns and posts
│   └── README.md               # Database documentation
├── .gitignore                  # Git ignore rules
├── vercel.json                 # Vercel deployment config
└── PRODUCTION_DEPLOYMENT.md    # Production deployment guide
```

## ✨ Features

### 🔐 Authentication & User Management
- ✅ Supabase Auth integration
- ✅ User registration and login
- ✅ JWT token validation
- ✅ Protected routes
- ✅ User onboarding flow

### 🤖 AI Content Generation
- ✅ LangGraph-based content creation agent
- ✅ Multi-platform content generation (Facebook, Instagram, LinkedIn, YouTube, Twitter/X)
- ✅ AI-generated images with DALL-E
- ✅ Weekly automated content scheduling
- ✅ Real-time progress tracking with Server-Sent Events

### 📊 Content Management
- ✅ Content dashboard with beautiful cards
- ✅ Monthly content calendar view
- ✅ Content replacement (one week at a time)
- ✅ Platform-specific content optimization
- ✅ Hashtag and metadata management

### ⏰ Scheduling & Automation
- ✅ Background scheduler (every Sunday at 4 AM IST)
- ✅ Manual content generation triggers
- ✅ Cloud-deployment friendly (no external cron jobs)
- ✅ Duplicate run prevention

### 🎨 User Interface
- ✅ Modern, responsive design with Tailwind CSS
- ✅ Beautiful gradient cards and animations
- ✅ Mobile-friendly interface
- ✅ Error boundaries and loading states
- ✅ Real-time progress indicators

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Python 3.8+
- Supabase account
- OpenAI API key

### 1. Clone the Repository
```bash
git clone https://github.com/Theathiestmonk/Agent_Emily.git
cd Agent_Emily
```

### 2. Frontend Setup
```bash
cd frontend
npm install
cp env.example .env.local
# Update .env.local with your Supabase credentials
npm run dev
```

### 3. Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cp env.example .env
# Update .env with your credentials
uvicorn main:app --reload
```

### 4. Database Setup
1. Create a Supabase project
2. Run SQL scripts from `database/` folder
3. Update environment variables

## 🌐 Production Deployment

### Frontend (Vercel)
1. Connect GitHub repository to Vercel
2. Set environment variables:
   - `VITE_API_URL`: Your Render backend URL
   - `VITE_SUPABASE_URL`: Your Supabase URL
   - `VITE_SUPABASE_ANON_KEY`: Your Supabase anon key
3. Deploy

### Backend (Render)
1. Connect GitHub repository to Render
2. Set root directory to `backend`
3. Set environment variables:
   - `SUPABASE_URL`: Your Supabase URL
   - `SUPABASE_SERVICE_ROLE_KEY`: Your service role key
   - `OPENAI_API_KEY`: Your OpenAI API key
   - `ENVIRONMENT`: production
4. Deploy

## 📚 Documentation

- [Production Deployment Guide](PRODUCTION_DEPLOYMENT.md)
- [Database Schema](database/README.md)
- [Background Scheduler](backend/BACKGROUND_SCHEDULER.md)

## 🔧 Development

### Running Tests
```bash
# Frontend
cd frontend
npm run lint

# Backend
cd backend
python -m pytest
```

### Building for Production
```bash
# Run the production build script
chmod +x build-production.sh
./build-production.sh
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

For issues and questions:
1. Check the documentation
2. Review the troubleshooting guide
3. Create an issue on GitHub

---

**Emily Digital Marketing Agent** - Built with ❤️ using modern web technologies
