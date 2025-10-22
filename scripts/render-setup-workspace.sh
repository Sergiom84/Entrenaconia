#!/bin/bash
# Script para configurar el workspace de Render CLI

export PATH=$PATH:/home/sergio/.local/bin
export RENDER_API_KEY="rnd_NAvuyjyXY29I2TBg6z9k1bIxiNFT"

echo "========================================"
echo "   🏢 Configurar Workspace de Render"
echo "========================================"
echo ""

echo "Verificando autenticación..."
render whoami --output text 2>/dev/null

if [ $? -ne 0 ]; then
    echo "❌ Error: No estás autenticado correctamente"
    exit 1
fi

echo ""
echo "✅ Autenticación verificada"
echo ""
echo "Para configurar tu workspace, necesitas hacerlo manualmente:"
echo ""
echo "1. Ve a tu dashboard de Render: https://dashboard.render.com"
echo "2. Copia el nombre o ID de tu workspace (team)"
echo ""
echo "Luego ejecuta en WSL:"
echo "  render workspace set"
echo ""
echo "O si tienes el ID/nombre del workspace:"
echo "  render workspace set --id <workspace-id>"
echo ""
