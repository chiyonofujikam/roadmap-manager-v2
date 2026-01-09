# Roadmap Management System

A web-based time tracking and project management application with role-based access control. The system allows collaborators to fill daily time entries, responsibles to manage teams and validate entries, and admins to perform system-wide operations.

## 🚀 Quick Start

### Option 1: Run Everything with Docker (Recommended for Quick Testing)

Start the entire application stack (MongoDB + Backend + Frontend) with one command:

```bash
docker-compose -f docker-compose_mock.yml up -d
# or with rebuild
docker-compose -f docker-compose_mock.yml up -d --build
```

This will start:
- **MongoDB** on port `27017`
- **Backend API** on port `8000`
- **Frontend** on port `5173`

Access the application at: **http://localhost:5173**

**View Logs:**
```bash
docker-compose -f docker-compose_mock.yml logs -f
```

**Stop Services:**
```bash
docker-compose -f docker-compose_mock.yml down
```

### Option 2: Local Development (Recommended for Active Development)

For faster development without Docker rebuilds, use local development setup.

#### Quick Start with Script (Windows)

Double-click `start-local.bat` or run:
```bash
start-local.bat
```

The script will:
- Start MongoDB in Docker (if not running)
- Install dependencies
- Initialize database and seed data
- Open backend (port 8000) and frontend (port 5173) in separate windows

#### Manual Local Setup

**1. Start MongoDB:**
```bash
docker run -d --name roadmap_mongodb -p 27017:27017 mongo:6.0
```

**2. Backend Setup:**
```bash
cd rm_be
uv sync
uv run python -m rm_be.database.init_db
uv run python -m rm_be.scripts.seed_users
uv run python -m rm_be.scripts.seed_lc_data
uv run uvicorn rm_be.main:app --reload
```

**3. Frontend Setup** (in a new terminal):
```bash
cd rm_fe
npm install
npm run dev
```

## 📁 Project Structure

```
roadmap-manager-v2/
├── rm_be/                      # FastAPI Backend
│   ├── rm_be/                  # Application code
│   │   ├── api/                # API routes and schemas
│   │   ├── core/               # Core security and utilities
│   │   ├── database/           # Database models and repositories
│   │   ├── scripts/            # Database seeding scripts
│   │   └── main.py             # FastAPI application entry point
│   ├── mockusers.json          # Mock user data
│   ├── Dockerfile              # Backend container
│   └── pyproject.toml          # Python dependencies
├── rm_fe/                      # React Frontend
│   ├── src/                    # Application code
│   │   ├── components/         # React components
│   │   ├── contexts/           # React contexts
│   │   ├── hooks/              # Custom hooks
│   │   └── lib/                # API and utility libraries
│   ├── Dockerfile              # Frontend container
│   └── package.json            # Node dependencies
├── docker-compose_mock.yml     # Full stack Docker setup
├── start-local.bat             # Windows local development script
└── README.md                   # This file
```

## 🎯 Features

- **Role-Based Access Control**: Three user types (Collaborator, Responsible, Admin)
- **Time Tracking (Pointage)**: Weekly calendar interface for daily time entries
- **Conditional Lists (LC)**: Reference data management
- **Validation Workflow**: Draft → Submitted → Validated/Rejected
- **Background Jobs**: Asynchronous processing for bulk operations
- **Audit Trail**: Complete logging of all operations
- **Excel Import/Export**: Support for Excel file operations

## 👥 User Roles

### Collaborator
- Fill daily pointage entries
- View own entries
- Submit entries for validation

### Responsible
- Manage team members
- Validate/reject pointage entries
- Manage Conditional Lists (LC)
- View team pointage data
- Archive or Modify Weekly Time Entries of its team


### Admin
- All Responsible permissions
- Bulk data import
- System cleanup operations
- Full system management
- Update Conditional Lists (LC)
- Add/remove Users
- Archive or Modify Weekly Time Entries

## 🛠️ Technology Stack

**Backend:**
- FastAPI (Python)
- MongoDB
- Keycloak (Authentication)
- Celery (Background jobs)
- uv (Python package manager)

**Frontend:**
- React.js
- Vite
- Tailwind CSS

## 🔐 Authentication

The system supports two authentication modes:

1. **Mock Authentication** (Development/Testing)
   - Use email as Bearer token
   - Test users: `admin@example.com`, `responsible@example.com`, `collaborator1@example.com`

2. **Keycloak Authentication** (Production)
   - Full OAuth2/OIDC integration
   - JWT token-based authentication

## ⚙️ Environment Variables

### Backend (`rm_be/.env`)

```env
MONGODB_URI=mongodb://localhost:27017/roadmap_db_dev
MONGODB_DB_NAME=roadmap_db_dev
USE_MOCK_AUTH=true
DEBUG=true
MOCK_USERS_FILE=mockusers.json
```

### Frontend (`rm_fe/.env`)

```env
VITE_API_BASE_URL=http://localhost:8000
```

**What is `VITE_API_BASE_URL` used for?**

This environment variable configures the base URL for all API calls from the frontend to the backend. It's used by the frontend API client (`rm_fe/src/lib/api.js`) to construct the full URL for all HTTP requests.

- **Default**: If not set, it defaults to `http://localhost:8000`
- **Purpose**: Allows you to configure different backend URLs for different environments (development, staging, production)
- **Usage**: All API requests are prefixed with this URL (e.g., `${VITE_API_BASE_URL}/auth/me` becomes `http://localhost:8000/auth/me`)

**When to change it:**
- Backend runs on a different port (e.g., `http://localhost:8001`)
- Backend is hosted on a different domain (e.g., `https://api.example.com`)
- Different environments need different backend URLs

## 🐳 Docker Services

The `docker-compose_mock.yml` includes:

- **mongodb**: MongoDB 6.0 database
- **backend**: FastAPI application with mock authentication
- **frontend**: React development server

All services are configured with mock authentication for easy testing.

## 🔧 Troubleshooting

### MongoDB not running

```bash
docker start roadmap_mongodb
```

### Port in use

- **Backend**: Change port in uvicorn command: `uvicorn rm_be.main:app --reload --port 8001`
- **Frontend**: Change port in `vite.config.js` or use `npm run dev -- --port 5174`

### Reinstall dependencies

**Backend:**
```bash
cd rm_be
uv sync
```

**Frontend:**
```bash
cd rm_fe
rm -rf node_modules
npm install
```

### Database reset

To reset the database and reseed data:

```bash
cd rm_be
uv run python -m rm_be.database.init_db
uv run python -m rm_be.scripts.seed_users
uv run python -m rm_be.scripts.seed_lc_data
```

## 🚦 Development Workflow

1. **Start MongoDB** (if using local development)
2. **Start Backend** - API will be available at `http://localhost:8000`
3. **Start Frontend** - UI will be available at `http://localhost:5173`
4. **Access Swagger UI** - API documentation at `http://localhost:8000/docs`

## 📝 Notes

- The backend uses `uv` for Python package management
- Mock authentication is enabled by default for development
- All test users are seeded automatically when running `seed_users` script
- The frontend hot-reloads automatically on code changes
- Backend auto-reloads when using `--reload` flag with uvicorn
