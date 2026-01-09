@echo off
REM Local Development Startup Script for Windows
REM This script helps you start the project locally without Docker

echo Starting Roadmap Manager - Local Development
echo.

REM Check if MongoDB is running in Docker
docker ps | findstr roadmap_mongodb >nul
if %errorlevel% neq 0 (
    echo MongoDB not detected. Starting MongoDB in Docker...
    docker ps -a | findstr roadmap_mongodb >nul
    if %errorlevel% equ 0 (
        echo Starting existing MongoDB container...
        docker start roadmap_mongodb
    ) else (
        echo Creating new MongoDB container...
        docker run -d --name roadmap_mongodb -p 27017:27017 mongo:6.0
    )
    timeout /t 2 /nobreak >nul
    echo MongoDB started
) else (
    echo MongoDB is running in Docker
)

echo.
echo Setting up backend...
cd rm_be

REM Check if .env exists
if not exist .env (
    echo Creating .env file...
    (
        echo MONGODB_URI=mongodb://localhost:27017/roadmap_db_dev
        echo MONGODB_DB_NAME=roadmap_db_dev
        echo USE_MOCK_AUTH=true
        echo DEBUG=true
        echo MOCK_USERS_FILE=mockusers.json
    ) > .env
)

REM Install dependencies and initialize
echo Installing Python dependencies...
uv sync && uv clean

echo Initializing database...
uv run python -m rm_be.database.init_db

echo Seeding users...
uv run python -m rm_be.scripts.seed_users

echo Seeding LC data...
uv run python -m rm_be.scripts.seed_lc_data

cd ..

echo.
echo Setting up frontend...
cd rm_fe

REM Check if node_modules exists
if not exist node_modules (
    echo Installing Node.js dependencies...
    npm install
)

REM Check if .env exists
if not exist .env (
    echo Creating .env file...
    echo VITE_API_BASE_URL=http://localhost:8000 > .env
)

cd ..

echo.
echo ========================================
echo Starting services...
echo ========================================
echo.
echo Starting backend on http://localhost:8000
echo Starting frontend on http://localhost:5173
echo.
echo Press Ctrl+C to stop all services
echo.

REM Start backend in new window
start "Backend Server" cmd /k "cd rm_be && uv run uvicorn rm_be.main:app --reload --host 0.0.0.0 --port 8000"

REM Wait a bit for backend to start
timeout /t 3 /nobreak >nul

REM Start frontend in new window
start "Frontend Server" cmd /k "cd rm_fe && npm run dev"

echo.
echo Services started in separate windows
echo.
echo Backend: http://localhost:8000
echo Frontend: http://localhost:5173
echo.
pause
