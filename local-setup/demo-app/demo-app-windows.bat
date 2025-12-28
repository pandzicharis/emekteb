@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

REM Get the project root directory (parent of local-setup)
cd /d "%~dp0"
cd ..\..

echo.
echo ╔══════════════════════════════════════════════════════════╗
echo ║                                                          ║
echo ║          🎭 E-Mekteb DEMO App Setup                     ║
echo ║                                                          ║
echo ╚══════════════════════════════════════════════════════════╝
echo.

REM Truncate baze
echo 🗑️  Step 1/3: Truncating database...
call npm run prisma:truncate --prefix apps/api

if errorlevel 1 (
  echo ❌ Error truncating database
  echo.
  pause
  exit /b 1
)

echo    ✅ Database truncated
echo.

REM Osnovni seed
echo 🌱 Step 2/3: Running basic seed...
call npm run prisma:seed --prefix apps/api

if errorlevel 1 (
  echo ❌ Error running basic seed
  echo.
  pause
  exit /b 1
)

echo    ✅ Basic seed completed
echo.

REM Demo seed
echo 🎭 Step 3/3: Running demo seed...
call npm run prisma:seed:demo --prefix apps/api

if errorlevel 1 (
  echo ❌ Error running demo seed
  echo.
  pause
  exit /b 1
)

echo.
echo ╔══════════════════════════════════════════════════════════╗
echo ║                                                          ║
echo ║          🎉 DEMO app setup completed!                   ║
echo ║                                                          ║
echo ╚══════════════════════════════════════════════════════════╝
echo.
echo 📝 Demo podaci su uspješno kreirani!
echo.
pause

