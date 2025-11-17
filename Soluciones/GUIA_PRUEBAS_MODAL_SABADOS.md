# 🧪 Guía de Pruebas: Modal de Sábados HipertrofiaV2

## ✅ Estado de la Implementación

**IMPLEMENTACIÓN COMPLETA** - Todos los tests de backend pasaron exitosamente (9/9 ✅)

---

## 🎯 Objetivo de las Pruebas

Verificar que el sistema frontend muestra correctamente el modal de distribución de sesiones cuando el usuario selecciona HipertrofiaV2 en días intermedios de la semana, y que el mapeo D1-D5 se genera correctamente según la elección del usuario.

---

## 🛠️ Preparación del Entorno

### 1. Iniciar el Backend

```bash
cd backend
npm run dev
```

**Verificar:** El servidor debe estar corriendo en `http://localhost:3010`

### 2. Iniciar el Frontend

```bash
npm run dev
```

**Verificar:** La aplicación debe estar corriendo en `http://localhost:5173`

### 3. Iniciar Sesión

- Ir a `http://localhost:5173`
- Hacer login con credenciales válidas
- Navegar a **Metodologías**

---

## 📋 Casos de Prueba

### ✅ CASO 1: Lunes (Sin Modal)

**Objetivo:** Verificar que NO aparece el modal cuando se comienza en Lunes

**Pasos:**

1. Cambiar la fecha del sistema a un **Lunes**
   - Windows: `Settings > Time & Language > Date & Time > Set time manually`
   - Linux/Mac: `sudo date MMDDhhmmYYYY`
2. Ir a **Metodologías**
3. Activar modo **Manual** (selector superior)
4. Hacer clic en **"Seleccionar"** en la tarjeta de **HipertrofiaV2**

**Resultado Esperado:**

- ❌ NO debe aparecer `SessionDistributionModal`
- ✅ DEBE aparecer directamente `HipertrofiaV2ManualCard` (modal azul/púrpura)

**Validación:**

1. Hacer clic en "Evaluar Perfil"
2. Hacer clic en "Generar Plan"
3. Abrir DevTools → Network → Buscar petición `generate-d1d5`
4. Verificar Request Body:

```json
{
  "startConfig": {
    "includeSaturdays": true // Default para Lunes
  }
}
```

5. Verificar Response → `d1_d5_mapping`:

```json
{
  "D1": "Lunes",
  "D2": "Martes",
  "D3": "Miércoles",
  "D4": "Jueves",
  "D5": "Viernes"
}
```

---

### ✅ CASO 2: Martes CON Sábados

**Objetivo:** Verificar que aparece el modal y genera correctamente cuando se elige entrenar sábados

**Pasos:**

1. Cambiar la fecha del sistema a un **Martes**
2. Ir a **Metodologías**
3. Activar modo **Manual**
4. Hacer clic en **"Seleccionar"** en **HipertrofiaV2**

**Resultado Esperado:**

- ✅ DEBE aparecer `SessionDistributionModal` con 2 opciones:
  - 📅 **Entrenar Sábados (Recomendado)**
  - 🗓️ **Añadir Semana Extra**

**Continuación de la Prueba:** 5. Seleccionar **"📅 Entrenar Sábados"** 6. Hacer clic en **"Continuar"** 7. ✅ DEBE aparecer `HipertrofiaV2ManualCard` 8. Hacer clic en "Evaluar Perfil" 9. Hacer clic en "Generar Plan"

**Validación en DevTools:**

1. Network → `generate-d1d5` → Request Body:

```json
{
  "startConfig": {
    "distributionOption": "saturdays",
    "includeSaturdays": true
  }
}
```

2. Response → `d1_d5_mapping`:

```json
{
  "D1": "Martes",
  "D2": "Miércoles",
  "D3": "Jueves",
  "D4": "Viernes",
  "D5": "Sábado"
}
```

**Verificación Visual del Plan:**

- Ir a **Entrenamientos** (después de confirmar el plan)
- En la pestaña **"Calendario"**, verificar que:
  - D1 aparece el Martes
  - D5 aparece el Sábado de la misma semana

---

### ✅ CASO 3: Martes SIN Sábados (Extender a Semana 9)

**Objetivo:** Verificar que genera correctamente cuando se elige NO entrenar sábados

**Pasos:**

1. Cambiar la fecha del sistema a un **Martes**
2. Repetir pasos 2-4 del CASO 2

**Continuación:** 5. Seleccionar **"🗓️ Añadir Semana Extra"** 6. Hacer clic en **"Continuar"** 7. Completar generación del plan

**Validación en DevTools:**

1. Request Body:

```json
{
  "startConfig": {
    "distributionOption": "extra_week",
    "includeSaturdays": false
  }
}
```

2. Response → `d1_d5_mapping`:

```json
{
  "D1": "Martes",
  "D2": "Miércoles",
  "D3": "Jueves",
  "D4": "Viernes",
  "D5": "Lunes" // ← Siguiente semana
}
```

**Verificación Visual del Plan:**

- En **Calendario**, verificar que:
  - D1-D4 están en la primera semana (Mar-Vie)
  - D5 aparece el **Lunes de la siguiente semana**

