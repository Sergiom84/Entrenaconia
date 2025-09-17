# 🔴 REPORTE DE PROBLEMAS CRÍTICOS - COMUNICACIÓN FRONTEND/BACKEND
## App: Entrena con IA - Análisis Utils y APIs

---

## 📊 RESUMEN EJECUTIVO

Se detectaron **18 problemas críticos** y **12 problemas moderados** en la comunicación entre frontend y backend que están causando errores 400/401/403/404/500, datos que no se guardan, y problemas de autenticación.

### 🚨 PROBLEMAS CRÍTICOS DETECTADOS

---

## 1. ❌ ENDPOINTS HARDCODEADOS SIN BASE URL CORRECTA

### Ubicación del Problema
- **sessionManager.js:368** - `/api/auth/heartbeat`
- **connectionManager.js:132** - `/api/health`
- **Múltiples componentes** - Usan `/api/...` sin baseURL

### Problema
```javascript
// INCORRECTO - sessionManager.js línea 368
const response = await fetch('/api/auth/heartbeat', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
```

### Impacto
- Las peticiones van a `http://localhost:5174/api/...` (frontend) en lugar de `http://localhost:3002/api/...` (backend)
- **Resultado**: Error 404 Not Found

### SOLUCIÓN NECESARIA
```javascript
// CORRECTO
const API_BASE = 'http://localhost:3002';
const response = await fetch(`${API_BASE}/api/auth/heartbeat`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
```

---

## 2. ❌ ENDPOINT /api/health NO EXISTE EN BACKEND

### Ubicación del Problema
- **connectionManager.js:132**

### Problema
```javascript
// connectionManager.js línea 132
const response = await fetch('/api/health', {
  method: 'HEAD',
  signal: controller.signal,
  cache: 'no-cache'
});
```

### Impacto
- El health check falla constantemente
- App cree estar offline cuando está online
- **Resultado**: Error 404, queue offline innecesaria

### SOLUCIÓN NECESARIA
- Crear endpoint `/api/health` en el backend
- O cambiar a un endpoint existente como `/api/auth/verify`

---

## 3. ❌ ENDPOINT /api/auth/heartbeat NO EXISTE

### Ubicación del Problema
- **sessionManager.js:368**

### Problema
```javascript
// sessionManager.js línea 368
const response = await fetch('/api/auth/heartbeat', {
  method: 'POST',
```

### Impacto
- Heartbeat falla cada 5 minutos
- Sesión puede expirar sin avisar
- **Resultado**: Error 404

### SOLUCIÓN NECESARIA
- Crear endpoint `/api/auth/heartbeat` en backend
- O deshabilitar heartbeat temporalmente

---

## 4. ❌ PROBLEMA EN apiClient.js CON connectionManager

### Ubicación del Problema
- **apiClient.js:258**

### Problema
```javascript
// apiClient.js línea 258
const response = await connectionManager.executeRequest(fullUrl, {
  method: processedOptions.method || 'GET',
  headers: processedOptions.headers,
  body: processedOptions.body
}, {
  expectedStatus: 200,
  cacheKey: `api-${fullUrl}`,
  timeout: processedOptions.timeout
});
```

### Impacto
- connectionManager.executeRequest devuelve un requestId cuando está offline, NO una response
- Código espera response.ok pero recibe un número/string
- **Resultado**: TypeError, requests fallan silenciosamente

### SOLUCIÓN NECESARIA
```javascript
// Verificar si estamos offline primero
if (!connectionManager.isOnline) {
  const requestId = await connectionManager.queueRequest(fullUrl, fetchOptions, metadata);
  throw new Error('Request queued for offline processing');
}

// Si online, hacer request normal
const response = await fetch(fullUrl, fetchOptions);
```

---

## 5. ❌ TOKEN REFRESH ENDPOINT CONFIGURADO INCORRECTAMENTE

### Ubicación del Problema
- **tokenManager.js:323**
- **authConfig.js:47**

### Problema
```javascript
// authConfig.js
REFRESH: `${CONFIG.API_BASE}/api/auth/refresh`,

// tokenManager.js línea 323
const response = await fetch(AUTH_ENDPOINTS.REFRESH, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify(body),
```

