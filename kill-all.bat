@echo off
echo.
echo ========================================
echo   MATANDO TODOS LOS PROCESOS NODE
echo ========================================

echo Matando node.exe...
taskkill /F /IM node.exe >nul 2>&1

echo Matando nodemon.exe...
taskkill /F /IM nodemon.exe >nul 2>&1

echo Matando npm.cmd...
taskkill /F /IM npm.cmd >nul 2>&1

echo Liberando puertos...
for /f "tokens=5" %%i in ('netstat -ano 2^>nul ^| findstr :3002') do taskkill /PID %%i /F >nul 2>&1
for /f "tokens=5" %%i in ('netstat -ano 2^>nul ^| findstr :5173') do taskkill /PID %%i /F >nul 2>&1
for /f "tokens=5" %%i in ('netstat -ano 2^>nul ^| findstr :3005') do taskkill /PID %%i /F >nul 2>&1
for /f "tokens=5" %%i in ('netstat -ano 2^>nul ^| findstr :5176') do taskkill /PID %%i /F >nul 2>&1
for /f "tokens=5" %%i in ('netstat -ano 2^>nul ^| findstr :5180') do taskkill /PID %%i /F >nul 2>&1

echo.
echo Procesos terminados. Puertos liberados.
echo.
echo Ahora puedes usar:
echo   - start-simple.bat (recomendado)
echo   - O iniciar manualmente desde CMD
echo.
pause