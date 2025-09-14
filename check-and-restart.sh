#!/bin/bash

# ===========================================
# 🔧 SCRIPT DE VERIFICACIÓN Y REINICIO - Entrena con IA
# ===========================================

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

# Función para imprimir headers
print_header() {
    echo -e "\n${CYAN}===============================================${NC}"
    echo -e "${WHITE}$1${NC}"
    echo -e "${CYAN}===============================================${NC}"
}

# Función para imprimir secciones
print_section() {
    echo -e "\n${BLUE}🔹 $1${NC}"
    echo -e "${BLUE}-------------------------------------------${NC}"
}

# Función para verificar si un puerto está en uso
check_port() {
    local port=$1
    local service=$2

    if command -v lsof >/dev/null 2>&1; then
        local process=$(lsof -ti:$port 2>/dev/null)
    elif command -v netstat >/dev/null 2>&1; then
        local process=$(netstat -tulpn 2>/dev/null | grep :$port | awk '{print $7}' | cut -d'/' -f1)
    else
        echo -e "  ${YELLOW}⚠️  No se puede verificar el puerto $port (lsof/netstat no disponible)${NC}"
        return 1
    fi

    if [ ! -z "$process" ]; then
        echo -e "  ${GREEN}✅ Puerto $port en uso por $service (PID: $process)${NC}"
        return 0
    else
        echo -e "  ${RED}❌ Puerto $port LIBRE (esperaba $service)${NC}"
        return 1
    fi
}

# Función para matar procesos por puerto
kill_port() {
    local port=$1
    echo -e "  ${YELLOW}🔄 Matando procesos en puerto $port...${NC}"

    if command -v lsof >/dev/null 2>&1; then
        lsof -ti:$port | xargs kill -9 2>/dev/null
    elif command -v fuser >/dev/null 2>&1; then
        fuser -k $port/tcp 2>/dev/null
    else
        echo -e "  ${RED}❌ No se puede matar el proceso (lsof/fuser no disponible)${NC}"
    fi
}

print_header "🔍 VERIFICACIÓN DE CONFIGURACIÓN ACTUAL"

# ===========================================
# 1. VERIFICAR CONFIGURACIÓN EN ARCHIVOS
# ===========================================
print_section "📁 Configuración en archivos"

# Frontend
echo -e "${PURPLE}Frontend (.env.local):${NC}"
if [ -f ".env.local" ]; then
    VITE_PORT=$(grep "VITE_PORT=" .env.local 2>/dev/null | cut -d'=' -f2)
    VITE_API_PORT=$(grep "VITE_API_PORT=" .env.local 2>/dev/null | cut -d'=' -f2)
    VITE_API_URL=$(grep "VITE_API_BASE_URL=" .env.local 2>/dev/null | cut -d'=' -f2)

    echo -e "  Puerto Frontend: ${GREEN}${VITE_PORT:-5173}${NC}"
    echo -e "  API Port: ${GREEN}${VITE_API_PORT:-3002}${NC}"
    echo -e "  API URL: ${GREEN}${VITE_API_URL:-http://localhost:3002}${NC}"
else
    echo -e "  ${YELLOW}⚠️  .env.local no encontrado - usando defaults${NC}"
    VITE_PORT=5173
    VITE_API_PORT=3002
fi

# Backend
echo -e "\n${PURPLE}Backend (backend/.env):${NC}"
if [ -f "backend/.env" ]; then
    BACKEND_PORT=$(grep "^PORT=" backend/.env 2>/dev/null | cut -d'=' -f2 | tr -d ' \r\n')
    if [ -z "$BACKEND_PORT" ]; then
        BACKEND_PORT=3002
    fi
    echo -e "  Puerto Backend: ${GREEN}${BACKEND_PORT}${NC}"
else
    echo -e "  ${YELLOW}⚠️  backend/.env no encontrado - usando default 3002${NC}"
    BACKEND_PORT=3002
fi

