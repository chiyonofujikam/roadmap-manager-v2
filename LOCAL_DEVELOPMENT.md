# Local Development Guide

## Quick Start

### Using the Startup Script (Windows)

Double-click `start-local.bat` or run:
```bash
start-local.bat
```

The script will:
- Start MongoDB in Docker (if not running)
- Install dependencies
- Initialize database and seed data
- Open backend (port 8000) and frontend (port 5173) in separate windows

### Manual Setup

**1. Start MongoDB:**
```bash
docker run -d --name roadmap_mongodb -p 27017:27017 mongo:6.0
```

**2. Backend:**
```bash
cd rm_be
uv sync
uv run python -m rm_be.database.init_db
uv run python -m rm_be.scripts.seed_users
uv run python -m rm_be.scripts.seed_lc_data
uv run uvicorn rm_be.main:app --reload
```

**3. Frontend:**
```bash
cd rm_fe
npm install && npm run dev
```

## Environment Variables

**Backend (`rm_be/.env`):**
```env
MONGODB_URI=mongodb://localhost:27017/roadmap_db_dev
MONGODB_DB_NAME=roadmap_db_dev
USE_MOCK_AUTH=true
DEBUG=true
MOCK_USERS_FILE=mockusers.json
```

**Frontend (`rm_fe/.env`):**
```env
VITE_API_BASE_URL=http://localhost:8000
```

## Mock Users

- `admin@example.com` - Admin
- `responsible@example.com` - Responsible
- `collaborator1@example.com` - Collaborator

## Troubleshooting

**MongoDB not running:**
```bash
docker start roadmap_mongodb
```

**Port in use:**
- Backend: Change port in uvicorn command
- Frontend: Change port in `vite.config.js`

**Reinstall dependencies:**
```bash
# Backend
cd rm_be && uv sync

# Frontend
cd rm_fe && rm -rf node_modules && npm install
```
