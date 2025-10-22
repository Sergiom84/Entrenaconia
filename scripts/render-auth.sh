#!/bin/bash
# Script para autenticación de Render CLI en WSL

echo "========================================"
echo "   🔐 Autenticación de Render CLI"
echo "========================================"
echo ""

# Verificar que render CLI está instalado
if ! command -v render &> /dev/null; then
    echo "❌ Render CLI no está instalado"
    exit 1
fi

echo "Generando código de autorización..."
echo ""

# Ejecutar render login y capturar la salida
export PATH=$PATH:/home/sergio/.local/bin
render login 2>&1 | tee /tmp/render-login.log

echo ""
echo "========================================"
echo "📋 INSTRUCCIONES:"
echo "========================================"
echo ""
echo "1. Busca arriba el código que empieza con letras y números (ej: 6I7R-VH5H-MN2B-GUEW)"
echo "2. Busca la URL que empieza con https://dashboard.render.com/device-authorization/"
echo "3. Abre esa URL en tu navegador de Windows"
echo "4. Ingresa el código cuando te lo pida"
echo "5. Autoriza la aplicación"
echo ""
echo "✅ Una vez autorizado, la CLI detectará automáticamente el login"
echo ""