---

### ✅ CASO 4: Miércoles CON Sábados

**Pasos:**

1. Cambiar fecha a **Miércoles**
2. Seleccionar HipertrofiaV2
3. Elegir **"Entrenar Sábados"**

**Mapeo Esperado:**

```json
{
  "D1": "Miércoles",
  "D2": "Jueves",
  "D3": "Viernes",
  "D4": "Sábado",
  "D5": "Lunes" // ← Siguiente semana
}
```

---

### ✅ CASO 5: Miércoles SIN Sábados

**Pasos:**

1. Cambiar fecha a **Miércoles**
2. Seleccionar HipertrofiaV2
3. Elegir **"Añadir Semana Extra"**

**Mapeo Esperado:**

```json
{
  "D1": "Miércoles",
  "D2": "Jueves",
  "D3": "Viernes",
  "D4": "Lunes",
  "D5": "Martes"
}
```

---

### ✅ CASO 6: Jueves CON Sábados

**Mapeo Esperado:**

```json
{
  "D1": "Jueves",
  "D2": "Viernes",
  "D3": "Sábado",
  "D4": "Lunes",
  "D5": "Martes"
}
```

---

### ✅ CASO 7: Jueves SIN Sábados

**Mapeo Esperado:**

```json
{
  "D1": "Jueves",
  "D2": "Viernes",
  "D3": "Lunes",
  "D4": "Martes",
  "D5": "Miércoles"
}
```

---

### ✅ CASO 8: Viernes CON Sábados

**Mapeo Esperado:**

```json
{
  "D1": "Viernes",
  "D2": "Sábado",
  "D3": "Lunes",
  "D4": "Martes",
  "D5": "Miércoles"
}
```

---

### ✅ CASO 9: Viernes SIN Sábados

**Mapeo Esperado:**

```json
{
  "D1": "Viernes",
  "D2": "Lunes",
  "D3": "Martes",
  "D4": "Miércoles",
  "D5": "Jueves"
}
```

---

### ✅ CASO 10: Sábado/Domingo (WeekendWarningModal)

**Pasos:**

1. Cambiar fecha a **Sábado** o **Domingo**
2. Seleccionar HipertrofiaV2

**Resultado Esperado:**

- ❌ NO debe aparecer `SessionDistributionModal`
- ✅ DEBE aparecer `HipertrofiaV2ManualCard`
- Después de generar, debe aparecer `WeekendWarningModal` preguntando:
  - Descansar hasta el lunes
  - Hacer Full Body extra hoy

---

## 🔍 Puntos Clave a Verificar

### 1. **Estado del Modal de Distribución**

**Debe Aparecer Cuando:**

- ✅ Día de la semana es Martes (2)
- ✅ Día de la semana es Miércoles (3)
- ✅ Día de la semana es Jueves (4)
- ✅ Día de la semana es Viernes (5)

**NO Debe Aparecer Cuando:**

- ❌ Día de la semana es Lunes (1) → Va directo al modal
- ❌ Día de la semana es Sábado (6) → WeekendWarningModal después
- ❌ Día de la semana es Domingo (0) → WeekendWarningModal después

### 2. **Contenido del Modal de Distribución**

**Debe Mostrar:**

- ✅ Título: "Distribución de Sesiones"
- ✅ Subtítulo indicando el día de inicio (ej: "Has comenzado en Martes")
- ✅ Opción A: "📅 Entrenar Sábados (Recomendado)"
  - Descripción con cálculo de semanas
  - Badge mostrando número de semanas
- ✅ Opción B: "🗓️ Añadir Semana Extra"
  - Descripción con distribución semanal
  - Badge mostrando número de semanas
- ✅ Botones: "Cancelar" y "Continuar"
- ✅ Botón "Continuar" deshabilitado hasta que se seleccione una opción

### 3. **Comportamiento del Modal**

**Al seleccionar una opción:**

- ✅ La tarjeta debe resaltarse (border azul, fondo azul claro)
- ✅ El texto cambia de color
- ✅ Botón "Continuar" se habilita

**Al hacer clic en "Continuar":**

- ✅ Modal se cierra
- ✅ Se abre `HipertrofiaV2ManualCard`
- ✅ La configuración se pasa correctamente

**Al hacer clic en "Cancelar":**

- ✅ Modal se cierra
- ✅ No se abre ningún otro modal
- ✅ Usuario vuelve a la pantalla de Metodologías

### 4. **Validación del Request al Backend**

**En DevTools → Network → `generate-d1d5`:**

**Request Body debe contener:**

```json
{
  "nivel": "Principiante",  // o el nivel del usuario
  "totalWeeks": 8,
  "startConfig": {
    "startDate": "2024-11-19",  // Fecha actual
    "distributionOption": "saturdays" | "extra_week",
    "includeSaturdays": true | false
  }
}
```

**Headers debe incluir:**

```
Content-Type: application/json
Authorization: Bearer [token]
```

### 5. **Validación de la Response**

**Response debe incluir:**

