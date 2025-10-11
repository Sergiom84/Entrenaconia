# Heavy Duty Methodology Implementation

## 📋 Overview

Implementación completa de la metodología **Heavy Duty de Mike Mentzer** para la aplicación Entrena con IA.

### Principios Heavy Duty:
- **Máxima intensidad**: 1-2 series al fallo muscular absoluto
- **Mínimo volumen**: Menos es más
- **Descansos prolongados**: 4-7 días entre grupos musculares
- **Alta intensidad**: RPE 10/10 en cada serie

---

## 📁 Estructura de Archivos

```
HeavyDuty/
├── HeavyDutyLevels.js          # Configuración de niveles (Principiante, Intermedio, Avanzado)
├── HeavyDutyMuscleGroups.js    # Grupos musculares y splits de entrenamiento
├── HeavyDutyManualCard.jsx     # Componente principal del modal
└── README.md                    # Este archivo
```

---

## 🎯 Niveles Heavy Duty

### 1. **Principiante** 🌱
- **Frecuencia**: 2 sesiones/semana
- **Intensidad**: 70-80% 1RM
- **Series**: 1-2 por ejercicio
- **Descansos**: 3-4 días entre entrenamientos
- **Equipamiento**: Máquinas y poleas (seguridad)

**Hitos**:
- Dominar técnica perfecta
- Alcanzar fallo muscular controlado
- Comprender descansos prolongados

---

### 2. **Intermedio** ⚡
- **Frecuencia**: 2-3 sesiones/semana
- **Intensidad**: 80-90% 1RM
- **Series**: 1 por ejercicio (al fallo absoluto)
- **Descansos**: 4-7 días entre grupos musculares
- **Equipamiento**: Barras libres, mancuernas

**Hitos**:
- Fallo muscular absoluto con seguridad
- Recuperación óptima entre sesiones
- Progresión constante en cargas

---

### 3. **Avanzado** 💪
- **Frecuencia**: 2 sesiones/semana
- **Intensidad**: 85-95% 1RM
- **Series**: 1 por ejercicio (máxima intensidad)
- **Descansos**: 5-10 días entre grupos musculares
- **Equipamiento**: Barras + técnicas avanzadas (cadenas, bandas)

**Hitos**:
- Una serie = máximo estímulo posible
- Descansos de 7+ días sin pérdida de fuerza
- Control mental extremo

---

## 💪 Grupos Musculares

| Grupo | Ejercicios Principales | Frecuencia |
|-------|------------------------|------------|
| **Pecho** | Press de banca, Fondos | 1x semana |
| **Espalda** | Dominadas, Remo con barra | 1x semana |
| **Piernas** | Sentadilla, Peso muerto | 1x semana |
| **Hombros** | Press militar | 1x semana |
| **Brazos** | Curl con barra, Press francés | 1x semana |
| **Core** | Plancha, Rueda abdominal | 2x semana |

---

## 🏋️ Splits de Entrenamiento

### **Push/Pull Split (2 días/semana)** - Recomendado
```
Lunes: Empuje
  - Pecho
  - Hombros
  - Tríceps

Jueves: Tracción + Piernas
  - Espalda
  - Bíceps
  - Piernas
```

### **Push/Pull/Legs (3 días/semana)** - Intermedio
```
Lunes: Push
  - Pecho
  - Hombros

Miércoles: Pull
  - Espalda
  - Bíceps

Viernes: Legs
  - Piernas
  - Core
```

---

## 🔧 Uso del Componente

### **Integración en MethodologiesScreen.jsx**

```javascript
import HeavyDutyManualCard from './methodologies/HeavyDuty/HeavyDutyManualCard.jsx';

// En el handler de clic de tarjeta
const handleManualCardClick = (methodology) => {
  if (methodology.name === 'Heavy Duty') {
    ui.showModal('heavyDutyManual');
    return;
  }
  // ... resto del código
};

// Handler de generación
const handleHeavyDutyManualGenerate = async (heavyDutyData) => {
  const result = await generatePlan({
    mode: 'manual',
    methodology: 'heavy-duty',
    heavyDutyData
  });
  // ... proceso de confirmación
};

// En el render
{ui.showHeavyDutyManual && (
  <Dialog open={ui.showHeavyDutyManual} onOpenChange={() => ui.hideModal('heavyDutyManual')}>
    <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
      <HeavyDutyManualCard
        onGenerate={handleHeavyDutyManualGenerate}
        isLoading={ui.isLoading}
        error={ui.error}
      />
    </DialogContent>
  </Dialog>
)}
```

---

## 🔌 API Endpoints

### **Evaluación de Perfil**
```
POST /api/heavy-duty-specialist/evaluate-profile
```

**Request**:
```json
{
  "source": "modal_evaluation_v1.0"
}
```

**Response**:
```json
{
  "success": true,
  "evaluation": {
    "recommended_level": "intermedio",
    "confidence": 0.85,
    "reasoning": "Usuario tiene experiencia en fallo muscular y buena recuperación",
    "key_indicators": [
      "2+ años de entrenamiento",
      "Experiencia con fallo muscular",
      "Buena capacidad de recuperación"
    ],
    "suggested_focus_areas": [
      "Press de banca",
      "Sentadilla profunda",
      "Dominadas lastradas"
    ],
    "safety_considerations": [
      "Asegurar técnica perfecta antes de aumentar intensidad",
      "Respetar días de descanso obligatorios"
    ]
  }
}
```