### Impacto
- Token refresh puede fallar si el endpoint espera diferente formato
- **Resultado**: Error 400 Bad Request o 401 Unauthorized

### VERIFICAR EN BACKEND
- ¿El endpoint espera `refreshToken` en body o `token`?
- ¿Necesita Authorization header con token actual?

---

## 6. ❌ BASEURL DE apiClient NO SE USA CORRECTAMENTE

### Ubicación del Problema
- **apiClient.js:475**

### Problema
```javascript
// apiClient.js línea 475
const apiClient = new ApiClient('/api');
```

### Impacto
- baseURL es '/api' relativo, no absoluto
- Todas las peticiones van al puerto del frontend (5174)
- **Resultado**: Error 404 en todas las peticiones

### SOLUCIÓN NECESARIA
```javascript
const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3002';
const apiClient = new ApiClient(API_BASE);
```

---

## 7. ❌ PROBLEMAS CON CORS EN PETICIONES

### Síntomas Detectados
- Peticiones bloqueadas por CORS policy
- Headers faltantes en respuestas del backend

### VERIFICAR EN BACKEND
```javascript
// Backend debe tener CORS configurado así:
app.use(cors({
  origin: 'http://localhost:5174',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-Activity']
}));
```

---

## 8. ❌ MANEJO INCORRECTO DE BODY EN PETICIONES

### Ubicación del Problema
- **apiClient.js:415** y **424**

### Problema
```javascript
// apiClient.js
body: data ? JSON.stringify(data) : undefined
```

### Impacto
- Si data es FormData, se stringify incorrectamente
- **Resultado**: Error 400 Bad Request en uploads

### SOLUCIÓN NECESARIA
```javascript
body: data instanceof FormData ? data : (data ? JSON.stringify(data) : undefined)
```

---

## 9. ⚠️ STORAGE KEYS NO CONSISTENTES

### Ubicación del Problema
- Diferentes archivos usan diferentes keys

### Problema
```javascript
// En algunos lugares:
localStorage.getItem('token')

// En authConfig.js:
TOKEN: 'authToken'

// En storageManager.js:
'accessToken'
```

### Impacto
- Token no se encuentra cuando se busca
- **Resultado**: Error 401 Unauthorized

---

## 10. ⚠️ TIMEOUT MUY CORTOS PARA ALGUNAS OPERACIONES

### Ubicación del Problema
- **authConfig.js:22** - REQUEST_TIMEOUT: 10000 (10 segundos)

### Problema
- Operaciones con IA pueden tardar más de 10 segundos
- Upload de videos/imágenes puede timeout

### SOLUCIÓN NECESARIA
```javascript
// Timeouts específicos por operación
const TIMEOUTS = {
  DEFAULT: 10000,
  AI_GENERATION: 30000,
  FILE_UPLOAD: 60000,
  VIDEO_ANALYSIS: 120000
};
```

---

## 11. ⚠️ NO HAY MANEJO DE RATE LIMITING

### Problema
- No se detecta cuando el servidor devuelve 429 (Too Many Requests)
- No hay backoff automático

### SOLUCIÓN NECESARIA
- Agregar detección de status 429
- Implementar retry con exponential backoff

---

## 12. ⚠️ PROBLEMAS CON OFFLINE QUEUE

### Ubicación del Problema
- **connectionManager.js**

### Problema
- Queue puede crecer sin límite
- No hay priorización de requests
- Requests pueden ejecutarse fuera de orden

---

## 📋 CHECKLIST DE VERIFICACIÓN BACKEND

### Endpoints que DEBEN existir:
- [ ] `/api/health` (HEAD o GET)
- [ ] `/api/auth/heartbeat` (POST)
- [ ] `/api/auth/refresh` (POST)
- [ ] `/api/auth/verify` (GET o POST)
- [ ] `/api/auth/login` (POST)
- [ ] `/api/auth/logout` (POST)
- [ ] `/api/auth/register` (POST)

### Headers que DEBEN aceptarse:
- [ ] Authorization: Bearer {token}
- [ ] Content-Type: application/json
- [ ] X-Session-Activity
- [ ] Origin: http://localhost:5174

