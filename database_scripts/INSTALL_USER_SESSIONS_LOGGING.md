# 🔐 INSTALACIÓN DEL SISTEMA DE LOGGING DE SESIONES DE USUARIO

## 📋 Resumen del Sistema

Este sistema proporciona un logging completo para login/logout de usuarios con las siguientes características:

- **Tracking completo**: Login/logout con timestamps precisos
- **Información de dispositivo**: IP, User-Agent, información del navegador y sistema operativo
- **Detección automática de timeout**: Cierre automático de sesiones inactivas
- **Estadísticas avanzadas**: Análisis de patrones de uso y seguridad
- **Mantenimiento automático**: Limpieza programada de sesiones antiguas
- **APIs completas**: Endpoints para gestión y monitoreo

## 🚀 INSTALACIÓN

### Paso 1: Aplicar Scripts SQL

**IMPORTANTE**: Ejecutar los scripts en este orden específico.

```bash
# 1. Conectarse a la base de datos PostgreSQL de Supabase
psql "postgresql://postgres:Xe05Klm563kkjL@db.lhsnmjgdtjalfcsurxvg.supabase.co:5432/postgres"

# 2. Asegurar que estamos en el esquema correcto
SET search_path TO app, public;

# 3. Ejecutar el script principal
\i database_scripts/create_user_sessions_logging.sql
```

#### Verificación de Instalación

```sql
-- Verificar que la tabla se creó correctamente
SELECT 
    table_name, 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'app' AND table_name = 'user_sessions'
ORDER BY ordinal_position;

-- Verificar índices
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE schemaname = 'app' AND tablename = 'user_sessions';

-- Verificar funciones
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'app' 
  AND routine_name LIKE '%session%';
```

### Paso 2: Instalar Dependencia Node.js

```bash
# Desde el directorio backend/
cd backend
npm install node-cron@^3.0.3
```

### Paso 3: Reiniciar el Servidor

```bash
# Modo desarrollo
npm run dev

# Producción
npm start
```

## 🔧 CONFIGURACIÓN

### Variables de Entorno

No se requieren variables adicionales. El sistema usa las configuraciones existentes de JWT y base de datos.

### Configuración de Timeouts

Por defecto:
- **Sesiones inactivas**: Se cierran automáticamente después de 24 horas sin actividad
- **Limpieza de datos**: Sesiones cerradas se eliminan después de 90 días
- **Mantenimiento automático**: Cada 4 horas
- **Reportes diarios**: 2:00 AM cada día

## 📊 FUNCIONALIDADES PRINCIPALES

### 1. Logging Automático

#### Login
```javascript
// Se ejecuta automáticamente en POST /api/auth/login
const loginResult = await logUserLogin(userId, token, req, {
  loginMethod: 'email_password',
  userAgent: req.headers['user-agent']
});
```

#### Logout
```javascript
// Endpoint: POST /api/auth/logout
const logoutResult = await logUserLogout(userId, token, 'manual', {
  logoutTimestamp: new Date().toISOString()
});
```

### 2. APIs de Gestión

#### Sesiones Activas
```bash
GET /api/auth/sessions
Authorization: Bearer <token>
```

#### Estadísticas de Usuario
```bash
GET /api/auth/sessions/stats
Authorization: Bearer <token>
```

#### Historial de Sesiones
```bash
GET /api/auth/sessions/history?limit=50&offset=0
Authorization: Bearer <token>
```

#### Cerrar Todas las Sesiones
```bash
POST /api/auth/sessions/logout-all
Authorization: Bearer <token>
Content-Type: application/json

{
  "reason": "security_precaution"
}
```

### 3. APIs de Administración

#### Estado del Sistema
```bash
GET /api/admin/sessions/status
```

#### Mantenimiento Manual
```bash
POST /api/admin/sessions/maintenance
```

### 4. Funciones SQL Útiles

#### Estadísticas de Usuario
```sql
SELECT * FROM app.get_user_session_stats(18); -- ID del usuario
```

