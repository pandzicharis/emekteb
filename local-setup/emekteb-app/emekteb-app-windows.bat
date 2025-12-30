@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

REM Get the project root directory (parent of local-setup)
cd /d "%~dp0"
cd ..\..

echo.
echo ╔══════════════════════════════════════════════════════════╗
echo ║                                                          ║
echo ║          🚀 E-Mekteb App Setup                         ║
echo ║                                                          ║
echo ╚══════════════════════════════════════════════════════════╝
echo.

REM Provjeri da li seed već postoji
echo 🔍 Checking if seed already exists...
call npm run prisma:seed --prefix apps/api

if errorlevel 1 (
  echo ❌ Error running seed
  echo.
  pause
  exit /b 1
)

echo.
echo ╔══════════════════════════════════════════════════════════╗
echo ║                                                          ║
echo ║          ✅ E-Mekteb app setup completed!               ║
echo ║                                                          ║
echo ╚══════════════════════════════════════════════════════════╝
echo.
pause



