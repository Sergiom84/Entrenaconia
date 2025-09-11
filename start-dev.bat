@echo off
echo.
echo ============================================
echo   🚀 INICIANDO ENTORNO DE DESARROLLO
echo ============================================
echo.

echo 🧹 Limpiando procesos anteriores...
call kill-all.bat

echo.
echo 📦 Iniciando Backend (Puerto 3002)...
start "Backend Server" cmd /k "cd backend && npm start"
timeout /t 3 /nobreak > nul

echo.
echo 🌐 Iniciando Frontend (Puerto 5173)...
start "Frontend Dev" cmd /k "npm run dev"

echo.
echo ============================================
echo   ✅ ENTORNO INICIADO
echo ============================================
echo   📦 Backend: http://localhost:3002
echo   🌐 Frontend: http://localhost:5173
echo.
echo   📝 Logs del backend y frontend se muestran
echo      en ventanas separadas
echo.
pause