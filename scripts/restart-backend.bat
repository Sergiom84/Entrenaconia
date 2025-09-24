@echo off
echo ========================================
echo   REINICIANDO BACKEND - Entrena con IA
echo ========================================
echo.

REM Matar procesos node en puerto 3002
echo [1] Deteniendo procesos en puerto 3002...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3002 ^| findstr LISTENING') do (
    echo    - Matando proceso PID: %%a
    taskkill /F /PID %%a >nul 2>&1
)

timeout /t 2 /nobreak >nul

REM Verificar que el puerto está libre
echo [2] Verificando puerto 3002...
netstat -an | findstr :3002 | findstr LISTENING >nul 2>&1
if %errorlevel% equ 0 (
    echo    ERROR: El puerto 3002 sigue ocupado
    echo    Intenta cerrar manualmente el proceso node.js
    pause
    exit /b 1
) else (
    echo    ✓ Puerto 3002 libre
)

echo.
echo [3] Iniciando backend...
cd /d "%~dp0..\backend"
start "Backend Server" cmd /k "npm run dev"

timeout /t 3 /nobreak >nul

echo.
echo [4] Verificando servidor...
curl -s http://localhost:3002/api/health >nul 2>&1
if %errorlevel% equ 0 (
    echo    ✓ Backend respondiendo correctamente
    echo.
    echo ========================================
    echo   BACKEND REINICIADO CON ÉXITO
    echo ========================================
) else (
    echo    ⚠ Backend iniciándose, espera unos segundos...
)

echo.
echo Puedes cerrar esta ventana
pause