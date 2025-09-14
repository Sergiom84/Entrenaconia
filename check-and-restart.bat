@echo off
setlocal enabledelayedexpansion

:: ===========================================
:: 🔧 SCRIPT DE VERIFICACIÓN Y REINICIO - Entrena con IA (Windows)
:: ===========================================

title Entrena con IA - Verificador de Configuración

echo.
echo ===============================================
echo   🔍 VERIFICACIÓN DE CONFIGURACIÓN ACTUAL
echo ===============================================

:: ===========================================
:: 1. VERIFICAR CONFIGURACIÓN EN ARCHIVOS
:: ===========================================
echo.
echo 🔹 Configuración en archivos
echo -------------------------------------------

:: Frontend
echo Frontend (.env.local):
if exist ".env.local" (
    for /f "tokens=2 delims==" %%i in ('findstr "VITE_PORT=" .env.local 2^>nul') do set VITE_PORT=%%i
    for /f "tokens=2 delims==" %%i in ('findstr "VITE_API_PORT=" .env.local 2^>nul') do set VITE_API_PORT=%%i
    for /f "tokens=2 delims==" %%i in ('findstr "VITE_API_BASE_URL=" .env.local 2^>nul') do set VITE_API_URL=%%i

    if "!VITE_PORT!"=="" set VITE_PORT=5173
    if "!VITE_API_PORT!"=="" set VITE_API_PORT=3002
    if "!VITE_API_URL!"=="" set VITE_API_URL=http://localhost:3002

    echo   Puerto Frontend: !VITE_PORT!
    echo   API Port: !VITE_API_PORT!
    echo   API URL: !VITE_API_URL!
) else (
    echo   ⚠️  .env.local no encontrado - usando defaults
    set VITE_PORT=5173
    set VITE_API_PORT=3002
)

echo.
echo Backend (backend\.env):
if exist "backend\.env" (
    for /f "tokens=2 delims==" %%i in ('findstr "PORT=" backend\.env 2^>nul') do set BACKEND_PORT=%%i
    if "!BACKEND_PORT!"=="" set BACKEND_PORT=3002
    echo   Puerto Backend: !BACKEND_PORT!
) else (
    echo   ⚠️  backend\.env no encontrado - usando default 3002
    set BACKEND_PORT=3002
)

:: ===========================================
:: 2. VERIFICAR PUERTOS ACTUALMENTE EN USO
:: ===========================================
echo.
echo 🔹 Puertos actualmente en uso
echo -------------------------------------------

:: Verificar Frontend
echo Verificando Frontend en puerto !VITE_PORT!:
netstat -ano | findstr :!VITE_PORT! >nul 2>&1
if !errorlevel! == 0 (
    echo   ✅ Puerto !VITE_PORT! en uso ^(Frontend^)
    set FRONTEND_RUNNING=1
) else (
    echo   ❌ Puerto !VITE_PORT! LIBRE ^(esperaba Frontend^)
    set FRONTEND_RUNNING=0
)

:: Verificar Backend
echo Verificando Backend en puerto !BACKEND_PORT!:
netstat -ano | findstr :!BACKEND_PORT! >nul 2>&1
if !errorlevel! == 0 (
    echo   ✅ Puerto !BACKEND_PORT! en uso ^(Backend^)
    set BACKEND_RUNNING=1
) else (
    echo   ❌ Puerto !BACKEND_PORT! LIBRE ^(esperaba Backend^)
    set BACKEND_RUNNING=0
)

:: Verificar puertos alternativos
echo.
echo Verificando puertos alternativos:
for %%p in (5174 5175 5176 5177 5178) do (
    netstat -ano | findstr :%%p >nul 2>&1
    if !errorlevel! == 0 echo   ⚠️  Puerto %%p en uso
)

for %%p in (3001 3003 3004) do (
    netstat -ano | findstr :%%p >nul 2>&1
    if !errorlevel! == 0 echo   ⚠️  Puerto %%p en uso
)

:: ===========================================
:: 3. VERIFICAR CONECTIVIDAD
:: ===========================================
echo.
echo 🔹 Verificación de conectividad
echo -------------------------------------------

if !BACKEND_RUNNING! == 1 (
    echo   🌐 Probando endpoint de salud del backend...
    curl -s http://localhost:!BACKEND_PORT!/api/health >nul 2>&1
    if !errorlevel! == 0 (
        echo   ✅ Backend responde correctamente
    ) else (
        echo   ❌ Backend no responde en puerto !BACKEND_PORT!
    )
) else (
    echo   ❌ Backend no está ejecutándose
)

:: ===========================================
:: 4. DETECTAR DESFASES
:: ===========================================
echo.
echo 🔹 Análisis de desfases
echo -------------------------------------------

set DESFASES_FOUND=0

if not "!VITE_API_PORT!" == "!BACKEND_PORT!" (
    echo   ❌ DESFASE: Frontend apunta a puerto !VITE_API_PORT! pero backend está en !BACKEND_PORT!
    set DESFASES_FOUND=1
)

if !FRONTEND_RUNNING! == 0 (
    echo   ❌ PROBLEMA: Frontend no está ejecutándose en puerto esperado !VITE_PORT!
    set DESFASES_FOUND=1
)

if !BACKEND_RUNNING! == 0 (
    echo   ❌ PROBLEMA: Backend no está ejecutándose en puerto esperado !BACKEND_PORT!
    set DESFASES_FOUND=1
)

if !DESFASES_FOUND! == 0 (
    echo   ✅ No se detectaron desfases en la configuración
)

