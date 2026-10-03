@echo off
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 weft.py
) else (
  python weft.py
)
pause
