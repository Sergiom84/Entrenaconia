#!/bin/bash

# 🛡️ Script de Limpieza de Seguridad
# Este script elimina archivos sensibles del seguimiento de Git

echo "🛡️ Iniciando limpieza de seguridad..."
echo ""

# Verificar que estamos en el directorio correcto
if [ ! -d ".git" ]; then
    echo "❌ Error: Este script debe ejecutarse desde la raíz del repositorio"
    exit 1
fi

# Crear backup antes de proceder
echo "📦 Creando backup de archivos sensibles..."
mkdir -p .security-backup
cp -f backend/.env .security-backup/ 2>/dev/null || echo "⚠️ backend/.env no encontrado"
cp -f .claude/mcp_settings.json .security-backup/ 2>/dev/null || echo "⚠️ mcp_settings.json no encontrado"
cp -f .claude/settings.local.json .security-backup/ 2>/dev/null || echo "⚠️ settings.local.json no encontrado"
echo "✅ Backup creado en .security-backup/"
echo ""

# Eliminar archivos del tracking de Git (pero mantenerlos localmente)
echo "🧹 Eliminando archivos sensibles del tracking de Git..."
git rm --cached backend/.env 2>/dev/null || echo "backend/.env ya no está en tracking"
git rm --cached .claude/mcp_settings.json 2>/dev/null || echo "mcp_settings.json ya no está en tracking"
git rm --cached .claude/settings.local.json 2>/dev/null || echo "settings.local.json ya no está en tracking"
echo "✅ Archivos eliminados del tracking"
echo ""

# Verificar .gitignore
echo "🔍 Verificando .gitignore..."
if grep -q "backend/.env" .gitignore && \
   grep -q ".claude/mcp_settings.json" .gitignore && \
   grep -q ".claude/settings.local.json" .gitignore; then
    echo "✅ .gitignore configurado correctamente"
else
    echo "⚠️ .gitignore necesita actualización"
fi
echo ""

# Mostrar estado
echo "📊 Estado actual del repositorio:"
git status
echo ""

echo "✅ Limpieza completada"
echo ""
echo "📋 PRÓXIMOS PASOS IMPORTANTES:"
echo "1. Revisa SECURITY_ALERT.md para instrucciones completas"
echo "2. CAMBIA todas las credenciales expuestas (Supabase, OpenAI, JWT)"
echo "3. Ejecuta: git add . && git commit -m 'chore: eliminar archivos sensibles del tracking'"
echo "4. Considera limpiar el historial de Git (ver SECURITY_ALERT.md)"
echo ""
echo "⚠️ RECUERDA: Los archivos sensibles están respaldados en .security-backup/"
