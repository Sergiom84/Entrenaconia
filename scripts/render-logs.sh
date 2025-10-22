#!/bin/bash
# Script de acceso rápido a logs de Render
# Uso: ./render-logs.sh [servicio] [opciones]

# Colores para mejor legibilidad
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}📊 Render Logs - Entrena con IA${NC}\n"

# Verificar que render CLI está instalado
if ! command -v render &> /dev/null; then
    echo -e "${RED}❌ Render CLI no está instalado${NC}"
    echo "Instala con: curl -fsSL https://raw.githubusercontent.com/render-oss/cli/refs/heads/main/bin/install.sh | sh"
    exit 1
fi

# Verificar autenticación
if ! render whoami &> /dev/null; then
    echo -e "${YELLOW}⚠️  No estás autenticado en Render${NC}"
    echo -e "Ejecuta: ${GREEN}render login${NC}"
    exit 1
fi

# Función para mostrar ayuda
show_help() {
    echo "Uso: $0 [comando] [opciones]"
    echo ""
    echo "Comandos disponibles:"
    echo "  list              - Listar todos los servicios"
    echo "  tail [servicio]   - Ver logs en tiempo real (streaming)"
    echo "  view [servicio]   - Ver últimos logs (100 líneas)"
    echo "  errors [servicio] - Filtrar solo errores"
    echo ""
    echo "Opciones generales:"
    echo "  --limit N         - Número de líneas a mostrar (default: 100)"
    echo "  --start TIME      - Desde cuándo ver logs"
    echo "  --end TIME        - Hasta cuándo ver logs"
    echo "  --text STRING     - Buscar texto específico"
    echo ""
    echo "Ejemplos:"
    echo "  $0 list"
    echo "  $0 tail backend"
    echo "  $0 view backend --limit 500"
    echo "  $0 errors backend"
}

# Si no hay argumentos, mostrar ayuda
if [ $# -eq 0 ]; then
    show_help
    exit 0
fi

COMMAND=$1
shift

case $COMMAND in
    list)
        echo -e "${GREEN}🔍 Listando servicios...${NC}\n"
        render services --output text
        ;;

    tail)
        SERVICE=$1
        shift
        echo -e "${GREEN}📡 Streaming logs de: $SERVICE${NC}"
        echo -e "${YELLOW}Presiona Ctrl+C para salir${NC}\n"
        render logs --resources "$SERVICE" --tail "$@"
        ;;

    view)
        SERVICE=$1
        shift
        LIMIT=${1:-100}
        echo -e "${GREEN}📋 Últimos $LIMIT logs de: $SERVICE${NC}\n"
        render logs --resources "$SERVICE" --limit "$LIMIT" --output text "$@"
        ;;

    errors)
        SERVICE=$1
        shift
        echo -e "${RED}🚨 Filtrando errores de: $SERVICE${NC}\n"
        render logs --resources "$SERVICE" --level error --limit 200 --output text "$@"
        ;;

    *)
        echo -e "${RED}❌ Comando desconocido: $COMMAND${NC}\n"
        show_help
        exit 1
        ;;
esac
