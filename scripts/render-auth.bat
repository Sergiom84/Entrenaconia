@echo off
REM Script para autenticación de Render CLI en Windows

echo ========================================
echo    [92mAutenticacion de Render CLI[0m
echo ========================================
echo.

REM Verificar que render CLI está instalado
where render >nul 2>&1
if %errorlevel% neq 0 (
    echo [91mError: Render CLI no esta instalado[0m
    echo Descarga desde: https://github.com/render-oss/cli/releases
    pause
    exit /b 1
)

echo Generando codigo de autorizacion...
echo.

REM Ejecutar render login
render login

echo.
echo ========================================
echo [93mINSTRUCCIONES:[0m
echo ========================================
echo.
echo 1. Busca arriba el codigo (ej: 6I7R-VH5H-MN2B-GUEW)
echo 2. Si no se abrio el navegador automaticamente, copia la URL que empieza con:
echo    https://dashboard.render.com/device-authorization/
echo 3. Abrela en tu navegador
echo 4. Ingresa el codigo cuando te lo pida
echo 5. Autoriza la aplicacion
echo.
echo [92mUna vez autorizado, presiona Enter para continuar[0m
pause

REM Verificar que el login fue exitoso
render whoami >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo [91mParece que el login no se completo correctamente[0m
    echo Intenta de nuevo o usa una API key
    pause
    exit /b 1
)

echo.
echo [92mLogin exitoso![0m
render whoami
echo.
pause
