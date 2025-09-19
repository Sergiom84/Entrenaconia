# 🔧 Scripts de Sincronización de Puertos

## 🎯 Problema Resuelto

Cuando el backend cambia de puerto y el frontend sigue apuntando al puerto anterior, las peticiones API devuelven 404. Estos scripts detectan y solucionan automáticamente este problema.

## 🚀 Scripts Disponibles

### 1. **Verificación Manual de Puertos**
```bash
npm run check-ports
```
- ✅ Detecta automáticamente el puerto del backend
- ✅ Actualiza `.env.local` con la configuración correcta
- ✅ Verifica conectividad con el backend
- ✅ Muestra la configuración actual

### 2. **Desarrollo Sincronizado**
```bash
npm run dev:sync
```
- ✅ Ejecuta verificación de puertos antes de iniciar
- ✅ Inicia solo el frontend con configuración actualizada

### 3. **Desarrollo Automático Completo**
```bash
npm run dev:auto
```
- ✅ Verifica puertos automáticamente
- ✅ Inicia backend y frontend sincronizados
- ✅ Ideal para desarrollo diario

### 4. **Monitor de Salud Continuo**
```bash
npm run monitor
```
- 🔍 Vigila continuamente la conectividad
- 🔄 Detecta cambios de puerto automáticamente
- 🚨 Alerta cuando hay problemas
- ⏱️ Verifica cada 10 segundos

### 5. **Script Interactivo (Windows)**
```bash

# O directamente:
scripts\sync-dev.bat
```
- 📋 Menú interactivo con opciones
- 🎯 Permite elegir qué iniciar
- 🔄 Incluye verificación automática

## 🔍 Detección Automática

Los scripts detectan el puerto del backend en este orden:

1. **Proceso activo**: Busca procesos node con `server.js`
2. **Variables de entorno**: Lee `PORT` de `backend/.env`
3. **Código fuente**: Analiza `backend/server.js`
4. **Por defecto**: Usa puerto 3003

## 📝 Configuración Automática

Actualiza automáticamente estas variables en `.env.local`:
```env
VITE_API_PORT=3003
VITE_API_BASE_URL=http://localhost:3003
```

## 🛠️ Casos de Uso

### **Inicio de Desarrollo Diario**
```bash
npm run dev:auto
```
🎯 La forma más simple - verifica todo y inicia ambos servicios

### **Solo Frontend (Backend ya corriendo)**
```bash
npm run dev:sync
```
🎯 Verifica configuración e inicia solo frontend

### **Troubleshooting**
```bash
npm run check-ports
```
🎯 Diagnóstica problemas de conectividad

### **Monitoreo Continuo**
```bash
npm run monitor
```
🎯 Para detectar problemas durante desarrollo largo

## 🚨 Alertas y Diagnósticos

### **Backend No Responde**
```
🔴 Fallo 3/3 - Backend no responde en puerto 3003
🚨 ALERTA: Backend no disponible por tiempo prolongado
💡 Acciones recomendadas:
   1. Verificar que el backend esté ejecutándose
   2. Revisar logs del backend para errores
   3. Reiniciar el backend si es necesario
```

### **Puerto Cambió**
```
🔄 Puerto del backend cambió: 3002 → 3003
📝 Configuración actualizada automáticamente
```

### **Sistema Recuperado**
```
✅ Sistema recuperado - Backend responde en puerto 3003
```

## 📁 Archivos Creados

```
scripts/
├── check-ports.js      # Verificador principal
├── health-monitor.js   # Monitor continuo
└── sync-dev.bat       # Script interactivo Windows
```

## 🔄 Flujo Recomendado

### **Para Desarrollo Diario:**
1. `npm run dev:auto` - Inicia todo sincronizado
2. Si hay problemas: `npm run check-ports`
3. Para monitoreo: `npm run monitor` en terminal separada

### **Para Troubleshooting:**
1. `npm run check-ports` - Diagnóstica
2. Revisa logs del backend
3. `npm run monitor` - Vigila en tiempo real

## 💡 Consejos

- **Usa `dev:auto`** para inicio diario sin preocupaciones
- **Ejecuta `monitor`** en terminal separada durante desarrollo largo
- **Los scripts son seguros** - solo leen y actualizan `.env.local`
- **Funcionan en Windows, Mac y Linux**

¡No más problemas de puertos desincronizados! 🎉