```json
{
  "success": true,
  "plan": {
    "d1_d5_mapping": {
      "D1": "Martes",
      "D2": "Miércoles",
      "D3": "Jueves",
      "D4": "Viernes",
      "D5": "Sábado" | "Lunes"
    },
    "sessions": [...],
    "total_weeks": 8
  },
  "methodologyPlanId": 123,
  "system_info": { ... }
}
```

---

## 🐛 Problemas Comunes y Soluciones

### Problema 1: Modal no aparece cuando debería

**Síntomas:**

- Es Martes/Miércoles/Jueves/Viernes
- Al seleccionar HipertrofiaV2, va directo al modal de evaluación

**Posibles Causas:**

1. La fecha del sistema no está correctamente configurada
2. El código no se compiló correctamente

**Solución:**

1. Verificar fecha del sistema: `console.log(new Date().getDay())`
2. Hacer hard refresh del navegador: `Ctrl+Shift+R`
3. Verificar que Vite recompilo el código (ver terminal)

---

### Problema 2: Modal aparece pero las opciones no se ven correctamente

**Síntomas:**

- Modal aparece sin opciones
- Opciones sin estilos

**Posibles Causas:**

- Problema con Tailwind CSS
- Props no se están pasando correctamente

**Solución:**

1. Verificar en console.log: `console.log('distributionConfig:', localState.distributionConfig)`
2. Verificar que SessionDistributionModal recibe `config` prop
3. Hacer rebuild de Tailwind: `npm run dev` (reiniciar)

---

### Problema 3: Backend recibe `includeSaturdays: undefined`

**Síntomas:**

- Request Body muestra `includeSaturdays: undefined`
- Mapeo generado es incorrecto

**Posibles Causas:**

- `startConfig` no se está pasando correctamente
- Mapeo de `option` a `includeSaturdays` falló

**Solución:**

1. Verificar en `handleDistributionConfirm`:

```javascript
console.log("Option selected:", option);
console.log("Final config:", finalConfig);
```

2. Verificar que `HipertrofiaV2ManualCard` recibe `startConfig` prop
3. Verificar que `finalStartConfig` usa `startConfig || defaultConfig`

---

### Problema 4: Mapeo D1-D5 incorrecto

**Síntomas:**

- D5 no coincide con lo esperado
- Días están desordenados

**Posibles Causas:**

- Backend no está usando `includeSaturdays` correctamente
- Fecha de inicio incorrecta

**Solución:**

1. Ejecutar test de backend:

```bash
cd backend
node scripts/test-sabados-local.js
```

2. Verificar que todos los tests pasan (9/9)
3. Si fallan, revisar lógica en `backend/routes/hipertrofiaV2.js` líneas 110-169

---

## 📊 Tabla Resumen de Casos de Prueba

| #   | Día Inicio | Modal? | Opción     | D1-D5 Esperado        | Estado |
| --- | ---------- | ------ | ---------- | --------------------- | ------ |
| 1   | Lunes      | ❌     | N/A        | Lun→Mar→Mié→Jue→Vie   | ⬜     |
| 2   | Martes     | ✅     | Sábados    | Mar→Mié→Jue→Vie→Sáb   | ⬜     |
| 3   | Martes     | ✅     | Extra Week | Mar→Mié→Jue→Vie→Lun   | ⬜     |
| 4   | Miércoles  | ✅     | Sábados    | Mié→Jue→Vie→Sáb→Lun   | ⬜     |
| 5   | Miércoles  | ✅     | Extra Week | Mié→Jue→Vie→Lun→Mar   | ⬜     |
| 6   | Jueves     | ✅     | Sábados    | Jue→Vie→Sáb→Lun→Mar   | ⬜     |
| 7   | Jueves     | ✅     | Extra Week | Jue→Vie→Lun→Mar→Mié   | ⬜     |
| 8   | Viernes    | ✅     | Sábados    | Vie→Sáb→Lun→Mar→Mié   | ⬜     |
| 9   | Viernes    | ✅     | Extra Week | Vie→Lun→Mar→Mié→Jue   | ⬜     |
| 10  | Sábado     | ❌     | Weekend    | Weekend Warning Modal | ⬜     |
| 11  | Domingo    | ❌     | Weekend    | Weekend Warning Modal | ⬜     |

**Instrucciones:** Marcar con ✅ cada caso completado y validado

---

## ✅ Checklist Final

Antes de considerar la implementación completa, verificar:

- [ ] Todos los casos de prueba (1-11) pasaron exitosamente
- [ ] El modal aparece correctamente en días 2-5
- [ ] El modal NO aparece en día 1
- [ ] Las opciones del modal se muestran correctamente
- [ ] El botón "Continuar" funciona
- [ ] El botón "Cancelar" funciona
- [ ] La configuración se pasa correctamente al backend
- [ ] El mapeo D1-D5 es correcto en todos los casos
- [ ] El plan se visualiza correctamente en el calendario
- [ ] No hay errores en la consola del navegador
- [ ] No hay errores en la consola del backend
- [ ] La experiencia de usuario es fluida

---

## 🎯 Conclusión

Si todos los casos de prueba pasan y el checklist final está completo, la implementación del Modal de Sábados para HipertrofiaV2 está **LISTA PARA PRODUCCIÓN** ✅
