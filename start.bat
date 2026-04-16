@echo off
echo Starting SafeRoute AI...
echo.
echo Backend: http://127.0.0.1:8000
echo Frontend: http://localhost:3000
echo.
start "SafeRoute-Backend" cmd /c "cd backend && python -m uvicorn app:app --host 127.0.0.1 --port 8000 --reload"
timeout /t 2 /nobreak >nul
start "SafeRoute-Frontend" cmd /c "cd web && npm run dev"
echo.
echo Both servers starting. Open http://localhost:3000 in your browser.
