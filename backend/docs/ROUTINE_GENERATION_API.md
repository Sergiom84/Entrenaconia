# API de Generación de Rutinas - Documentación

## Resumen

El sistema consolidado de generación de rutinas centraliza toda la funcionalidad relacionada con la creación de planes de entrenamiento, tanto automáticos (con IA) como manuales. Este documento describe la nueva estructura de endpoints y cómo migrar desde los endpoints legacy.

## Endpoints Consolidados

### Base URL
```
/api/routine-generation
```

### Categorías

#### 1. Generación con IA (`/ai/*`)

##### Metodología Automática (Gimnasio)
```
POST /api/routine-generation/ai/methodology
```
- **Descripción**: Genera un plan de metodología de gimnasio usando IA
- **Body**:
  ```json
  {
    "versionConfig": {
      "selectionMode": "automatic",
      "version": "adapted",
      "userLevel": "intermedio",
      "customWeeks": 4
    }
  }
  ```
- **Alias Legacy**: `/api/methodologie/generate-plan`

##### Rutina de Gimnasio
```
POST /api/routine-generation/ai/gym-routine
```
- **Descripción**: Genera una rutina de gimnasio fresca (no se guarda en BD)
- **Body**:
  ```json
  {
    "methodology": "push_pull_legs",
    "duration_weeks": 4,
    "frequency_per_week": 3,
    "focus_areas": ["pecho", "espalda"],
    "experience_level": "intermedio"
  }
  ```
- **Alias Legacy**: `/api/gym-routine/generate`

#### 2. Generación Manual (`/manual/*`)

##### Metodología Manual
```
POST /api/routine-generation/manual/methodology
```
- **Descripción**: Genera un plan manual de metodología específica
- **Body**:
  ```json
  {
    "metodologia_solicitada": "Heavy Duty",
    "versionConfig": {
      "version": "adapted",
      "customWeeks": 4
    }
  }
  ```
- **Alias Legacy**: `/api/methodology-manual/generate-manual`

##### Calistenia Manual
```
POST /api/routine-generation/manual/calistenia
```
- **Descripción**: Genera un plan manual de calistenia
- **Body**:
  ```json
  {
    "level": "intermedio",
    "goals": "Mejorar fuerza y resistencia",
    "levelInfo": {
      "frequency": "4 días/semana",
      "hitos": ["10 dominadas", "20 flexiones"]
    }
  }
  ```
- **Alias Legacy**: `/api/calistenia-manual/generate`

#### 3. Especialistas (`/specialist/*`)

##### Evaluación de Perfil para Calistenia
```
POST /api/routine-generation/specialist/calistenia/evaluate
```
- **Descripción**: Evalúa el perfil del usuario y recomienda nivel de calistenia
- **Body**: No requiere (usa perfil del usuario autenticado)
- **Response**:
  ```json
  {
    "success": true,
    "evaluation": {
      "recommended_level": "intermedio",
      "confidence": 0.85,
      "reasoning": "...",
      "key_indicators": ["..."],
      "suggested_focus_areas": ["..."]
    }
  }
  ```
- **Alias Legacy**: `/api/calistenia-specialist/evaluate-profile`

##### Generación de Plan Especializado de Calistenia
```
POST /api/routine-generation/specialist/calistenia/generate
```
- **Descripción**: Genera un plan especializado de calistenia con IA
- **Body**:
  ```json
  {
    "selectedLevel": "intermedio",
    "goals": "Dominar muscle-ups",
    "exercisePreferences": ["dominadas", "flexiones"],
    "previousPlan": null,
    "regenerationReason": null,
    "additionalInstructions": null
  }
  ```
- **Alias Legacy**: `/api/calistenia-specialist/generate-plan`

### Endpoints Auxiliares

#### Obtener Metodologías Disponibles
```
GET /api/routine-generation/methodologies
```
- **Response**:
  ```json
  {
    "success": true,
    "methodologies": [
      {
        "id": "heavy_duty",
        "name": "Heavy Duty",
        "description": "Alta intensidad, bajo volumen",
        "category": "strength"
      }
    ],
    "categories": ["strength", "muscle", "functional", ...]
  }
  ```

#### Obtener Niveles de Calistenia
```
GET /api/routine-generation/calistenia/levels
```
- **Response**:
  ```json
  {
    "success": true,
    "levels": [
      {
        "id": "basico",
        "name": "Básico",
        "description": "Principiantes: 0-1 años",
        "frequency": "3 días/semana",
        "duration": "30 minutos/sesión",
        "hitos": ["10 flexiones", "5 dominadas"]
      }
    ]
  }
  ```

