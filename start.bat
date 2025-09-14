@echo off
echo Iniciando Entrena con IA...

:: Matar procesos existentes silenciosamente
taskkill /F /IM node.exe >nul 2>&1
taskkill /F /IM nodemon.exe >nul 2>&1

:: Configurar puertos estándar
echo VITE_PORT=5173> .env.local
echo VITE_API_PORT=3002>> .env.local
echo VITE_API_BASE_URL=http://localhost:3002>> .env.local
echo VITE_DEBUG_LOGS=false>> .env.local
echo VITE_ENABLE_PERFORMANCE_LOGS=false>> .env.local
echo VITE_ENABLE_STATE_LOGS=false>> .env.local

:: Configurar backend/.env manualmente
echo # Puerto del servidor> backend\.env.temp
echo PORT=3002>> backend\.env.temp
echo.>> backend\.env.temp
echo # Entorno>> backend\.env.temp
echo NODE_ENV=development>> backend\.env.temp
echo.>> backend\.env.temp
echo # JWT Secret>> backend\.env.temp
echo JWT_SECRET=entrenaconjwtsecret2024supersecure>> backend\.env.temp

:: Copiar el resto del .env original (sin la línea PORT)
for /f "tokens=*" %%a in (backend\.env) do (
    echo %%a | findstr /v /c:"PORT=" | findstr /v /c:"NODE_ENV=" | findstr /v /c:"JWT_SECRET=" >> backend\.env.temp
)

move backend\.env.temp backend\.env

:: Iniciar servicios
echo Backend iniciando...
start "Backend - Entrena con IA" cmd /k "cd /d %cd%\backend && npm run dev"

:: Esperar manualmente (en lugar de timeout)
echo Esperando 3 segundos...
ping 127.0.0.1 -n 4 >nul

echo Frontend iniciando...
start "Frontend - Entrena con IA" cmd /k "cd /d %cd% && npm run dev"

echo Servicios iniciados en http://localhost:5173
echo Esperando 3 segundos mas...
ping 127.0.0.1 -n 4 >nul

echo Abriendo navegador...
start http://localhost:5173

echo.
echo Listo! Tu aplicacion esta ejecutandose.
pause