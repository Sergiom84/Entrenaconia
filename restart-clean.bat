@echo off
setlocal enabledelayedexpansion
title Entrena con IA - Limpieza y Reinicio Rapido

echo.
echo ========================================
echo   🔧 LIMPIEZA Y REINICIO RAPIDO
echo ========================================

:: Matar todos los procesos de Node.js y npm
echo 🔄 Matando procesos Node.js y npm...
taskkill /F /IM node.exe >nul 2>&1
taskkill /F /IM nodemon.exe >nul 2>&1
taskkill /F /IM npm.cmd >nul 2>&1

:: Esperar un momento para que se liberen los puertos
timeout /t 2 >nul

:: Configurar puertos por defecto (recomendados)
echo ⚙️  Configurando puertos por defecto...
(
echo VITE_PORT=5173
echo VITE_API_PORT=3002
echo VITE_API_BASE_URL=http://localhost:3002
echo VITE_DEBUG_LOGS=false
echo VITE_ENABLE_PERFORMANCE_LOGS=false
echo VITE_ENABLE_STATE_LOGS=false
) > .env.local

:: Asegurar que backend/.env tenga el puerto correcto
powershell -Command "(Get-Content backend\.env) -replace 'PORT=.*', 'PORT=3002' | Set-Content backend\.env"

echo ✅ Configuración actualizada:
echo   - Frontend: Puerto 5173
echo   - Backend: Puerto 3002

echo.
echo 🚀 Iniciando servicios...
echo.

:: Iniciar backend en nueva ventana
echo 📡 Iniciando backend...
start "Backend - Entrena con IA" cmd /k "cd /d %cd%\backend && npm run dev"

:: Esperar 3 segundos para que el backend inicie
timeout /t 3 >nul

:: Iniciar frontend en nueva ventana
echo 🌐 Iniciando frontend...
start "Frontend - Entrena con IA" cmd /k "cd /d %cd% && npm run dev"

echo.
echo ========================================
echo   ✅ SERVICIOS INICIADOS
echo ========================================
echo.
echo 🌐 Frontend: http://localhost:5173
echo 📡 Backend:  http://localhost:3002
echo.
echo ⏰ Esperando a que los servicios inicien...
echo    (Se abrirán 2 ventanas nuevas)
echo.

:: Esperar 5 segundos y abrir navegador
timeout /t 5 >nul
echo 🌍 Abriendo navegador...
start http://localhost:5173

echo.
echo ✅ ¡Listo! Tu aplicación está ejecutándose.
echo.
echo 💡 TIPS:
echo   - Para reiniciar: ejecuta este archivo otra vez
echo   - Para parar: cierra las ventanas del backend y frontend
echo   - Si hay errores: ejecuta primero 'kill-all.bat'
echo.
pause