# Configuración en vite.config.js
echo -e "\n${PURPLE}Vite Config (vite.config.js):${NC}"
if [ -f "vite.config.js" ]; then
    VITE_CONFIG_PORT=$(grep "VITE_PORT" vite.config.js | head -1 | sed -n 's/.*|| \([0-9]*\)).*/\1/p')
    VITE_CONFIG_API_PORT=$(grep "VITE_API_PORT" vite.config.js | head -1 | sed -n 's/.*|| \([0-9]*\)}.*/\1/p')
    echo -e "  Puerto por defecto: ${GREEN}${VITE_CONFIG_PORT:-5173}${NC}"
    echo -e "  API Port por defecto: ${GREEN}${VITE_CONFIG_API_PORT:-3002}${NC}"
else
    echo -e "  ${RED}❌ vite.config.js no encontrado${NC}"
fi

# ===========================================
# 2. VERIFICAR PUERTOS ACTUALMENTE EN USO
# ===========================================
print_section "🔌 Puertos actualmente en uso"

# Definir puertos esperados
EXPECTED_FRONTEND_PORT=${VITE_PORT:-5173}
EXPECTED_BACKEND_PORT=${BACKEND_PORT:-3002}

# Verificar puertos
check_port $EXPECTED_FRONTEND_PORT "Frontend"
FRONTEND_RUNNING=$?

check_port $EXPECTED_BACKEND_PORT "Backend"
BACKEND_RUNNING=$?

# Verificar puertos comunes alternativos
echo -e "\n${PURPLE}Verificando puertos alternativos:${NC}"
for port in 5174 5175 5176 5177 5178; do
    if lsof -ti:$port >/dev/null 2>&1; then
        echo -e "  ${YELLOW}⚠️  Puerto $port en uso${NC}"
    fi
done

for port in 3001 3003 3004; do
    if lsof -ti:$port >/dev/null 2>&1; then
        echo -e "  ${YELLOW}⚠️  Puerto $port en uso${NC}"
    fi
done

# ===========================================
# 3. VERIFICAR CONECTIVIDAD
# ===========================================
print_section "🌐 Verificación de conectividad"

# Test backend health
if [ $BACKEND_RUNNING -eq 0 ]; then
    echo -e "  ${BLUE}Probando endpoint de salud del backend...${NC}"
    if curl -s http://localhost:$EXPECTED_BACKEND_PORT/api/health >/dev/null 2>&1; then
        echo -e "  ${GREEN}✅ Backend responde correctamente${NC}"
    else
        echo -e "  ${RED}❌ Backend no responde en puerto $EXPECTED_BACKEND_PORT${NC}"
    fi
else
    echo -e "  ${RED}❌ Backend no está ejecutándose${NC}"
fi

# ===========================================
# 4. DETECTAR DESFASES
# ===========================================
print_section "⚠️  Análisis de desfases"

DESFASES_FOUND=false

# Verificar consistencia de configuración
if [ "${VITE_API_PORT}" != "${BACKEND_PORT}" ]; then
    echo -e "  ${RED}❌ DESFASE: Frontend apunta a puerto ${VITE_API_PORT} pero backend está en ${BACKEND_PORT}${NC}"
    DESFASES_FOUND=true
fi

# Verificar si los servicios están en puertos incorrectos
if [ $FRONTEND_RUNNING -ne 0 ]; then
    echo -e "  ${RED}❌ PROBLEMA: Frontend no está ejecutándose en puerto esperado $EXPECTED_FRONTEND_PORT${NC}"
    DESFASES_FOUND=true
fi

if [ $BACKEND_RUNNING -ne 0 ]; then
    echo -e "  ${RED}❌ PROBLEMA: Backend no está ejecutándose en puerto esperado $EXPECTED_BACKEND_PORT${NC}"
    DESFASES_FOUND=true
fi

if [ "$DESFASES_FOUND" = false ]; then
    echo -e "  ${GREEN}✅ No se detectaron desfases en la configuración${NC}"
fi

# ===========================================
# 5. OPCIONES DE ACCIÓN
# ===========================================
print_header "🔧 OPCIONES DE ACCIÓN"

echo -e "${WHITE}¿Qué deseas hacer?${NC}"
echo -e "  ${GREEN}1)${NC} Ver estado detallado actual"
echo -e "  ${GREEN}2)${NC} Reiniciar servicios con configuración actual"
echo -e "  ${GREEN}3)${NC} Configurar puertos recomendados y reiniciar"
echo -e "  ${GREEN}4)${NC} Solo matar procesos en puertos"
echo -e "  ${GREEN}5)${NC} Salir"

