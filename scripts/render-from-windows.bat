@echo off
REM Script para usar Render CLI desde Windows via WSL

setlocal enabledelayedexpansion

echo ========================================
echo    Render CLI via WSL
echo ========================================
echo.

REM Verificar que WSL esta disponible
wsl --status >nul 2>&1
if %errorlevel% neq 0 (
    echo [91mError: WSL no esta disponible[0m
    echo Instala WSL desde: https://aka.ms/wsl
    pause
    exit /b 1
)

if "%1"=="" goto :show_menu
if "%1"=="whoami" goto :whoami
if "%1"=="services" goto :services
if "%1"=="logs" goto :logs
if "%1"=="tail" goto :tail

:show_menu
echo Comandos disponibles:
echo.
echo 1. whoami   - Ver usuario autenticado
echo 2. services - Listar servicios
echo 3. logs     - Ver logs
echo 4. tail     - Streaming de logs
echo.
echo Uso: %~nx0 [comando]
echo Ejemplo: %~nx0 whoami
echo.
pause
exit /b 0

:whoami
echo Obteniendo informacion del usuario...
echo.
wsl bash -c "export PATH=\$PATH:/home/sergio/.local/bin && export RENDER_API_KEY='rnd_NAvuyjyXY29I2TBg6z9k1bIxiNFT' && render whoami --output text 2>/dev/null"
goto :end

:services
echo Listando servicios...
echo.
wsl bash -c "export PATH=\$PATH:/home/sergio/.local/bin && export RENDER_API_KEY='rnd_NAvuyjyXY29I2TBg6z9k1bIxiNFT' && render services --output text 2>/dev/null"
goto :end

:logs
set SERVICE=%2
if "%SERVICE%"=="" set SERVICE=backend
echo Obteniendo logs de: %SERVICE%
echo.
wsl bash -c "export PATH=\$PATH:/home/sergio/.local/bin && export RENDER_API_KEY='rnd_NAvuyjyXY29I2TBg6z9k1bIxiNFT' && render logs --resources %SERVICE% --limit 100 --output text 2>/dev/null"
goto :end

:tail
set SERVICE=%2
if "%SERVICE%"=="" (
    echo Streaming de logs (presiona Ctrl+C para salir)...
    echo.
    wsl bash -c "export PATH=\$PATH:/home/sergio/.local/bin && export RENDER_API_KEY='rnd_NAvuyjyXY29I2TBg6z9k1bIxiNFT' && render logs --tail"
) else (
    echo Streaming de logs de: %SERVICE% (presiona Ctrl+C para salir)...
    echo.
    wsl bash -c "export PATH=\$PATH:/home/sergio/.local/bin && export RENDER_API_KEY='rnd_NAvuyjyXY29I2TBg6z9k1bIxiNFT' && render logs --resources %SERVICE% --tail"
)
goto :end

:end
echo.
pause
endlocal
