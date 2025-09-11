@echo off
echo.
echo ============================================
echo   ⚡ REINICIO RÁPIDO
echo ============================================
echo.

echo 🛑 Matando procesos...
taskkill /f /im node.exe 2>nul
npx kill-port 3002 5173 2>nul

echo.
echo ⏳ Esperando 2 segundos...
timeout /t 2 /nobreak > nul

echo.
echo 🚀 Reiniciando servicios...
start "Backend" cmd /k "cd backend && npm start"
timeout /t 2 /nobreak > nul
start "Frontend" cmd /k "npm run dev"

echo.
echo ✅ Reinicio completado
echo 📦 Backend: http://localhost:3002
echo 🌐 Frontend: http://localhost:5173
echo.
exit