@echo off
echo Iniciando Entrena con IA...

:: Matar procesos Node.js existentes
echo Limpiando procesos anteriores...
taskkill /F /IM node.exe >nul 2>&1
taskkill /F /IM nodemon.exe >nul 2>&1

:: Configurar archivo .env.local
echo Configurando frontend...
echo VITE_PORT=5173> .env.local
echo VITE_API_PORT=3002>> .env.local
echo VITE_API_BASE_URL=http://localhost:3002>> .env.local
echo VITE_DEBUG_LOGS=false>> .env.local

:: Configurar backend/.env - Version simple
echo Configurando backend...
echo PORT=3002> backend\.env.simple
echo NODE_ENV=development>> backend\.env.simple
echo JWT_SECRET=entrenaconjwtsecret2024supersecure>> backend\.env.simple
echo DATABASE_URL=postgresql://postgres.lhsnmjgdtjalfcsurxvg:Xe05Klm563kkjL@aws-1-eu-north-1.pooler.supabase.com:6543/postgres>> backend\.env.simple
echo DB_HOST=db.lhsnmjgdtjalfcsurxvg.supabase.co>> backend\.env.simple
echo DB_PORT=5432>> backend\.env.simple
echo DB_NAME=postgres>> backend\.env.simple
echo DB_USER=postgres>> backend\.env.simple
echo DB_PASSWORD=Xe05Klm563kkjL>> backend\.env.simple
echo DB_SEARCH_PATH=app,public>> backend\.env.simple
echo SUPABASE_URL=https://lhsnmjgdtjalfcsurxvg.supabase.co>> backend\.env.simple
echo SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxoc25tamdkdGphbGZjc3VyeHZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0ODEzMjcsImV4cCI6MjA3MjA1NzMyN30.SNxXfC5C6vI8dmRZAlUvHicdpKAquciI4wg7oNvTB5M>> backend\.env.simple
echo OPENAI_API_KEY=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>> backend\.env.simple
echo UPLOAD_DIR=uploads>> backend\.env.simple
echo MAX_FILE_SIZE=26214400>> backend\.env.simple

copy backend\.env.simple backend\.env >nul
del backend\.env.simple

:: Iniciar backend
echo Iniciando backend en puerto 3002...
start "Backend" cmd /k "cd /d %cd%\backend && npm run dev"

:: Esperar usando ping (compatible)
echo Esperando que el backend inicie...
ping 127.0.0.1 -n 4 >nul

:: Iniciar frontend
echo Iniciando frontend en puerto 5173...
start "Frontend" cmd /k "cd /d %cd% && npm run dev"

echo.
echo ========================================
echo   SERVICIOS INICIADOS
echo ========================================
echo Frontend: http://localhost:5173
echo Backend:  http://localhost:3002
echo.
echo Esperando que carguen...
ping 127.0.0.1 -n 6 >nul

echo Abriendo navegador...
start http://localhost:5173

echo.
echo Listo! Aplicacion ejecutandose.
echo Cierra esta ventana cuando termines.
pause