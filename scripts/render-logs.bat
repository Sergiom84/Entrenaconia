@echo off
REM Script de acceso rápido a logs de Render (Windows)
REM Uso: render-logs.bat [comando] [servicio] [opciones]

setlocal enabledelayedexpansion

echo.
echo [94m==============================================[0m
echo [94m   Render Logs - Entrena con IA[0m
echo [94m==============================================[0m
echo.

REM Verificar que render CLI está instalado
where render >nul 2>&1
if %errorlevel% neq 0 (
    echo [91mError: Render CLI no esta instalado[0m
    echo Instala desde: https://github.com/render-oss/cli/releases
    exit /b 1
)

REM Verificar autenticación
render whoami >nul 2>&1
if %errorlevel% neq 0 (
    echo [93mAdvertencia: No estas autenticado en Render[0m
    echo Ejecuta: render login
    exit /b 1
)

if "%1"=="" goto :show_help
if "%1"=="help" goto :show_help

set COMMAND=%1
shift

if "%COMMAND%"=="list" goto :list_services
if "%COMMAND%"=="tail" goto :tail_logs
if "%COMMAND%"=="view" goto :view_logs
if "%COMMAND%"=="errors" goto :error_logs

echo [91mComando desconocido: %COMMAND%[0m
goto :show_help

:list_services
echo [92mListando servicios...[0m
echo.
render services --output text
goto :end

:tail_logs
set SERVICE=%1
if "%SERVICE%"=="" (
    echo [91mError: Debes especificar un servicio[0m
    goto :show_help
)
echo [92mStreaming logs de: %SERVICE%[0m
echo [93mPresiona Ctrl+C para salir[0m
echo.
render logs --resources %SERVICE% --tail
goto :end

:view_logs
set SERVICE=%1
set LIMIT=%2
if "%LIMIT%"=="" set LIMIT=100
if "%SERVICE%"=="" (
    echo [91mError: Debes especificar un servicio[0m
    goto :show_help
)
echo [92mUltimos %LIMIT% logs de: %SERVICE%[0m
echo.
render logs --resources %SERVICE% --limit %LIMIT% --output text
goto :end

:error_logs
set SERVICE=%1
if "%SERVICE%"=="" (
    echo [91mError: Debes especificar un servicio[0m
    goto :show_help
)
echo [91mFiltrando errores de: %SERVICE%[0m
echo.
render logs --resources %SERVICE% --level error --limit 200 --output text
goto :end

:show_help
echo Uso: %~nx0 [comando] [servicio] [opciones]
echo.
echo Comandos disponibles:
echo   list              - Listar todos los servicios
echo   tail [servicio]   - Ver logs en tiempo real
echo   view [servicio]   - Ver ultimos logs (100 lineas)
echo   errors [servicio] - Filtrar solo errores
echo.
echo Ejemplos:
echo   %~nx0 list
echo   %~nx0 tail backend
echo   %~nx0 view backend
echo   %~nx0 errors backend
echo.
goto :end

:end
endlocal