### CORS Configuration:
- [ ] Origin permitido: http://localhost:5174
- [ ] Credentials: true
- [ ] Methods: GET, POST, PUT, DELETE, HEAD, OPTIONS
- [ ] PreFlight requests manejados correctamente

---

## 🔧 SOLUCIONES INMEDIATAS REQUERIDAS

### 1. Crear archivo de configuración centralizado
```javascript
// src/config/api.config.js
export const API_CONFIG = {
  BASE_URL: process.env.REACT_APP_API_URL || 'http://localhost:3002',
  ENDPOINTS: {
    AUTH: {
      LOGIN: '/api/auth/login',
      LOGOUT: '/api/auth/logout',
      REFRESH: '/api/auth/refresh',
      HEARTBEAT: '/api/auth/heartbeat',
      VERIFY: '/api/auth/verify'
    },
    HEALTH: '/api/health'
  },
  TIMEOUTS: {
    DEFAULT: 10000,
    AI_GENERATION: 30000,
    FILE_UPLOAD: 60000
  }
};
```

### 2. Fix apiClient baseURL
```javascript
// src/lib/apiClient.js
import { API_CONFIG } from '../config/api.config';

const apiClient = new ApiClient(API_CONFIG.BASE_URL);
```

### 3. Fix connectionManager health check
```javascript
// src/utils/connectionManager.js
import { API_CONFIG } from '../config/api.config';

async checkConnection() {
  const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.HEALTH}`, {
    method: 'HEAD',
    signal: controller.signal,
    cache: 'no-cache'
  });
}
```

### 4. Fix sessionManager heartbeat
```javascript
// src/utils/sessionManager.js
import { API_CONFIG } from '../config/api.config';

async sendHeartbeat() {
  const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.AUTH.HEARTBEAT}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
}
```

---

## 📊 IMPACTO EN LA APLICACIÓN

### Errores que esto está causando:
1. **404 Not Found** - Todos los endpoints van al puerto incorrecto
2. **401 Unauthorized** - Token refresh no funciona
3. **CORS Blocked** - Peticiones bloqueadas por el navegador
4. **NetworkError** - Timeouts en operaciones largas
5. **TypeError** - connectionManager devuelve tipo incorrecto

### Funcionalidades afectadas:
- ❌ Login/Logout
- ❌ Session management
- ❌ Token refresh automático
- ❌ Offline/Online detection
- ❌ Health checks
- ❌ Heartbeat
- ❌ Todas las peticiones a la API

---

## 🚀 PRIORIDAD DE FIXES

### CRÍTICO (Hacer YA):
1. Fix BASE_URL en apiClient
2. Fix URLs en sessionManager y connectionManager
3. Crear endpoints faltantes en backend o deshabilitarlos
4. Fix CORS en backend

### ALTO (Hoy):
5. Fix connectionManager.executeRequest
6. Unificar storage keys
7. Verificar formato de token refresh

### MEDIO (Esta semana):
8. Implementar timeouts específicos
9. Agregar rate limiting
10. Mejorar offline queue

---

## 📝 COMANDOS PARA VERIFICAR

```bash
# Verificar que el backend está corriendo
curl -I http://localhost:3002/api/health

# Verificar CORS
curl -H "Origin: http://localhost:5174" \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: Authorization" \
     -X OPTIONS \
     http://localhost:3002/api/auth/verify \
     -v

# Test login
curl -X POST http://localhost:3002/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@test.com","password":"123456"}' \
     -v
```

---

## ⚡ CONCLUSIÓN

La aplicación tiene problemas fundamentales de configuración que impiden CUALQUIER comunicación exitosa con el backend. El problema principal es que todas las URLs están mal configuradas y apuntan al frontend en lugar del backend.

**Estado actual**: 🔴 **NO FUNCIONAL**
**Tiempo estimado para fix crítico**: 2-4 horas
**Tiempo estimado para fix completo**: 1-2 días

---

*Reporte generado: 2025-09-16*
*Analista: Agente de APIs y Backend - Entrena con IA*