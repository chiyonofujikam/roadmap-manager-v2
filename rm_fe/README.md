# Roadmap Manager

A role-based frontend application for managing time entries (POINTAGE) with weekly calendar views.

## Features

### CE (Collaborator/Contributor) Role

- **Weekly Calendar View**: Visual representation of time entries across Monday to Sunday
- **Entry Management**: Save, modify, and submit time entries
- **Status Tracking**: Entries progress through draft → saved → modified → submitted states
- **Entry Locking**: Submitted entries are permanently locked and cannot be modified
- **Week Navigation**: Navigate between different weeks to view and manage entries

### Left Sidebar (LC Panel)

The sidebar contains 7 input fields mapped from the LC (Conditional Lists) collection:

- **Clef d'imputation**: Imputation key selection (autocomplete search from LC)
- **Libellé**: Label selection (autocomplete search from LC)
- **Fonction**: Function category selection (autocomplete search from LC)
- **Date du besoin**: Date input field
- **Nbre d'heures théoriques**: Theoretical hours input
- **Heures passées**: Actual hours input
- **Commentaires**: Comments text area

## Architecture

### Project Structure

```
src/
├── components/
│   ├── auth/
│   │   └── LoginForm.jsx          # Authentication UI
│   ├── layouts/
│   │   ├── CELayout.jsx           # Layout for CE role
│   │   └── RoleBasedLayout.jsx    # Role-based layout switcher
│   ├── pointage/
│   │   ├── LCSidebar.jsx          # Left sidebar with form inputs
│   │   ├── WeeklyCalendar.jsx     # Weekly calendar grid
│   │   └── PointageView.jsx       # Main container for CE view
│   └── ui/
│       └── AutocompleteInput.jsx  # Reusable autocomplete component
├── contexts/
│   └── AuthContext.jsx            # Authentication state management
├── hooks/
│   └── useAuth.js                 # Authentication hook
├── lib/
│   └── supabase.js                # Supabase client configuration
├── utils/
│   └── dateUtils.js               # Date handling utilities
├── App.jsx                        # Main app component
└── main.jsx                       # Application entry point
```

### Database Schema

#### Tables

- **user_profiles**: User information with role assignment
- **conditional_lists**: LC (Liste Conditionnelle) collection with items containing:
  - `clef_imputation`: Imputation key values
  - `libelle`: Label values
  - `fonction`: Function category values
- **pointage_entries**: Time entries with status tracking

### User Roles

- **CE** (Collaborator/Contributor): Access to POINTAGE view only
- **LC_ADMIN**: Future role (placeholder)
- **MANAGER**: Future role (placeholder)
- **SUPERVISOR**: Future role (placeholder)

### Entry Workflow

1. **Select a day**: Click on any day in the weekly calendar
2. **Fill in details**: Complete the form in the left sidebar
3. **Save**: Save the entry (status: saved)
4. **Modify**: Update saved entries before submission (status: modified)
5. **Submit**: Lock the entry permanently (status: submitted)

### Entry States

- **draft**: Initial state (internal use)
- **saved**: Entry has been saved but not submitted
- **modified**: Entry has been updated after initial save
- **submitted**: Entry is locked and cannot be modified

## Technology Stack

- **React 18** with JavaScript
- **Vite** for build tooling
- **Tailwind CSS** for styling
- **Supabase** for backend (auth + database)
- **Lucide React** for icons

## Security

- Row Level Security (RLS) enabled on all tables
- Users can only access their own entries
- Submitted entries cannot be modified or deleted
- Role-based access control for different views

## Extensibility

The application is designed to easily accommodate:

- Additional user roles (LC_ADMIN, MANAGER, SUPERVISOR)
- New views for different roles
- Additional features without refactoring existing code
- Custom layouts per role

### Adding a New Role

1. Update database schema to include new role
2. Create new layout component in `src/components/layouts/`
3. Update `RoleBasedLayout.jsx` to handle new role
4. Create role-specific views as needed

## Getting Started

### Quick Start with Docker (Recommended)

Run the entire stack (MongoDB + Backend + Frontend) with one command:

```bash
# From project root
docker-compose -f docker-compose_mock.yml up -d
```

Access the application at: http://localhost:5173

### Local Development

**Option 1: With Backend API**

1. Ensure backend is running on `http://localhost:8000`
2. Create `.env` file:
```env
VITE_API_BASE_URL=http://localhost:8000
```
3. Install and run:
```bash
npm install
npm run dev
```

**Option 2: Mock Mode (No Backend)**

The app can run in mock mode for UI testing:
```bash
npm install
npm run dev
```

### Production Setup

1. Create a Supabase project
2. Set up the database schema (see DATABASE.md if available)
3. Create a `.env` file:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_key
   ```
4. Restart the dev server

### Using the Application

1. Sign up for a new account (or use mock user in dev mode)
2. Select a week to work with
3. Click on a day to create a new entry
4. Fill in the entry details in the left sidebar
5. Save your entry
6. Submit when ready to lock the entry
