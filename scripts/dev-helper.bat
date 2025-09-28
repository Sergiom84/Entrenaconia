@echo off
setlocal enabledelayedexpansion

:: ======================================================
:: Entrena con IA - Dev Helper (Windows)
:: - Mata procesos en puertos ocupados (backend/frontend)
:: - Lanza backend y/o frontend
:: - Health check rápido del backend
:: Uso: scripts\dev-helper.bat [BACK_PORT] [FRONT_PORT]
:: Por defecto: BACK_PORT=3010, FRONT_PORT=5173
:: ======================================================

set BACK_PORT=%1
set FRONT_PORT=%2
if "%BACK_PORT%"=="" set BACK_PORT=3010
if "%FRONT_PORT%"=="" set FRONT_PORT=5173

echo ======================================================
echo   Entrena con IA - Dev Helper
echo   Backend: %BACK_PORT%   Frontend: %FRONT_PORT%
echo ======================================================

:menu
echo.
echo [1] Kill backend port %BACK_PORT% y arrancar backend
echo [2] Kill frontend port %FRONT_PORT% y arrancar frontend
echo [3] Kill ambos puertos y arrancar ambos (concurrently)
echo [4] Solo kill de puertos
echo [5] Health check backend
echo [6] Salir
set /p choice=Elige opcion [1-6]: 

if "%choice%"=="1" call :killport %BACK_PORT% & call :start_backend & goto menu
if "%choice%"=="2" call :killport %FRONT_PORT% & call :start_frontend & goto menu
if "%choice%"=="3" call :killport %BACK_PORT% & call :killport %FRONT_PORT% & call :start_both & goto menu
if "%choice%"=="4" call :killport %BACK_PORT% & call :killport %FRONT_PORT% & goto menu
if "%choice%"=="5" call :health & goto menu
if "%choice%"=="6" goto end
echo Opcion invalida
goto menu

:killport
set PORT=%1

echo Buscando procesos en puerto %PORT% (PowerShell)...
powershell -NoProfile -Command "try { $pids = Get-NetTCPConnection -LocalPort %PORT% -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique; if ($pids) { $pids | ForEach-Object { try { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue } catch {} }; Write-Host ('Matados PIDs: ' + ($pids -join ', ')) } else { Write-Host 'No hay proceso escuchando en el puerto %PORT%.' } } catch { Write-Host 'PowerShell no pudo consultar puertos. Intenta como Administrador.' }"

echo Listo.

goto :eof

:start_backend
echo Iniciando backend (puerto %BACK_PORT%)...
start "API" cmd /c "cd backend && npm run dev"
goto :eof

:start_frontend
echo Iniciando frontend (puerto %FRONT_PORT%)...
start "FRONT" cmd /c "npm run dev"
goto :eof

:start_both
echo Iniciando ambos servicios...
start "DEV:ALL" cmd /c "npm run dev:all"
goto :eof

:health
echo Haciendo health check: http://localhost:%BACK_PORT%/api/health
powershell -Command "try { $r=Invoke-WebRequest -Uri http://localhost:%BACK_PORT%/api/health -UseBasicParsing -TimeoutSec 3; Write-Host $r.Content } catch { Write-Host 'Backend health check failed' }"
goto :eof

:end
endlocal
exit /b 0

