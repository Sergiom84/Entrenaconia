@echo off
echo 🚀 Iniciando desarrollo completo - Entrena con IA
echo =====================================

REM Verificar puertos
echo.
echo 🔍 Verificando configuración de puertos...
node scripts/check-ports.js
if %errorlevel% neq 0 (
    echo ❌ Error en verificación de puertos
    pause
    exit /b 1
)

echo.
echo 🚀 Iniciando frontend y backend...
echo.

REM Crear archivo temporal para logs
set LOGFILE=%TEMP%\entrena-dev.log

REM Iniciar backend en nueva ventana
start "Backend API" cmd /k "cd /d %~dp0\..\backend && npm run dev"

REM Esperar un momento para que el backend inicie
timeout /t 3 /nobreak > nul

REM Iniciar frontend en nueva ventana
start "Frontend" cmd /k "cd /d %~dp0\.. && npm run dev"

echo ✅ Servicios iniciados:
echo    - Backend: nueva ventana cmd
echo    - Frontend: nueva ventana cmd
echo.
echo 💡 Para detener los servicios, cierra las ventanas de cmd
echo 💡 Para monitorear: npm run monitor
echo.
pause