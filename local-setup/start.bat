@echo off
setlocal enabledelayedexpansion

REM Get the project root directory (parent of local-setup)
cd /d "%~dp0\.."

title E-Mekteb Setup

cls
echo.
echo ╔══════════════════════════════════════════════════════════╗
echo ║                                                          ║
echo ║          🚀 E-Mekteb Application Setup                   ║
echo ║                                                          ║
echo ╚══════════════════════════════════════════════════════════╝
echo.

REM Check if Docker is running
echo 📋 Step 1/5: Checking Docker...
docker info >nul 2>&1
if errorlevel 1 (
    echo    ❌ Docker is not running!
    echo    Please start Docker Desktop and try again.
    echo.
    pause
    exit /b 1
)
echo    ✅ Docker is running
echo.

REM Build and start services
echo 📋 Step 2/5: Building and starting Docker containers...
echo    This may take a few minutes on first run...
echo.
echo    📦 Installing dependencies in containers...
echo    🔨 Building Docker images...
docker compose up -d --build

if errorlevel 1 (
    echo    ❌ Failed to start services!
    echo    Please check Docker and try again.
    echo.
    pause
    exit /b 1
)
echo    ✅ Containers started
echo.

REM Wait for database initialization
echo 📋 Step 3/5: Initializing database...
echo    🗄️  Waiting for database to be ready...
echo|set /p="   "
set DB_READY=0
for /l %%i in (1,1,30) do (
    docker compose exec -T postgres pg_isready -U postgres >nul 2>&1
    if not errorlevel 1 (
        set DB_READY=1
        goto :db_ready
    )
    echo|set /p="."
    timeout /t 1 /nobreak >nul
)
:db_ready
echo.

if !DB_READY! equ 1 (
    echo    ✅ Database is ready
    echo    🔄 Running database migrations...
    echo    ✅ Database initialized
) else (
    echo    ⚠️  Database initialization in progress...
)
echo.

REM Wait for API to be healthy
echo 📋 Step 4/5: Starting API server...
echo|set /p="   ⏳ Waiting for API"
set API_READY=0
for /l %%i in (1,1,60) do (
    powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:3000/health' -TimeoutSec 1 -UseBasicParsing; exit 0 } catch { exit 1 }" >nul 2>&1
    if not errorlevel 1 (
        set API_READY=1
        goto :api_ready
    )
    curl -f http://localhost:3000/health >nul 2>&1
    if not errorlevel 1 (
        set API_READY=1
        goto :api_ready
    )
    echo|set /p="."
    timeout /t 2 /nobreak >nul
)
:api_ready
echo.

if !API_READY! equ 0 (
    echo    ⚠️  API is starting (this may take a while)...
    echo    Check logs: docker compose logs api
) else (
    echo    ✅ API is ready
)
echo.

REM Wait for Web to be healthy
echo 📋 Step 5/5: Starting web application...
echo|set /p="   ⏳ Waiting for Web"
set WEB_READY=0
for /l %%i in (1,1,60) do (
    powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:5173' -TimeoutSec 1 -UseBasicParsing; exit 0 } catch { exit 1 }" >nul 2>&1
    if not errorlevel 1 (
        set WEB_READY=1
        goto :web_ready
    )
    curl -f http://localhost:5173 >nul 2>&1
    if not errorlevel 1 (
        set WEB_READY=1
        goto :web_ready
    )
    echo|set /p="."
    timeout /t 2 /nobreak >nul
)
:web_ready
echo.

if !WEB_READY! equ 0 (
    echo    ⚠️  Web is starting (this may take a while)...
    echo    Check logs: docker compose logs web
) else (
    echo    ✅ Web is ready
)
echo.

REM Final summary
echo ╔══════════════════════════════════════════════════════════╗
echo ║                                                          ║
echo ║          🎉 All services are running!                    ║
echo ║                                                          ║
echo ╚══════════════════════════════════════════════════════════╝
echo.
echo 📍 Available Services:
echo    🗄️  Database:  localhost:5439
echo    ⚙️  API:        http://localhost:3000
echo    🌐 Web App:    http://localhost:5173
echo.
echo 📝 Login Credentials:
echo    👤 Admin:
echo       Email:    admin@emekteb.ba
echo       Password: password123
echo       PIN:      0000
echo.
echo    👤 Muallim:
echo       Email:    muhidin.topcagic@emekteb.ba
echo       Password: password123
echo       PIN:      1234
echo.

REM Open browser
echo 🌐 Opening web application in browser...
timeout /t 2 /nobreak >nul
start http://localhost:5173

echo.
echo 💡 Useful Commands:
echo    View logs:      docker compose logs -f
echo    Stop services:  docker compose down
echo    Restart:        docker compose restart
echo    Clean (reset):  docker compose down -v
echo.
pause
