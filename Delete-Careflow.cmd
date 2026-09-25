@echo off
setlocal
set "CAREFLOW_DELETE_SCRIPT=%~dp0scripts\delete-careflow.ps1"
cd /d "%TEMP%"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%CAREFLOW_DELETE_SCRIPT%"
