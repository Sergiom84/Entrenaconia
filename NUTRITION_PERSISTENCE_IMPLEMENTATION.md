# 📊 Implementación de Persistencia en Calendario Nutricional

## ✅ Funcionalidad Implementada

El sistema ahora **guarda automáticamente** el progreso de comidas en la base de datos cada vez que marcas una comida como completada.

---

## 🔄 Flujo de Datos

### 1. **Usuario marca comida como completada**

```
Usuario hace clic → handleMealComplete() →
  ├─ Actualiza UI inmediatamente (UX optimista)
  ├─ Envía POST /api/nutrition/daily
  └─ Guarda en tabla daily_nutrition_log
```

### 2. **Usuario abre el calendario**

```
Componente se monta → useEffect() →
  ├─ Genera fechas de la semana
  ├─ Hace GET /api/nutrition/daily/:date (7 peticiones en paralelo)
  ├─ Recupera mealProgress de cada día
  └─ Actualiza estado con progreso guardado
```

### 3. **Usuario cambia de semana**

```
Click en flechas de navegación → currentWeek cambia →
  └─ useEffect se dispara → Carga progreso de la nueva semana
```

---

## 📁 Archivos Modificados

### Frontend

**`src/components/nutrition/NutritionCalendar.jsx`**

#### Estados agregados (líneas 20-21):

```javascript
const [isSaving, setIsSaving] = useState(false);
const [isLoading, setIsLoading] = useState(true);
```

#### useEffect para cargar progreso (líneas 52-117):

```javascript
useEffect(() => {
  const loadWeekProgress = async () => {
    // Carga progreso de la semana actual desde BD
    // Se ejecuta al montar y al cambiar de semana
  };
  loadWeekProgress();
}, [currentWeek, nutritionPlan]);
```

#### handleMealComplete actualizado (líneas 219-268):

```javascript
const handleMealComplete = async (dayString, mealId) => {
  // 1. Actualiza UI inmediatamente
  // 2. Guarda en BD con POST /api/nutrition/daily
  // 3. Maneja errores y revierte si falla
};
```

### Backend

**`backend/routes/nutrition.js`**

#### POST /api/nutrition/daily actualizado (líneas 410-480):

```javascript
router.post("/daily", authenticateToken, async (req, res) => {
  // Acepta mealProgress como parámetro
  // Combina con datos existentes si ya hay un registro
  // Usa ON CONFLICT para actualizar si existe
});
```

#### GET /api/nutrition/daily/:date actualizado (líneas 396-406):

```javascript
res.json({
  success: true,
  dailyLog: {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    meals: [],
    mealProgress: {}, // ← Incluido en default
  },
});
```

---

## 🗄️ Estructura de Datos en BD

### Tabla: `app.daily_nutrition_log`

```sql
CREATE TABLE daily_nutrition_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  log_date DATE NOT NULL,
  daily_log JSONB NOT NULL,
  calories NUMERIC DEFAULT 0,
  protein NUMERIC DEFAULT 0,
  carbs NUMERIC DEFAULT 0,
  fat NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, log_date)
);
```

### Estructura del campo `daily_log`:

```json
{
  "mealProgress": {
    "desayuno": true,
    "almuerzo": false,
    "cena": true
  },
  "calories": 0,
  "protein": 0,
  "carbs": 0,
  "fat": 0,
  "meals": []
}
```

---

## 🎯 Ejemplo de Uso

### Escenario: Usuario marca desayuno como completado el 4 de octubre

**1. Frontend envía:**

```javascript
POST http://localhost:3010/api/nutrition/daily
{
  "date": "2025-10-04",
  "mealProgress": {
    "desayuno": true,
    "almuerzo": false,
    "cena": false
  }
}
```

**2. Backend guarda en BD:**

```sql
INSERT INTO app.daily_nutrition_log (user_id, log_date, daily_log, ...)
VALUES (18, '2025-10-04', '{"mealProgress": {"desayuno": true, ...}}', ...)
ON CONFLICT (user_id, log_date)
DO UPDATE SET daily_log = EXCLUDED.daily_log, updated_at = NOW();
```

**3. Usuario recarga página:**

