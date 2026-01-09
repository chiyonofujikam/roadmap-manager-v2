# Roadmap Manager Backend (rm_be)

FastAPI backend for the Roadmap Management System.

## Setup

### Prerequisites
- Python 3.11+
- [uv](https://github.com/astral-sh/uv) package manager
- MongoDB 6.0+ (or Docker for running MongoDB in a container)
- MongoDB Compass (optional, for database visualization)
- Docker & Docker Compose (optional, for containerized MongoDB)
- Keycloak (optional, for production authentication)

### Installation

1. Install dependencies:
```bash
uv sync
```

2. Create `.env` file (optional, defaults will be used if not present):
```bash
# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/roadmap_db_dev
MONGODB_DB_NAME=roadmap_db_dev

# Keycloak Configuration (for production)
KEYCLOAK_SERVER_URL=http://localhost:8080
KEYCLOAK_REALM=roadmap-realm
KEYCLOAK_CLIENT_ID=roadmap-api
KEYCLOAK_CLIENT_SECRET=your-client-secret
KEYCLOAK_VERIFY_SSL=false

# Mock Authentication (for testing without Keycloak)
USE_MOCK_AUTH=true
MOCK_USERS_FILE=mockusers.json
```

3. Initialize database (creates indexes):
```bash
uv run python -m rm_be.database.init_db
```

4. Run the application:
```bash
uv run uvicorn rm_be.main:app --reload
```

## Quick Start with Docker

### Option 1: Full Stack (MongoDB + Backend + Frontend)

To run the entire application with mock authentication:

```bash
# From project root
docker-compose -f docker-compose_mock.yml up -d

# View logs
docker-compose -f docker-compose_mock.yml logs -f

# Stop all services
docker-compose -f docker-compose_mock.yml down
```

This will start:
- MongoDB on port 27017
- Backend API on port 8000
- Frontend on port 5173

Access the application at: http://localhost:5173

### Option 2: Backend Only (with Docker MongoDB)

If you want to run only the backend with Docker MongoDB:

```bash
# Start MongoDB
docker run -d --name roadmap_mongodb -p 27017:27017 mongo:6.0

# Run backend locally
uv run uvicorn rm_be.main:app --reload
```

## Authentication

### Mock Authentication (Testing)

For testing without Keycloak, enable mock authentication:

1. Set `USE_MOCK_AUTH=true` in your `.env` file
2. The `mockusers.json` file contains test users:
   - `admin@example.com` - Admin user (full access)
   - `responsible@example.com` - Responsible user (team management)
   - `collaborator1@example.com` - Collaborator user (pointage entries)

3. To authenticate, use the user's email as the Bearer token:
```bash
curl -H "Authorization: Bearer admin@example.com" http://localhost:8000/auth/me
```

### Keycloak Authentication (Production)

For production, configure Keycloak:

1. Set up Keycloak server (see [Keycloak Setup Guide](https://www.keycloak.org/docs/latest/getting_started/))
2. Create a realm (e.g., `roadmap-realm`)
3. Create a client (e.g., `roadmap-api`)
4. Configure the `.env` file with your Keycloak settings:
```bash
USE_MOCK_AUTH=false
KEYCLOAK_SERVER_URL=http://your-keycloak-server:8080
KEYCLOAK_REALM=roadmap-realm
KEYCLOAK_CLIENT_ID=roadmap-api
KEYCLOAK_CLIENT_SECRET=your-client-secret
```

5. Users authenticate through Keycloak and receive JWT tokens
6. Include the JWT token in API requests:
```bash
curl -H "Authorization: Bearer <jwt-token>" http://localhost:8000/auth/me
```

### User Types & Permissions

- **Admin** (`user_type='admin'`): Full system access
- **Responsible** (`user_type='responsible'`): Can manage team and validate entries
- **Collaborator** (`user_type='collaborator'`): Can only access own pointage entries

### Testing Authentication Endpoints

```bash
# Get current user info (requires authentication)
curl -H "Authorization: Bearer admin@example.com" http://localhost:8000/auth/me

# Admin-only endpoint
curl -H "Authorization: Bearer admin@example.com" http://localhost:8000/auth/admin

# Responsible-only endpoint
curl -H "Authorization: Bearer responsible@example.com" http://localhost:8000/auth/responsible

# Collaborator-only endpoint
curl -H "Authorization: Bearer collaborator1@example.com" http://localhost:8000/auth/collaborator
```

## MongoDB Compass Setup

### Quick Connection

Connect to MongoDB using:
- **Connection String**: `mongodb://localhost:27017`
- **Database**: `roadmap_db_dev`

### Connection Steps

**Option 1: Docker MongoDB (Recommended)**

1. Ensure MongoDB container is running:
```bash
docker-compose ps mongodb
# Or
docker ps | grep roadmap_mongodb
```

2. Open MongoDB Compass
3. Connection String: `mongodb://localhost:27017`
   - Or use simplified form:
     - Host: `localhost`
     - Port: `27017`
     - Authentication: None (for local development)
4. Click "Connect"
5. Select Database: `roadmap_db_dev`

**Option 2: Local MongoDB**

1. Start MongoDB (if not already running)
2. Open MongoDB Compass
3. Connection String: `mongodb://localhost:27017`
   - Or use simplified form:
     - Host: `localhost`
     - Port: `27017`
     - Authentication: None (for local development)
4. Click "Connect"
5. Select Database: `roadmap_db_dev`

**Option 2: Using Environment Variables**

If you have a `.env` file with custom MongoDB URI, extract connection details:
- Host: `localhost` (or your MongoDB host)
- Port: `27017` (or your MongoDB port)
- Database: `roadmap_db_dev`

**Option 3: MongoDB Atlas (Cloud)**

1. Get your connection string from Atlas dashboard
2. It will look like: `mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`
3. Paste this directly into MongoDB Compass connection string field
4. Select your database name (e.g., `roadmap_db_dev`)

### Troubleshooting

**Cannot Connect to MongoDB**
- Check if MongoDB is running: `net start MongoDB` (Windows) or check services
- Verify port 27017 is not blocked by firewall
- Connection string formats:
  - Local: `mongodb://localhost:27017`
  - With auth: `mongodb://username:password@localhost:27017`
  - Atlas: `mongodb+srv://username:password@cluster.mongodb.net/`

**Database Not Found**
- The database will be created automatically when you first insert data
- Run the FastAPI app or initialization script to create collections and indexes

**Collections Not Visible**
- Collections are created when first document is inserted
- Run the app or use the initialization script to create the structure

### Useful Compass Features

1. Browse Collections: View documents in each collection
2. Query Documents: Use MongoDB query syntax to filter documents
3. View Indexes: Check the "Indexes" tab to see created indexes
4. Aggregation Pipeline: Build aggregation pipelines visually
5. Schema Analysis: View schema of your collections
6. Performance: Monitor query performance

### Example Queries

Find all active collaborators:
```javascript
{ "status": "active", "deleted_at": null }
```

Find roadmaps by status:
```javascript
{ "status": "active" }
```

Find pointage entries for a collaborator:
```javascript
{ "collaborator_id": ObjectId("...") }
```

## Project Structure

```
rm_be/
├── rm_be/                   # Application code
│   ├── __init__.py
│   ├── main.py              # FastAPI app initialization
│   ├── config.py            # Configuration settings
│   ├── api/                 # API layer
│   │   ├── __init__.py
│   │   └── deps.py         # API dependencies
│   ├── core/                # Core functionality
│   │   ├── __init__.py
│   │   └── security.py     # Authentication & security
│   ├── database/            # Database layer
│   │   ├── __init__.py
│   │   ├── connection.py   # MongoDB connection
│   │   ├── models.py       # Pydantic models
│   │   ├── repositories.py # Database operations
│   │   ├── indexes.py      # Index creation
│   │   └── init_db.py    # Database initialization
│   └── utils/              # Utility functions
│       └── __init__.py
├── scripts/                 # Utility scripts
│   └── test_auth.py        # Authentication testing script
├── Dockerfile              # Docker container definition
├── mockusers.json          # Mock users for testing
├── pyproject.toml          # Project dependencies
├── uv.lock                 # Dependency lock file
├── .gitignore             # Git ignore rules
├── .dockerignore          # Docker ignore rules
└── README.md              # This file
```

## Database Collections

- `users` - User information (collaborators, responsibles, admins)
- `conditional_lists` - LC (Liste Conditionnelle) reference data
- `pointage_entries` - Time tracking entries filled by collaborators
- `audit_logs` - Audit trail for all operations
- `background_jobs` - Background job tracking for async operations

## System Architecture & Operations

### Overview

Roadmap Manager is a time tracking system where collaborators fill daily pointage entries, responsibles manage teams and reference data, and admins perform system-wide operations.

### User Roles & Permissions

#### 1. Collaborator (`user_type='collaborator'`)

**Access:**
- Dedicated frontend page for filling pointage entries
- Weekly calendar view interface
- Can only view/edit their own pointage entries

**Actions:**
- Fill daily pointage data for each week
- Select values from Conditional List (LC) fields
- Save entries as draft (editable)
- Submit entries for validation (locks entry)

**Workflow:**
1. User logs in → sees weekly calendar view
2. Selects a week → calendar displays Monday-Sunday
3. Selects a day → form appears with LC inputs
4. Fills form:
   - LC `clef_imputation` input: Autocomplete search field
   - LC `libelle` input: Autocomplete search field
   - LC `fonction` input: Autocomplete search field
   - Date besoin input: Free text field
   - Heures théoriques input: Numeric/text field
   - Heures passées input: Numeric/text field
   - Commentaires input: Multi-line comment area
5. Saves entry → status='draft' (can still edit)
6. Submits entry → status='submitted' (locked, cannot edit)

#### 2. Responsible (`user_type='responsible'`)

**Access:**
- View pointage collection as table (via `export_pointage` job)
- Manage Conditional Lists (LC)
- Validate/reject collaborator pointage entries
- View all entries from their team members

**Actions:**
- Update LC collection:
  - Add new LC items
  - Remove LC items
  - Activate/deactivate LC items (each field can be managed separately)
- View pointage data:
  - Trigger `export_pointage` background job
  - View entire pointage collection as table
  - Filter by team members
- Validate pointage entries:
  - Approve collaborator submissions → status='validated'
  - Reject collaborator submissions → status='rejected'

**Workflow:**
1. Updates LC → triggers `lc_update` background job
2. Views pointage data → triggers `export_pointage` background job
3. Reviews collaborator submissions → validates/rejects entries

#### 3. Admin (`user_type='admin'`)

**Access:**
- All Responsible permissions
- Bulk data import
- System cleanup operations
- Full system management

**Actions:**
- All Responsible actions
- Import data:
  - Import LC data from Excel → triggers `import_data` job
  - Import Users from Excel → triggers `import_data` job
- Cleanup:
  - Permanently remove deleted LC data → triggers `cleanup` job
  - Remove inactive users → triggers `cleanup` job
  - Remove old pointage data → triggers `cleanup` job

### Background Jobs

Background jobs are asynchronous operations triggered from the frontend that perform database operations.

#### Job Types

##### 1. `export_pointage` - Pointage Data View/Export

**Triggered by:** Responsible or Admin users

**Purpose:** View entire pointage collection as a table

**Operation:**
- Reads `pointage_entries` collection
- Formats data as table view
- Does NOT modify data (read-only operation)
- Can filter by:
  - Responsible's team members
  - Date range
  - Status (draft/submitted/validated/rejected)

**Output:**
- Table view of pointage entries
- Can be exported to Excel/CSV format

**Example:**
```python
job = BackgroundJob(
    job_type="export_pointage",
    job_name="Export pointage for team XYZ",
    status="pending",
    parameters={
        "responsible_id": "...",
        "date_from": "2024-01-01",
        "date_to": "2024-12-31",
        "format": "table"  # or "excel", "csv"
    },
    created_by="responsible@example.com"
)
```

##### 2. `lc_update` - Conditional List Updates

**Triggered by:** Admin or Responsible users

**Purpose:** Update Conditional List (LC) collection

**Operations:**
- Add new LC items
- Remove LC items
- Activate/deactivate LC items
- Update LC item values
- **Each field (clef_imputation, libelle, fonction) can be managed independently**

**Modifies:** `conditional_lists` collection

**Example:**
```python
job = BackgroundJob(
    job_type="lc_update",
    job_name="Update LC - Add new items",
    status="pending",
    parameters={
        "lc_id": "...",
        "action": "add_items",  # or "remove_items", "activate", "deactivate"
        "items": [
            {
                "clef_imputation": "STR7.1.4",
                "libelle": "New Item",
                "fonction": "CPL"
            }
        ]
    },
    created_by="admin@example.com"
)
```

##### 3. `import_data` - Bulk Data Import

**Triggered by:** Admin users

**Purpose:** Import bulk information from Excel files

**Use Cases:**
- Import LC data from Excel (fills `conditional_lists` collection)
- Import Users from Excel (fills `users` collection)

**Operation:**
- Processes Excel file
- Validates data
- Bulk inserts into database
- Reports errors for invalid rows

**Example:**
```python
job = BackgroundJob(
    job_type="import_data",
    job_name="Import LC data from Excel",
    status="pending",
    parameters={
        "file_path": "/uploads/lc_data.xlsx",
        "data_type": "conditional_list",  # or "users"
        "sheet_name": "LC Sheet"
    },
    created_by="admin@example.com"
)
```

##### 4. `cleanup` - Permanent Data Removal

**Triggered by:** Admin users

**Purpose:** Permanently remove deleted/archived data

**Operations:**
- Remove old LC data (`is_deleted=True`)
- Remove inactive users
- Remove old pointage data
- Hard delete archived records

**Warning:** This is a permanent deletion operation (not soft delete)

**Example:**
```python
job = BackgroundJob(
    job_type="cleanup",
    job_name="Cleanup old deleted data",
    status="pending",
    parameters={
        "collections": ["conditional_lists", "users", "pointage_entries"],
        "older_than_days": 90,
        "include_archived": True
    },
    created_by="admin@example.com"
)
```

### Pointage Filling Interface

#### Frontend Components

1. **Weekly Calendar View**
   - Displays Monday through Sunday for selected week
   - Shows existing entries
   - Highlights submitted entries (locked)

2. **Left Sidebar - LC Inputs**
   - LC `clef_imputation` input: Autocomplete search field
   - LC `libelle` input: Autocomplete search field
   - LC `fonction` input: Autocomplete search field
   - Date besoin input: Free text field
   - Heures théoriques input: Text/numeric field
   - Heures passées input: Text/numeric field
   - Commentaires input: Multi-line comment area

3. **Entry Form**
   - Appears when user selects a day
   - Pre-filled if entry exists
   - Shows status (draft/submitted/validated/rejected)

#### Data Flow

```
User selects day
    ↓
Load existing entry (if any)
    ↓
User fills form
    ↓
User clicks "Save"
    ↓
Create/Update PointageEntry (status='draft')
    ↓
User clicks "Submit"
    ↓
Update PointageEntry (status='submitted', locked)
    ↓
Responsible reviews
    ↓
Responsible validates/rejects
    ↓
Update PointageEntry (status='validated' or 'rejected')
```

### Database Schema Relationships

```
Users (collaborators)
    ↓ (user_id)
PointageEntries
    ↓ (selects from)
ConditionalList.items
    ↓ (clef_imputation, libelle, fonction)
Used in pointage form

Users (responsibles)
    ↓ (responsible_id)
Users (collaborators)
    ↓ (user_id)
PointageEntries

Users (admins)
    ↓ (triggers)
BackgroundJobs
    ↓ (modifies)
ConditionalLists, Users, PointageEntries
```

### API Endpoints (Planned)

#### Collaborator Endpoints
- `GET /api/pointage/week/{week_start}` - Get entries for week
- `POST /api/pointage` - Create pointage entry
- `PUT /api/pointage/{id}` - Update pointage entry
- `POST /api/pointage/{id}/submit` - Submit entry

#### Responsible Endpoints
- `GET /api/pointage/team` - Get team entries
- `POST /api/pointage/{id}/validate` - Validate entry
- `POST /api/pointage/{id}/reject` - Reject entry
- `POST /api/background-jobs/export-pointage` - Trigger export job
- `GET /api/conditional-lists` - List LC
- `POST /api/conditional-lists/{id}/update` - Update LC (triggers job)

#### Admin Endpoints
- All Responsible endpoints
- `POST /api/background-jobs/import-data` - Trigger import job
- `POST /api/background-jobs/cleanup` - Trigger cleanup job
- `GET /api/background-jobs/{id}` - Get job status
- `GET /api/background-jobs` - List jobs

### Security & Validation

#### Access Control
- Collaborators can only access their own pointage entries
- Responsibles can access their team's entries
- Admins have full access

#### Data Validation
- LC items must have all 3 fields (clef_imputation, libelle, fonction)
- Pointage entries must reference valid user_id
- Submitted entries cannot be modified (except by responsible/admin)

#### Audit Trail
- All operations logged in `audit_logs` collection
- Tracks who performed what action and when
- Includes before/after states for updates

## LC (Liste Conditionnelle) Schema

The LC schema provides reference data with **3 main fields** that are used in the pointage filling interface.

### ConditionalListItem Schema

Each LC item contains the following 3 main fields (each can be independently activated/deactivated):

1. **`clef_imputation`** (Clef d'imputation) - Required
   - Imputation Key
   - Examples: `"STR7.1.2"`, `"STR7.1.3 Sprint 3"`, `"Modélisation et simulation"`
   - Used in pointage entry form as autocomplete search field

2. **`libelle`** (Libellé) - Required
   - Label/Description
   - Examples: `"UVR ADL1"`, `"UVR SwDS"`, `"Dossiers Safety"`
   - Used in pointage entry form as autocomplete search field

3. **`fonction`** (Fonction) - Required
   - Function category
   - Examples: `"CPL"`, `"DGN"`, `"DRS"`, `"DRV"`, `"ESG"`
   - Used in pointage entry form as autocomplete search field

### Additional Fields

- `is_active`: Boolean (default: true) - Active status flag
  - Managed by Responsible/Admin users
  - Each field can be independently activated/deactivated

### Example LC Item

```json
{
  "clef_imputation": "STR7.1.3 Sprint 3",
  "libelle": "UVR SwDS",
  "fonction": "CPL",
  "is_active": true
}
```

### Usage in Code

```python
from rm_be.database.models import ConditionalListItem, ConditionalList

# Create an LC item
item = ConditionalListItem(
    clef_imputation="STR7.1.2",
    libelle="UVR ADL1",
    fonction="CPL"
)

# Create conditional list with items
lc = ConditionalList(
    name="Main LC",
    description="Primary conditional list",
    items=[item],
    created_by="admin@example.com",
    updated_by="admin@example.com"
)
```

### LC Management

- **Admin/Responsible** can add/remove LC items via `lc_update` background job
- **Admin/Responsible** can activate/deactivate LC items (each field can be managed independently)
- **Collaborators** select values from active LC items when filling pointage entries

### LC Indexes

The following indexes are created for efficient querying:
- `{ name: 1 }` - Unique index on LC name
- `{ "items.clef_imputation": 1 }` - Lookup by imputation key
- `{ "items.is_active": 1 }` - Filter active items
