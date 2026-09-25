@echo off
setlocal
cd /d "%~dp0"
echo.
echo  Careflow - Hospital Management System
echo  Checking this laptop and preparing the app...
echo.
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-careflow.ps1"
if errorlevel 1 (
  echo.
  echo  Careflow could not start. Read the message above, then try again.
)
pause