### **Generación de Plan**
```
POST /api/heavy-duty-specialist/generate
```

**Request**:
```json
{
  "heavyDutyData": {
    "methodology": "Heavy Duty Specialist",
    "source": "ai_evaluation",
    "level": "intermedio",
    "goals": "Aumentar fuerza en press de banca",
    "selectedMuscleGroups": ["pecho", "espalda", "piernas"],
    "aiEvaluation": { ... }
  },
  "versionConfig": {
    "version": "adapted",
    "customWeeks": 4
  }
}
```

---

## 🗄️ Base de Datos

### **Tabla de Ejercicios**
```
app.Ejercicios_Heavy_Duty
```

**Estructura** (17 columnas):
- `id` (SERIAL PRIMARY KEY)
- `exercise_id` (TEXT NOT NULL UNIQUE)
- `nombre` (TEXT NOT NULL)
- `nivel` (TEXT NOT NULL) - Básico, Intermedio, Avanzado
- `categoria` (TEXT NOT NULL) - Pecho, Espalda, Piernas, etc.
- `patron` (TEXT) - Patrón de movimiento
- `equipamiento` (TEXT) - Máquina, Barra, Mancuernas, etc.
- `series_reps_objetivo` (TEXT) - "1x8-12"
- `criterio_de_progreso` (TEXT)
- `progresion_desde` (TEXT)
- `progresion_hacia` (TEXT)
- `notas` (TEXT)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)
- `variante` (TEXT)
- `explicacion_variante` (TEXT)
- `tiempo` (TEXT)

**Total ejercicios**: 44

---

## 📊 Estadísticas de Ejercicios

| Nivel | Cantidad |
|-------|----------|
| Básico | 37 |
| Intermedio | 7 |

| Grupo Muscular | Ejercicios |
|----------------|------------|
| Pecho | 6 |
| Espalda | 5 |
| Piernas | 5 |
| Hombros | 2 |
| Brazos | 4 |
| Core | 2 |

---

## ✅ Checklist de Implementación

### **Frontend**
- [x] HeavyDutyLevels.js creado
- [x] HeavyDutyMuscleGroups.js creado
- [x] HeavyDutyManualCard.jsx creado
- [ ] Integración en MethodologiesScreen.jsx
- [ ] Modal de confirmación configurado
- [ ] WarmupModal integrado
- [ ] RoutineSessionModal integrado

### **Backend**
- [x] Tabla `Ejercicios_Heavy_Duty` creada
- [x] 44 ejercicios importados
- [ ] Endpoint `/api/heavy-duty-specialist/evaluate-profile`
- [ ] Endpoint `/api/heavy-duty-specialist/generate`
- [ ] Prompt especializado `heavy_duty_specialist.md`
- [ ] Configuración en `aiConfigs.js`

### **Testing**
- [ ] Evaluación IA funciona correctamente
- [ ] Generación de plan con IA funciona
- [ ] Selección manual de nivel funciona
- [ ] Modal de confirmación muestra plan correcto
- [ ] WarmupModal se abre correctamente
- [ ] RoutineSessionModal muestra ejercicios
- [ ] Navegación a TodayTrainingTab funciona

---

## 🔄 Flujo Completo

```
Usuario click "Heavy Duty" en MethodologiesScreen
  ↓
HeavyDutyManualCard se abre
  ↓
IA evalúa perfil automáticamente
  ↓
Usuario elige:
  - Generar con IA (usa evaluación)
  - Elegir nivel manualmente
  ↓
Plan se genera
  ↓
TrainingPlanConfirmationModal muestra resumen
  ↓
Usuario acepta
  ↓
WarmupModal (calentamiento)
  ↓
RoutineSessionModal (sesión de ejercicios)
  ↓
Navigate a TodayTrainingTab
```

---

## 📝 Notas Técnicas

### **Diferencias clave con Calistenia**:
1. **Énfasis en intensidad**: Heavy Duty usa RPE 10/10, Calistenia usa progresiones
2. **Volumen**: Heavy Duty = 1-2 series, Calistenia = 3-5 series
3. **Descansos**: Heavy Duty = 4-7 días, Calistenia = 1-2 días
4. **Equipamiento**: Heavy Duty = máquinas + barras, Calistenia = peso corporal
5. **Fallo muscular**: Heavy Duty = obligatorio, Calistenia = opcional

### **Consideraciones de recuperación**:
- Heavy Duty requiere descansos MUY largos (4-7 días mínimo)
- No se puede entrenar el mismo grupo muscular antes de recuperación completa
- El sistema debe validar que hayan pasado los días mínimos de descanso

---

## 🚀 Próximos Pasos

1. **Integrar en MethodologiesScreen.jsx** ✅ Siguiente tarea
2. **Crear endpoints backend** (routineGeneration.js)
3. **Crear prompt especializado** (heavy_duty_specialist.md)
4. **Testing completo** del flujo
5. **Validar con usuario** que los parámetros son correctos

---

## 📚 Referencias

- **Metodología**: Mike Mentzer - Heavy Duty Training
- **Base de código**: CalisteniaManual (patron de referencia)
- **Documentación**: CLAUDE.md - Methodology Flow System

---

**Versión**: 1.0.0
**Última actualización**: 2025-10-05
**Autor**: Claude Code - Arquitectura Modular Profesional