#### Limpieza Manual
```sql
-- Cerrar sesiones inactivas (más de 24 horas)
SELECT app.close_inactive_sessions('24 hours');

-- Limpiar sesiones antiguas (más de 90 días)
SELECT app.cleanup_old_sessions('90 days');

-- Mantenimiento completo
SELECT app.session_maintenance();
```

## 📈 MONITOREO Y ESTADÍSTICAS

### Vistas Disponibles

#### Sesiones Activas
```sql
SELECT * FROM app.active_user_sessions;
```

#### Estadísticas Diarias
```sql
SELECT * FROM app.daily_login_stats;
```

### Consultas Útiles

#### Usuarios Más Activos (Última Semana)
```sql
SELECT 
    u.email,
    COUNT(us.session_id) as total_sessions,
    MAX(us.login_time) as last_login,
    AVG(EXTRACT(EPOCH FROM us.session_duration))/60 as avg_minutes_per_session
FROM app.user_sessions us
JOIN app.users u ON us.user_id = u.id
WHERE us.login_time >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY u.id, u.email
ORDER BY total_sessions DESC
LIMIT 10;
```

#### Detección de Actividad Sospechosa
```sql
-- Múltiples IPs por usuario en corto tiempo
SELECT 
    user_id,
    COUNT(DISTINCT ip_address) as unique_ips,
    COUNT(*) as login_count,
    array_agg(DISTINCT ip_address) as ip_addresses
FROM app.user_sessions
WHERE login_time >= CURRENT_TIMESTAMP - INTERVAL '2 hours'
GROUP BY user_id
HAVING COUNT(DISTINCT ip_address) > 3
ORDER BY unique_ips DESC;
```

## 🔒 ASPECTOS DE SEGURIDAD Y PRIVACIDAD

### Datos Almacenados

#### Datos Personales Mínimos
- **IP Address**: Necesaria para detección de fraude
- **User-Agent**: Solo información técnica del navegador
- **Device Info**: Información técnica en JSON (no datos personales)

#### Datos NO Almacenados
- ❌ Tokens JWT completos (solo hash SHA-256)
- ❌ Contraseñas o datos sensibles
- ❌ Información personal identificable fuera de lo técnicamente necesario

### Cumplimiento GDPR

#### Derechos del Usuario
1. **Acceso**: `GET /api/auth/sessions/history`
2. **Rectificación**: No aplica (datos técnicos automáticos)
3. **Supresión**: Limpieza automática después de 90 días
4. **Portabilidad**: Datos disponibles vía API

#### Medidas de Protección
- Hashing de tokens JWT para evitar replay attacks
- Retención limitada de datos (90 días máximo)
- Acceso restringido a usuarios autenticados
- Logging de accesos para auditoría

### Configuración de Retención

```sql
-- Cambiar período de retención (ejemplo: 30 días)
SELECT app.cleanup_old_sessions('30 days');

-- Configurar limpieza más frecuente
-- Modificar en backend/utils/sessionMaintenance.js:
const MAINTENANCE_CONFIG = {
    oldSessionRetention: '30 days'  // Cambiar aquí
};
```

## 🐛 SOLUCIÓN DE PROBLEMAS

### Problemas Comunes

#### 1. Error: Tabla no existe
```sql
-- Verificar esquema
SHOW search_path;
SET search_path TO app, public;

-- Verificar tabla
\dt app.user_sessions
```

#### 2. Funciones no encontradas
```sql
-- Recrear funciones
\i database_scripts/create_user_sessions_logging.sql
```

#### 3. Sesiones no se registran
```bash
# Verificar logs del servidor
tail -f logs/server.log | grep SessionMaintenance
```

#### 4. Mantenimiento no se ejecuta
```javascript
// Verificar que node-cron está instalado
import cron from 'node-cron'; // No debe dar error
```

### Logs y Debugging

#### Backend Logs
```bash
# Logs de sesiones
grep "SessionMaintenance" logs/server.log

# Logs de login/logout
grep "Nueva sesión\|Logout registrado" logs/server.log
```

#### Verificación de Estado
```bash
curl http://localhost:3002/api/admin/sessions/status
```

## 🔄 MANTENIMIENTO

### Tareas Automáticas