:: ===========================================
:: 5. OPCIONES DE ACCIÓN
:: ===========================================
echo.
echo ===============================================
echo   🔧 OPCIONES DE ACCIÓN
echo ===============================================

echo.
echo ¿Qué deseas hacer?
echo   1^) Ver estado detallado actual
echo   2^) Reiniciar servicios con configuración actual
echo   3^) Configurar puertos recomendados y reiniciar
echo   4^) Solo matar procesos en puertos
echo   5^) Abrir aplicación en navegador
echo   6^) Salir

set /p choice="Selecciona una opción [1-6]: "

if "!choice!" == "1" goto estado_detallado
if "!choice!" == "2" goto reiniciar_actual
if "!choice!" == "3" goto configurar_recomendado
if "!choice!" == "4" goto matar_procesos
if "!choice!" == "5" goto abrir_navegador
if "!choice!" == "6" goto salir
goto opcion_invalida

:estado_detallado
echo.
echo 🔹 Estado detallado
echo -------------------------------------------
echo Configuración actual:
echo   Frontend: Puerto !VITE_PORT! -^> API !VITE_API_PORT!
echo   Backend: Puerto !BACKEND_PORT!
if !BACKEND_RUNNING! == 1 (echo   Conectividad: OK) else (echo   Conectividad: FALLA)
goto fin

:reiniciar_actual
echo.
echo 🔹 Reiniciando servicios
echo -------------------------------------------

echo   🔄 Matando procesos existentes...
for /f "tokens=5" %%i in ('netstat -ano ^| findstr :!VITE_PORT!') do taskkill /PID %%i /F >nul 2>&1
for /f "tokens=5" %%i in ('netstat -ano ^| findstr :!BACKEND_PORT!') do taskkill /PID %%i /F >nul 2>&1

timeout /t 2 >nul

echo   🚀 Iniciando backend en puerto !BACKEND_PORT!...
start /D backend cmd /k "npm run dev"

timeout /t 3 >nul

echo   🚀 Iniciando frontend en puerto !VITE_PORT!...
set VITE_PORT=!VITE_PORT!
start cmd /k "npm run dev"

echo.
echo ✅ Servicios iniciados:
echo   Backend: puerto !BACKEND_PORT!
echo   Frontend: puerto !VITE_PORT!
echo.
echo 🌐 Accede a: http://localhost:!VITE_PORT!
goto fin

:configurar_recomendado
echo.
echo 🔹 Configurando puertos recomendados
echo -------------------------------------------

set RECOMMENDED_FRONTEND=5173
set RECOMMENDED_BACKEND=3002

echo Configuración recomendada:
echo   Frontend: !RECOMMENDED_FRONTEND!
echo   Backend: !RECOMMENDED_BACKEND!

set /p confirm="¿Aplicar esta configuración? [y/N]: "
if not "!confirm!" == "y" if not "!confirm!" == "Y" goto fin

echo   ⚙️  Actualizando configuración...

:: Actualizar .env.local
(
echo VITE_PORT=!RECOMMENDED_FRONTEND!
echo VITE_API_PORT=!RECOMMENDED_BACKEND!
echo VITE_API_BASE_URL=http://localhost:!RECOMMENDED_BACKEND!
echo VITE_DEBUG_LOGS=false
echo VITE_ENABLE_PERFORMANCE_LOGS=false
echo VITE_ENABLE_STATE_LOGS=false
) > .env.local

:: Actualizar backend/.env (simple replacement)
powershell -Command "(Get-Content backend\.env) -replace 'PORT=.*', 'PORT=!RECOMMENDED_BACKEND!' | Set-Content backend\.env"

echo   ✅ Configuración actualizada

:: Matar procesos
for /f "tokens=5" %%i in ('netstat -ano ^| findstr :!RECOMMENDED_FRONTEND!') do taskkill /PID %%i /F >nul 2>&1
for /f "tokens=5" %%i in ('netstat -ano ^| findstr :!RECOMMENDED_BACKEND!') do taskkill /PID %%i /F >nul 2>&1

timeout /t 2 >nul

:: Reiniciar servicios
start /D backend cmd /k "npm run dev"
timeout /t 3 >nul
start cmd /k "npm run dev"

echo.
echo 🌐 Accede a: http://localhost:!RECOMMENDED_FRONTEND!
goto fin

:matar_procesos
echo.
echo 🔹 Matando procesos
echo -------------------------------------------

set /p ports="¿Qué puertos quieres liberar? (ej: 3002 5173): "
for %%p in (!ports!) do (
    echo   💀 Matando procesos en puerto %%p...
    for /f "tokens=5" %%i in ('netstat -ano ^| findstr :%%p') do taskkill /PID %%i /F >nul 2>&1
)
goto fin

:abrir_navegador
echo.
echo 🔹 Abriendo aplicación
echo -------------------------------------------

if !FRONTEND_RUNNING! == 1 (
    start http://localhost:!VITE_PORT!
    echo   🌐 Abriendo http://localhost:!VITE_PORT!
) else (
    echo   ❌ Frontend no está ejecutándose
    echo   💡 Ejecuta primero la opción 2 o 3 para iniciar los servicios
)
goto fin

:salir
echo.
echo 👋 ¡Hasta luego!
exit /b 0

:opcion_invalida
echo.
echo ❌ Opción no válida
goto fin

:fin
echo.
echo ===============================================
echo   ✅ PROCESO COMPLETADO
echo ===============================================
pause