@echo off
cd /d "%~dp0"
echo.
echo  Careflow - Hospital Management System
echo  Open http://127.0.0.1:5173 after the server starts.
echo  Keep this window open while using the app.
echo.
if not exist node_modules (
  echo Installing dependencies...
  call npm.cmd install
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
call npm.cmd run dev
pause