- **Cada 4 horas**: Limpieza de sesiones inactivas y datos antiguos
- **Diariamente a las 2 AM**: Generación de reportes estadísticos
- **Al iniciar servidor**: Limpieza inicial (30 segundos después del arranque)

### Tareas Manuales Recomendadas

#### Semanal
- Revisar logs de actividad sospechosa
- Verificar estadísticas de uso

#### Mensual
- Revisar configuración de retención de datos
- Evaluar necesidad de ajustes en timeouts

#### Trimestral
- Auditoría completa de logs de acceso
- Revisión de cumplimiento GDPR

## 📚 RECURSOS ADICIONALES

### Archivos del Sistema

```
backend/
├── routes/auth.js                 # APIs de autenticación (modificado)
├── middleware/auth.js             # Middleware de auth (modificado)
├── utils/sessionUtils.js          # Utilidades de sesión (nuevo)
├── utils/sessionMaintenance.js    # Mantenimiento automático (nuevo)
├── server.js                      # Servidor principal (modificado)
└── package.json                   # Dependencias (modificado)

database_scripts/
├── create_user_sessions_logging.sql  # Script SQL principal (nuevo)
└── INSTALL_USER_SESSIONS_LOGGING.md  # Esta documentación (nuevo)
```

### Estructura de la Tabla

```sql
-- Campos principales de app.user_sessions
session_id          UUID PRIMARY KEY
user_id             INTEGER REFERENCES users(id)
login_time          TIMESTAMP WITH TIME ZONE
logout_time         TIMESTAMP WITH TIME ZONE (nullable)
last_activity       TIMESTAMP WITH TIME ZONE
session_duration    INTERVAL (computed)
ip_address          INET
user_agent          TEXT
device_info         JSONB
is_active           BOOLEAN
logout_type         ENUM('manual', 'timeout', 'forced', 'system')
jwt_token_hash      VARCHAR(64)
jwt_expires_at      TIMESTAMP WITH TIME ZONE
session_metadata    JSONB
created_at          TIMESTAMP WITH TIME ZONE
updated_at          TIMESTAMP WITH TIME ZONE
```

---

## ✅ VERIFICACIÓN DE INSTALACIÓN COMPLETA

### Checklist Final

- [ ] ✅ Script SQL ejecutado sin errores
- [ ] ✅ Tabla `app.user_sessions` creada
- [ ] ✅ Funciones SQL disponibles
- [ ] ✅ Dependencia `node-cron` instalada  
- [ ] ✅ Servidor reiniciado
- [ ] ✅ Login genera registros en user_sessions
- [ ] ✅ Logout cierra sesiones correctamente
- [ ] ✅ APIs de gestión funcionando
- [ ] ✅ Mantenimiento automático programado
- [ ] ✅ Logs del sistema sin errores

### Prueba de Funcionalidad

```bash
# 1. Login
curl -X POST http://localhost:3002/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'

# 2. Verificar sesión activa
curl -X GET http://localhost:3002/api/auth/sessions \
  -H "Authorization: Bearer <token-from-login>"

# 3. Logout
curl -X POST http://localhost:3002/api/auth/logout \
  -H "Authorization: Bearer <token-from-login>" \
  -H "Content-Type: application/json"

# 4. Verificar estado del sistema
curl -X GET http://localhost:3002/api/admin/sessions/status
```

## 🎯 CONCLUSIÓN

El sistema de logging de sesiones está ahora completamente instalado y configurado. Proporciona:

- **Seguridad mejorada** con detección de patrones sospechosos
- **Cumplimiento legal** con GDPR y protección de datos
- **Monitoreo completo** de la actividad de usuarios
- **Mantenimiento automático** para optimización del rendimiento
- **APIs completas** para integración con el frontend

El sistema funciona de forma transparente y no afecta la experiencia del usuario, mientras proporciona valiosos insights sobre el uso de la aplicación y mejora la seguridad general del sistema.

---

*Última actualización: 9 de septiembre de 2025*
*Versión del sistema: 1.0.0*
*Compatible con: PostgreSQL 12+, Node.js 18+*