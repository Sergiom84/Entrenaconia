# 🐛 SOLUCIÓN IMPLEMENTADA: Bug Draft Huérfano

**Fecha**: 2025-11-14  
**Estado**: ✅ COMPLETADO

---

## 📊 PROBLEMA IDENTIFICADO

### **Situación**
Usuario ID 21 tenía un plan **draft** (ID 141) que:
- ✅ Fue generado correctamente por la IA
- ❌ **NUNCA fue confirmado** (`confirmed_at: null`)
- ❌ **NO tiene registros en `workout_schedule`** (tabla vacía)
- ❌ **NO tiene registros en `methodology_plan_days`** (tabla vacía)
- ⚠️ **El plan tiene estructura corrupta**: Solo semanas 1, 2, 3 y 6 (faltan 4 y 5)

### **Cómo Ocurrió**
```
1. Usuario click en metodología → Genera plan con IA
2. Modal de propuesta se abre con el plan
3. Usuario cierra modal (X) SIN confirmar
4. Plan queda en estado 'draft' en BD
5. Frontend detecta plan activo → Muestra UI corrupta
```

### **Síntomas en UI**
- "Plan de Entrenamiento" con duración 6 semanas, 3x/semana
- "Día de descanso" (no hay sesión para hoy)
- "No se pudo cargar el calendario" (no hay `workout_schedule`)

---

## ✅ SOLUCIÓN IMPLEMENTADA

### **Opción B: Guardar draft PERO eliminarlo si usuario cancela**

**Ventajas**:
- Permite recuperar plan si usuario cierra accidentalmente
- Muestra preview en modal
- Elimina automáticamente si cancela

---

## 📁 ARCHIVOS MODIFICADOS

### **1. Backend: Endpoint DELETE** ✅

**Archivo**: `backend/routes/routineGeneration.js`

**Cambios**:
- Añadido endpoint `DELETE /api/routine-generation/draft/:planId`
- Solo permite eliminar drafts propios del usuario autenticado
- Valida que el plan sea un draft antes de eliminar
- Logs detallados de la operación

**Código**:
```javascript
router.delete('/draft/:planId', authenticateToken, async (req, res) => {
  const { planId } = req.params;
  const userId = req.user?.userId || req.user?.id;

  // Verificar que el plan existe y es un draft del usuario
  const checkQuery = await pool.query(`
    SELECT id, methodology_type, status, created_at
    FROM app.methodology_plans
    WHERE id = $1 AND user_id = $2
  `, [planId, userId]);

  if (checkQuery.rowCount === 0) {
    return res.status(404).json({ success: false, error: 'Plan no encontrado' });
  }

  const plan = checkQuery.rows[0];

  // Solo permitir eliminar drafts
  if (plan.status !== 'draft') {
    return res.status(400).json({
      success: false,
      error: 'Solo se pueden eliminar planes draft',
      currentStatus: plan.status
    });
  }

  // Eliminar el draft
  const deleteResult = await pool.query(`
    DELETE FROM app.methodology_plans
    WHERE id = $1 AND user_id = $2 AND status = 'draft'
    RETURNING id, methodology_type
  `, [planId, userId]);

  res.json({
    success: true,
    message: 'Draft eliminado exitosamente',
    deletedPlan: { id: deleted.id, methodology_type: deleted.methodology_type }
  });
});
```

---

### **2. Frontend: Modal de Confirmación** ✅

**Archivo**: `src/components/routines/TrainingPlanConfirmationModal.jsx`

**Cambios**:
1. Añadida prop `planId` para recibir ID del draft
2. Añadido estado `isDeleting` para UI de carga
3. Creada función `deleteDraft()` para llamar al endpoint
4. Creado handler `handleClose()` que elimina draft si no fue confirmado
5. Modificado `handleFeedbackSubmit()` para eliminar draft antes de generar otro
6. Reemplazadas llamadas a `onClose()` por `handleClose()`
7. Añadido estado de carga en botones

