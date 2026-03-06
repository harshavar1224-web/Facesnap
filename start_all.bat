@echo off
echo Starting Media Club Development Servers...

start cmd /k "echo Starting Python AI Service... && cd backend\ai_service && uvicorn main:app --host 0.0.0.0 --port 8000 --reload"
start cmd /k "echo Starting Node Backend... && cd backend && npm.cmd install && node server.js"
start cmd /k "echo Starting React Frontend... && npm.cmd install && npm.cmd run dev"

echo All services are starting up in separate windows!
echo - AI Service: http://localhost:8000/docs
echo - Node API: http://localhost:5000/api/health
echo - Frontend: http://localhost:5173
echo.
echo Press any key to close this launcher window.
pause > nul