read -p "$(echo -e ${YELLOW}Selecciona una opción [1-5]: ${NC})" choice

case $choice in
    1)
        print_section "📊 Estado detallado"
        echo -e "Configuración actual:"
        echo -e "  Frontend: Puerto $EXPECTED_FRONTEND_PORT → API $VITE_API_PORT"
        echo -e "  Backend: Puerto $EXPECTED_BACKEND_PORT"
        echo -e "  Conectividad: $([ $BACKEND_RUNNING -eq 0 ] && echo "OK" || echo "FALLA")"
        ;;

    2)
        print_section "🔄 Reiniciando servicios"

        # Matar procesos existentes
        echo -e "${YELLOW}Matando procesos existentes...${NC}"
        kill_port $EXPECTED_FRONTEND_PORT
        kill_port $EXPECTED_BACKEND_PORT

        sleep 2

        # Iniciar backend
        echo -e "${BLUE}Iniciando backend en puerto $EXPECTED_BACKEND_PORT...${NC}"
        cd backend && npm run dev &
        BACKEND_PID=$!

        sleep 3

        # Iniciar frontend
        echo -e "${BLUE}Iniciando frontend en puerto $EXPECTED_FRONTEND_PORT...${NC}"
        cd .. && VITE_PORT=$EXPECTED_FRONTEND_PORT npm run dev &
        FRONTEND_PID=$!

        echo -e "\n${GREEN}✅ Servicios iniciados:${NC}"
        echo -e "  Backend PID: $BACKEND_PID (puerto $EXPECTED_BACKEND_PORT)"
        echo -e "  Frontend PID: $FRONTEND_PID (puerto $EXPECTED_FRONTEND_PORT)"
        echo -e "\n${CYAN}🌐 Accede a: http://localhost:$EXPECTED_FRONTEND_PORT${NC}"
        ;;

    3)
        print_section "⚙️  Configurando puertos recomendados"

        # Configuración recomendada
        RECOMMENDED_FRONTEND=5173
        RECOMMENDED_BACKEND=3002

        echo -e "Configuración recomendada:"
        echo -e "  Frontend: $RECOMMENDED_FRONTEND"
        echo -e "  Backend: $RECOMMENDED_BACKEND"

        read -p "$(echo -e ${YELLOW}¿Aplicar esta configuración? [y/N]: ${NC})" confirm

        if [[ $confirm =~ ^[Yy]$ ]]; then
            # Actualizar .env.local
            echo "VITE_PORT=$RECOMMENDED_FRONTEND" > .env.local
            echo "VITE_API_PORT=$RECOMMENDED_BACKEND" >> .env.local
            echo "VITE_API_BASE_URL=http://localhost:$RECOMMENDED_BACKEND" >> .env.local
            echo "VITE_DEBUG_LOGS=false" >> .env.local
            echo "VITE_ENABLE_PERFORMANCE_LOGS=false" >> .env.local
            echo "VITE_ENABLE_STATE_LOGS=false" >> .env.local

            # Actualizar backend/.env
            sed -i "s/PORT=.*/PORT=$RECOMMENDED_BACKEND/" backend/.env

            echo -e "${GREEN}✅ Configuración actualizada${NC}"

            # Reiniciar servicios
            kill_port $RECOMMENDED_FRONTEND
            kill_port $RECOMMENDED_BACKEND

            sleep 2

            cd backend && npm run dev &
            sleep 3
            cd .. && npm run dev &

            echo -e "\n${CYAN}🌐 Accede a: http://localhost:$RECOMMENDED_FRONTEND${NC}"
        fi
        ;;

    4)
        print_section "💀 Matando procesos"
        read -p "$(echo -e "${YELLOW}¿Qué puertos quieres liberar? (ej: 3002 5173): ${NC}")" ports
        for port in $ports; do
            kill_port $port
        done
        ;;

    5)
        echo -e "${GREEN}👋 ¡Hasta luego!${NC}"
        exit 0
        ;;

    *)
        echo -e "${RED}❌ Opción no válida${NC}"
        ;;
esac

print_header "✅ PROCESO COMPLETADO"