**Código clave**:
```javascript
// 🗑️ Función para eliminar draft cuando el usuario cancela
const deleteDraft = async (draftId) => {
  if (!draftId) return;

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3010';
  const token = localStorage.getItem('token');

  const response = await fetch(`${API_URL}/api/routine-generation/draft/${draftId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (response.ok) {
    console.log('✅ Draft eliminado');
    track('DRAFT_DELETED', { planId: draftId, reason: 'user_cancelled' });
  }
};

// 🚪 Handler para cerrar modal (elimina draft si no fue confirmado)
const handleClose = async () => {
  if (planId && !isConfirming) {
    setIsDeleting(true);
    await deleteDraft(planId);
    setIsDeleting(false);
  }
  onClose();
};
```

---

### **3. Frontend: MethodologiesScreen** ✅

**Archivo**: `src/components/Methodologie/MethodologiesScreen.jsx`

**Cambios**:
- Añadida prop `planId={plan.methodologyPlanId}` al modal

**Código**:
```javascript
<TrainingPlanConfirmationModal
  isOpen={ui.showPlanConfirmation}
  onClose={() => ui.hideModal('planConfirmation')}
  onStartTraining={handleStartTraining}
  onGenerateAnother={handleGenerateAnother}
  plan={plan.currentPlan}
  planId={plan.methodologyPlanId}  // 🆕 Añadido
  methodology={plan.methodology}
  isLoading={ui.isLoading}
  error={ui.error}
  isConfirming={isConfirmingPlan}
/>
```

---

## 🎯 FLUJO COMPLETO

### **Escenario 1: Usuario cancela**
```
1. Usuario genera plan → Draft creado en BD
2. Modal se abre con plan
3. Usuario click en X o Cancelar
4. handleClose() detecta planId y !isConfirming
5. Llama a deleteDraft(planId)
6. Backend elimina draft
7. Modal se cierra
```

### **Escenario 2: Usuario genera otro**
```
1. Usuario genera plan → Draft creado en BD
2. Modal se abre con plan
3. Usuario click en "Generar otro"
4. Modal de feedback se abre
5. Usuario envía feedback
6. handleFeedbackSubmit() elimina draft actual
7. Genera nuevo plan
8. Nuevo draft reemplaza al anterior
```

### **Escenario 3: Usuario confirma**
```
1. Usuario genera plan → Draft creado en BD
2. Modal se abre con plan
3. Usuario click en "Generar entrenamiento"
4. isConfirming = true
5. Plan se confirma (draft → active)
6. handleClose() NO elimina (isConfirming = true)
7. Modal se cierra
```

---

## ✅ RESULTADO

**Ahora el sistema**:
- ✅ Elimina drafts automáticamente si usuario cancela
- ✅ Elimina draft anterior al generar otro
- ✅ NO elimina draft si usuario confirma
- ✅ Previene acumulación de drafts huérfanos
- ✅ Logs detallados para debugging

---

## 🧪 CÓMO PROBAR

1. **Generar plan y cancelar**:
   ```
   - Ve a Metodologías → Modo Manual
   - Click en cualquier metodología
   - Espera a que se genere el plan
   - Click en X o Cancelar
   - Verifica en consola: "✅ Draft eliminado"
   - Verifica en BD: No debe haber draft
   ```

2. **Generar otro plan**:
   ```
   - Genera plan
   - Click en "Generar otro"
   - Envía feedback
   - Verifica en consola: "🗑️ Eliminando draft anterior..."
   - Verifica que se genera nuevo plan
   ```

3. **Confirmar plan**:
   ```
   - Genera plan
   - Click en "Generar entrenamiento"
   - Verifica que NO se elimina el draft
   - Verifica que el plan se confirma correctamente
   ```

---

## 📊 LOGS ESPERADOS

### **Al cancelar**:
```
🗑️ Eliminando draft 141...
✅ Draft eliminado: { id: 141, methodology_type: 'HipertrofiaV2_MindFeed' }
```

### **Al generar otro**:
```
🗑️ Eliminando draft anterior antes de generar nuevo...
✅ Draft eliminado: { id: 141, methodology_type: 'Calistenia' }
🎯 Generando nuevo plan...
```

### **Al confirmar**:
```
🎯 PASO 1: Confirmando plan con ID: 142
✅ Plan confirmado exitosamente
(NO aparece mensaje de eliminación)
```

