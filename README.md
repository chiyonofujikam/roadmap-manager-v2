# Roadmap Management System

A web-based time tracking and project management application with role-based access control. The system allows collaborators to fill daily time entries, responsibles to manage teams and validate entries, and admins to perform system-wide operations.

## 🚀 Quick Start

### Run Everything with Docker (Recommended)

Start the entire application stack (MongoDB + Backend + Frontend) with one command:

```bash
docker-compose -f docker-compose_mock.yml up -d
or 
docker-compose -f docker-compose_mock.yml up -d --build
```

This will start:
- **MongoDB** on port `27017`
- **Backend API** on port `8000`
- **Frontend** on port `5173`

Access the application at: **http://localhost:5173**

### View Logs

```bash
docker-compose -f docker-compose_mock.yml logs -f
```

### Stop Services

```bash
docker-compose -f docker-compose_mock.yml down
```

## 📁 Project Structure

```
roadmap_manager_v2/
├── rm_be/              # FastAPI Backend
│   ├── rm_be/          # Application code
│   ├── README.md       # Backend documentation
│   └── Dockerfile      # Backend container
├── rm_fe/              # React Frontend
│   ├── src/            # Application code
│   ├── README.md       # Frontend documentation
│   └── Dockerfile      # Frontend container
├── docker-compose_mock.yml  # Full stack Docker setup
└── GANTT.md            # Project timeline and planning
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

### Admin
- All Responsible permissions
- Bulk data import
- System cleanup operations
- Full system management

## 🛠️ Technology Stack

**Backend:**
- FastAPI (Python)
- MongoDB
- Keycloak (Authentication)
- Celery (Background jobs)

**Frontend:**
- React
- Vite
- Tailwind CSS

## 📚 Documentation

- **Backend**: See [rm_be/README.md](./rm_be/README.md)
- **Frontend**: See [rm_fe/README.md](./rm_fe/README.md)
- **Project Planning**: See [GANTT.md](./GANTT.md)

## 🔐 Authentication

The system supports two authentication modes:

1. **Mock Authentication** (Development/Testing)
   - Use email as Bearer token
   - Test users: `admin@example.com`, `responsible@example.com`, `collaborator1@example.com`

2. **Keycloak Authentication** (Production)
   - Full OAuth2/OIDC integration
   - JWT token-based authentication

## 🧪 Testing

### Mock Users

Available test users (use email as token):
- `admin@example.com` - Admin user
- `responsible@example.com` - Responsible user
- `collaborator1@example.com` - Collaborator user
- `collaborator2@example.com` - Collaborator user
- `collaborator3@example.com` - Collaborator user

### Test Backend API

```bash
# Get current user
curl -H "Authorization: Bearer admin@example.com" http://localhost:8000/auth/me

# Test admin endpoint
curl -H "Authorization: Bearer admin@example.com" http://localhost:8000/auth/admin
```

## 📦 Development Setup

### Local Development (Recommended for Development)

For faster development without Docker rebuilds, see **[LOCAL_DEVELOPMENT.md](./LOCAL_DEVELOPMENT.md)** for detailed instructions.

**Quick Start (Local):**

**Windows:**
```bash
start-local.bat
```

**Manual Setup:**

1. **Start MongoDB** (Docker or local):
   ```bash
   docker run -d --name roadmap_mongodb -p 27017:27017 mongo:6.0
   ```

2. **Backend:**
   ```bash
   cd rm_be
   uv sync
   uv run python -m rm_be.database.init_db
   uv run python -m rm_be.scripts.seed_lc_data
   uv run uvicorn rm_be.main:app --reload
   ```

3. **Frontend** (new terminal):
   ```bash
   cd rm_fe
   npm install
   npm run dev
   ```

See [LOCAL_DEVELOPMENT.md](./LOCAL_DEVELOPMENT.md) for complete setup instructions.

## 🐳 Docker Services

The `docker-compose_mock.yml` includes:

- **mongodb**: MongoDB 6.0 database
- **backend**: FastAPI application with mock authentication
- **frontend**: React development server

All services are configured with mock authentication for easy testing.

## 📝 License

[Add your license here]

## 👨‍💻 Development

For development guidelines and contribution instructions, see the individual README files in `rm_be/` and `rm_fe/` directories.
