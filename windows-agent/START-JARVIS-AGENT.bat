@echo off
setlocal
cd /d "%~dp0"
if not exist ".env" (
  echo Missing .env. Copy .env.example to .env and fill in the values.
  pause
  exit /b 1
)
"E:\python\python-3.14.8-embed-amd64\python.exe" agent.py
if errorlevel 1 (
  echo.
  echo JARVIS Windows Agent stopped.
  pause
)
