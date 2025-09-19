@echo off
REM 🔄 Script de Sincronización Automática para Desarrollo
REM Detecta puertos y inicia frontend/backend sincronizados

echo.
echo 🚀 Entrena con IA - Sincronizador de Desarrollo
echo =============================================
echo.

REM Verificar si Node.js está disponible
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js no encontrado. Instala Node.js primero.
    pause
    exit /b 1
)

REM Verificar si estamos en el directorio correcto
if not exist "package.json" (
    echo ❌ No se encontró package.json. Ejecuta desde la raíz del proyecto.
    pause
    exit /b 1
)

echo 🔍 Verificando puertos y configuración...
node scripts/check-ports.js

if errorlevel 1 (
    echo ❌ Error en verificación de puertos
    pause
    exit /b 1
)

echo.
echo 🎯 ¿Qué deseas hacer?
echo 1. Solo verificar puertos
echo 2. Iniciar backend
echo 3. Iniciar frontend
echo 4. Iniciar ambos (recomendado)
echo 5. Salir
echo.

set /p choice="Selecciona una opción (1-5): "

if "%choice%"=="1" (
    echo ✅ Verificación completada
    goto end
)

if "%choice%"=="2" (
    echo 🔄 Iniciando backend...
    cd backend
    npm run dev
    goto end
)

if "%choice%"=="3" (
    echo 🔄 Iniciando frontend...
    npm run dev
    goto end
)

if "%choice%"=="4" (
    echo 🔄 Iniciando backend y frontend...
    echo 📡 Abriendo backend en nueva ventana...
    start "Backend - Entrena con IA" cmd /c "cd backend && npm run dev && pause"

    echo ⏳ Esperando 3 segundos para que inicie el backend...
    timeout /t 3 /nobreak >nul

    echo 🌐 Iniciando frontend...
    npm run dev
    goto end
)

if "%choice%"=="5" (
    goto end
)

echo ❌ Opción no válida
pause

:end
echo.
echo 👋 ¡Hasta luego!
pause