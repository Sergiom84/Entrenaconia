#!/bin/bash
# Script para configurar API Key de Render

echo "========================================"
echo "   🔑 Configurar Render API Key"
echo "========================================"
echo ""
echo "Obtén tu API Key en:"
echo "https://dashboard.render.com/u/settings#api-keys"
echo ""
echo -n "Ingresa tu API Key: "
read -s API_KEY
echo ""

if [ -z "$API_KEY" ]; then
    echo "❌ No ingresaste ninguna API Key"
    exit 1
fi

# Remover la línea anterior de RENDER_API_KEY si existe
sed -i '/export RENDER_API_KEY=/d' ~/.bashrc

# Añadir la nueva API Key
echo "" >> ~/.bashrc
echo "# Render CLI API Key" >> ~/.bashrc
echo "export RENDER_API_KEY=\"$API_KEY\"" >> ~/.bashrc

# Exportar para la sesión actual
export RENDER_API_KEY="$API_KEY"

echo ""
echo "✅ API Key configurada correctamente"
echo ""
echo "Verificando autenticación..."
render whoami

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 ¡Login exitoso con API Key!"
else
    echo ""
    echo "❌ Error: La API Key no parece ser válida"
    echo "Verifica que la copiaste correctamente"
fi
