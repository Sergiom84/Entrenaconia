@echo off
echo.
echo ============================================
echo   🛑 MATANDO TODOS LOS PROCESOS
echo ============================================
echo.

echo 📦 Matando procesos Node.js...
taskkill /f /im node.exe 2>nul
if %errorlevel%==0 (
    echo ✅ Procesos Node.js eliminados
) else (
    echo ⚠️  No se encontraron procesos Node.js activos
)

echo.
echo 🌐 Liberando puertos específicos...
npx kill-port 3002 3003 5173 5174 2>nul
if %errorlevel%==0 (
    echo ✅ Puertos 3002, 3003, 5173, 5174 liberados
) else (
    echo ⚠️  Algunos puertos ya estaban libres
)

echo.
echo 🔍 Verificando puertos liberados...
echo Puerto 3002:
netstat -ano | findstr :3002 || echo   ✅ Puerto 3002 libre
echo Puerto 3003:
netstat -ano | findstr :3003 || echo   ✅ Puerto 3003 libre
echo Puerto 5173:
netstat -ano | findstr :5173 || echo   ✅ Puerto 5173 libre
echo Puerto 5174:
netstat -ano | findstr :5174 || echo   ✅ Puerto 5174 libre

echo.
echo ============================================
echo   ✅ LIMPIEZA COMPLETADA
echo ============================================
echo   Para reiniciar usa: start-dev.bat
echo.
pause