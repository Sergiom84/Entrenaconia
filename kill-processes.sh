#!/bin/bash

echo "🛑 Limpiando procesos Node.js..."

# Obtener PIDs de procesos node
NODE_PIDS=$(tasklist | grep "node.exe" | awk '{print $2}')

if [ ! -z "$NODE_PIDS" ]; then
    echo "📦 Terminando procesos Node.js:"
    for pid in $NODE_PIDS; do
        echo "  - Terminando PID: $pid"
        taskkill //F //PID $pid 2>/dev/null || echo "    ❌ No se pudo terminar PID $pid"
    done
else
    echo "✅ No hay procesos Node.js activos"
fi

echo ""
echo "🌐 Liberando puertos..."
npx kill-port 3002 3003 5173 5174 5175 5176 2>/dev/null && echo "✅ Puertos liberados" || echo "⚠️  Algunos puertos no se pudieron liberar"

echo ""
echo "⏳ Esperando 3 segundos..."
sleep 3

echo ""
echo "🔍 Verificando puertos:"
netstat -an | grep ":3002" && echo "❌ Puerto 3002 aún ocupado" || echo "✅ Puerto 3002 libre"
netstat -an | grep ":5173" && echo "❌ Puerto 5173 aún ocupado" || echo "✅ Puerto 5173 libre"

echo ""
echo "✅ Limpieza completada. Puedes ejecutar: npm run dev"