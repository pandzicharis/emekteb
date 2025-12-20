@echo off

REM Get the directory where this batch file is located
cd /d "%~dp0"

REM Run start.bat (in same directory)
call "%~dp0start.bat"