#### Obtener Plan Activo del Usuario
```
GET /api/routine-generation/user/current-plan
```
- **Response**:
  ```json
  {
    "success": true,
    "hasPlan": true,
    "plan": {
      "id": 123,
      "methodology_type": "Calistenia",
      "plan_data": {},
      "generation_mode": "automatic",
      "created_at": "2024-01-15T10:00:00Z"
    }
  }
  ```

#### Health Check
```
GET /api/routine-generation/health
```
- **Response**:
  ```json
  {
    "status": "ok",
    "service": "Routine Generation Unified",
    "version": "2.0.0",
    "timestamp": "2024-01-15T10:00:00Z",
    "endpoints": {
      "ai": [...],
      "manual": [...],
      "specialist": [...],
      "auxiliary": [...]
    }
  }
  ```

## Migración desde Endpoints Legacy

### Mapeo de Rutas

| Ruta Legacy | Nueva Ruta | Notas |
|------------|------------|-------|
| `/api/calistenia-specialist/evaluate-profile` | `/api/routine-generation/specialist/calistenia/evaluate` | Compatible vía alias |
| `/api/calistenia-specialist/generate-plan` | `/api/routine-generation/specialist/calistenia/generate` | Compatible vía alias |
| `/api/methodologie/generate-plan` | `/api/routine-generation/ai/methodology` | Compatible vía alias |
| `/api/methodology-manual/generate-manual` | `/api/routine-generation/manual/methodology` | Compatible vía alias |
| `/api/calistenia-manual/generate` | `/api/routine-generation/manual/calistenia` | Compatible vía alias |
| `/api/gym-routine/generate` | `/api/routine-generation/ai/gym-routine` | Compatible vía alias |

### Compatibilidad

Los aliases de compatibilidad están configurados en `server.js` para mantener funcionando el frontend sin cambios. Las rutas legacy redirigen automáticamente a las nuevas rutas consolidadas.

### Endpoints No Migrados

Los siguientes endpoints permanecen en sus archivos originales por ahora:

- `/api/methodology-manual-routines/*` - Sistema de sesiones de entrenamiento
- `/api/methodologie/available-styles` - Lista de estilos disponibles
- `/api/calistenia-manual/level-assessment` - Evaluación de nivel
- `/api/calistenia-manual/exercises/:level` - Ejercicios por nivel

## Ventajas del Sistema Consolidado

1. **Código Unificado**: Toda la lógica de generación en un solo archivo
2. **Mantenimiento Simplificado**: Menos duplicación de código
3. **API Consistente**: Estructura uniforme de endpoints
4. **Fácil Extensión**: Agregar nuevas metodologías es más simple
5. **Compatibilidad Total**: Los endpoints legacy siguen funcionando

## Ejemplo de Uso

### Generar un Plan de Calistenia Completo

```javascript
// 1. Evaluar perfil del usuario
const evaluationResponse = await fetch('/api/routine-generation/specialist/calistenia/evaluate', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

const evaluation = await evaluationResponse.json();

// 2. Generar plan basado en la evaluación
const planResponse = await fetch('/api/routine-generation/specialist/calistenia/generate', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    selectedLevel: evaluation.evaluation.recommended_level,
    goals: 'Progresión general en calistenia',
    exercisePreferences: []
  })
});

const plan = await planResponse.json();
```

## Notas de Implementación

- **Autenticación**: Todos los endpoints requieren token JWT válido
- **Base de Datos**: Los planes se guardan en `app.methodology_plans`
- **IA**: Usa configuraciones de `AI_MODULES` en `backend/config/aiConfigs.js`
- **Prompts**: Los prompts de IA se cargan desde `promptRegistry`
- **Logs**: Sistema completo de logging con `aiLogger`

## Archivos Relacionados

- **Principal**: `/backend/routes/routineGeneration.js`
- **Configuración**: `/backend/config/aiConfigs.js`
- **Utilidades**: `/backend/utils/aiLogger.js`
- **Base de Datos**: `/backend/db.js`
- **Server**: `/backend/server.js` (aliases de compatibilidad)

## Estado Actual

✅ **Completado**:
- Consolidación de endpoints de generación
- Sistema de aliases de compatibilidad
- Documentación completa
- Manejo de errores consistente
- Logging detallado

⚠️ **Pendiente**:
- Migrar endpoints secundarios
- Eliminar archivos legacy cuando sea seguro
- Actualizar frontend para usar nuevas rutas directamente