```javascript
GET http://localhost:3010/api/nutrition/daily/2025-10-04

Response:
{
  "success": true,
  "dailyLog": {
    "mealProgress": {
      "desayuno": true,  ← Se recupera correctamente
      "almuerzo": false,
      "cena": false
    }
  }
}
```

**4. UI se actualiza:**

- ✅ Desayuno aparece marcado con check verde
- Progreso del día: 33% (1 de 3 comidas)

---

## 🔒 Seguridad

- ✅ Autenticación JWT requerida en todos los endpoints
- ✅ userId extraído del token (no del request body)
- ✅ Queries parametrizadas (previene SQL injection)
- ✅ UNIQUE constraint en (user_id, log_date) previene duplicados

---

## ⚡ Optimizaciones

### 1. **UX Optimista**

La UI se actualiza inmediatamente antes de guardar en BD para mejor experiencia de usuario.

### 2. **Carga en Paralelo**

Se cargan los 7 días de la semana simultáneamente con `Promise.all()`.

### 3. **Recuperación ante Fallos**

Si falla el guardado, se revierte el cambio en la UI automáticamente.

### 4. **Uso de ON CONFLICT**

Actualiza registro existente en lugar de generar error.

---

## 🧪 Cómo Probar

### 1. Iniciar backend y frontend

```bash
# Terminal 1 - Backend
cd backend && npm run dev

# Terminal 2 - Frontend
npm run dev
```

### 2. Navegar a Nutrición

- Ir a la pestaña "Calendario"

### 3. Marcar comida como completada

- Click en el check de cualquier comida
- Observar console.log: `✅ Progreso guardado: ...`

### 4. Recargar página

- Presionar F5
- Verificar que la comida sigue marcada ✅

### 5. Cambiar de semana

- Click en flechas de navegación
- Volver a la semana anterior
- Verificar que el progreso persiste

### 6. Verificar en BD (opcional)

```sql
SELECT * FROM app.daily_nutrition_log
WHERE user_id = 18
ORDER BY log_date DESC
LIMIT 7;
```

---

## 📝 Logs de Debugging

### Frontend (Console del navegador):

```
📥 Progreso cargado desde BD: {"2025-10-04-desayuno": true, ...}
✅ Progreso guardado: {date: "2025-10-04", meal: "desayuno", completed: true}
```

### Backend (Terminal):

```
✅ Progreso nutricional guardado - Usuario: 18, Fecha: 2025-10-04
```

---

## 🚀 Próximas Mejoras (Opcionales)

1. **Indicador visual de guardado**: Mostrar spinner mientras guarda
2. **Sincronización offline**: Guardar en localStorage como cache
3. **Estadísticas de adherencia**: % de comidas completadas por semana
4. **Notificaciones**: Avisar cuando falla el guardado
5. **Undo/Redo**: Permitir deshacer cambios

---

## 🐛 Troubleshooting

### Problema: Las comidas no se guardan

**Verificar:**

1. Backend corriendo en puerto 3010
2. Token de autenticación válido en localStorage
3. Console del navegador muestra errores
4. Network tab muestra respuesta 200 OK

### Problema: El progreso no se carga al abrir

**Verificar:**

1. useEffect se ejecuta correctamente
2. Peticiones GET retornan 200 OK
3. dailyLog contiene mealProgress en la respuesta
4. Console muestra: `📥 Progreso cargado desde BD`

### Problema: Error 401 Unauthorized

**Solución:**

- Verificar que authToken existe en localStorage
- Re-hacer login si el token expiró

---

## ✅ Checklist de Implementación

- [x] Estados de carga (isSaving, isLoading)
- [x] handleMealComplete con guardado en BD
- [x] useEffect para cargar progreso guardado
- [x] Backend acepta mealProgress
- [x] Backend devuelve mealProgress en GET
- [x] Manejo de errores y rollback
- [x] Logs de debugging
- [x] Constraint UNIQUE en BD
- [x] Autenticación JWT
- [x] UX optimista

---

**Estado:** ✅ **Implementación Completa**

**Fecha:** 4 de octubre de 2025

**Desarrollador:** Claude Code + Usuario
