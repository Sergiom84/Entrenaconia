# Guía de Migración: Sistema Unificado de Metodologías

## 🎯 Objetivo
Unificar los flujos automático y manual de generación de planes de entrenamiento en un único sistema coherente y mantenible.

## 📋 Resumen de Cambios

### Antes (Sistema Fragmentado)
```
- 2 módulos IA separados (METHODOLOGIE y METHODOLOGIE_MANUAL)
- Prompts embebidos de 249 líneas en aiConfigs.js
- Lógica duplicada en múltiples archivos
- Inconsistencia de datos entre flujos
- Difícil mantenimiento y escalabilidad
```

### Después (Sistema Unificado)
```
- 1 servicio unificado (MethodologyService)
- Prompts en archivos .md separados
- Configuración centralizada de metodologías
- Misma fuente de datos para todos los flujos
- Arquitectura escalable y mantenible
```

## 🏗️ Nueva Arquitectura

### 1. Estructura de Archivos
```
backend/
├── config/
│   ├── methodologies/
│   │   └── index.js              # Configuración de todas las metodologías
│   ├── aiConfigs.js              # Original (mantener temporalmente)
│   └── aiConfigsRefactored.js    # Nueva versión sin prompts embebidos
├── services/
│   └── methodologyService.js     # Servicio unificado principal
├── routes/
│   ├── methodologyUnified.js     # Nuevo router unificado
│   ├── aiMethodologie.js         # Legacy (mantener temporalmente)
│   └── methodologyManual.js      # Legacy (mantener temporalmente)
├── lib/
│   └── methodologyAdapter.js     # Adaptador para migración gradual
└── prompts/
    ├── methodology_unified.md    # Prompt unificado principal
    └── methodologies/            # Prompts específicos por metodología
        ├── heavy_duty.md
        ├── powerlifting.md
        ├── hipertrofia.md
        ├── funcional.md
        ├── oposiciones.md
        ├── crossfit.md
        └── calistenia.md
```

## 🔄 Plan de Migración

### Fase 1: Preparación (Actual)
✅ Crear nueva estructura de archivos
✅ Implementar MethodologyService
✅ Crear router unificado
✅ Implementar adaptador de migración

### Fase 2: Testing en Paralelo
```javascript
// En server.js, agregar ambos routers temporalmente
import methodologyUnified from './routes/methodologyUnified.js';
import aiMethodologie from './routes/aiMethodologie.js';
import methodologyManual from './routes/methodologyManual.js';

// Nuevo sistema (usar con flag de feature)
if (process.env.USE_NEW_METHODOLOGY_SYSTEM === 'true') {
  app.use('/api/methodology', methodologyUnified);
} else {
  // Sistema legacy
  app.use('/api/methodologie', aiMethodologie);
  app.use('/api/methodology-manual', methodologyManual);
}
```

### Fase 3: Migración del Frontend
```javascript
// En el frontend, actualizar las llamadas API gradualmente

// Antes (múltiples endpoints)
const generateAutomatic = () => fetch('/api/methodologie/generate-plan');
const generateManual = () => fetch('/api/methodology-manual/generate-manual');

// Después (endpoint unificado)
const generatePlan = (mode, methodology = null) => {
  return fetch('/api/methodology/generate', {
    method: 'POST',
    body: JSON.stringify({
      mode, // 'automatic' o 'manual'
      methodology, // null para auto, nombre para manual
      versionConfig: {
        version: 'adapted',
        customWeeks: 4
      }
    })
  });
};
```

### Fase 4: Validación
- [ ] Probar flujo automático con nuevo sistema
- [ ] Probar flujo manual con nuevo sistema
- [ ] Verificar que los planes generados son consistentes
- [ ] Validar que el feedback de ejercicios funciona
- [ ] Confirmar que las estadísticas se registran correctamente

### Fase 5: Despliegue Completo
1. Activar feature flag en producción
2. Monitorear errores y métricas
3. Desactivar endpoints legacy
4. Eliminar código legacy después de 2 semanas estables

## 🔌 Integración con el Frontend

### Cambios Necesarios en el Frontend

#### 1. MethodologiesScreen.jsx
```javascript
// Actualizar la llamada para modo automático
const handleAutomaticGeneration = async () => {
  const response = await fetch('/api/methodology/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      mode: 'automatic',
      versionConfig: {
        version: 'adapted',
        customWeeks: 4,
        userLevel: userProfile.nivel
      }
    })
  });
};
```

#### 2. CalisteniaManualCard.jsx (y similares)
```javascript
// Actualizar la llamada para modo manual
const handleManualGeneration = async (methodology) => {
  const response = await fetch('/api/methodology/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      mode: 'manual',
      methodology: methodology, // 'Calistenia', 'Hipertrofia', etc.
      versionConfig: {
        version: userEvaluation.recommendedVersion,
        customWeeks: selectedWeeks,
        userLevel: userProfile.nivel
      }
    })
  });
};
```

#### 3. Obtener Metodologías Disponibles
```javascript
// Nuevo endpoint para obtener todas las metodologías
const fetchAvailableMethodologies = async () => {
  const response = await fetch('/api/methodology/available', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return response.json();
};

// Nuevo endpoint para obtener recomendaciones personalizadas
const fetchRecommendedMethodologies = async () => {
  const response = await fetch('/api/methodology/recommended', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return response.json();
};
```

## 🎯 Beneficios del Nuevo Sistema

### 1. **Consistencia Total**
- Mismo perfil de usuario para todos los flujos
- Mismos ejercicios y base de datos
- Misma lógica de generación

### 2. **Mantenibilidad**
- Un solo lugar para actualizar lógica
- Prompts separados y versionados
- Configuración centralizada

### 3. **Escalabilidad**
- Fácil agregar nuevas metodologías
- Sistema de plugins para variantes
- Adaptadores para integraciones

### 4. **Mejor UX**
- Recomendaciones inteligentes
- Historial unificado
- Feedback consistente

## 📊 Métricas de Éxito

### KPIs a Monitorear
1. **Tasa de error**: Debe disminuir un 50%
2. **Tiempo de generación**: Debe reducirse un 30%
3. **Satisfacción del usuario**: Medida por feedback positivo
4. **Variabilidad de ejercicios**: Debe aumentar un 40%
5. **Planes completados**: Tasa de finalización >70%

## 🐛 Troubleshooting

### Problema: "La IA siempre elige la misma metodología"
**Solución**: Verificar que el historial de metodologías se está consultando correctamente y que el algoritmo de selección considera la variación.

### Problema: "Los ejercicios no varían entre planes"
**Solución**: Asegurar que `getUserExerciseHistory` está funcionando y que la IA recibe la lista de ejercicios a evitar.

### Problema: "El plan no respeta la versión (adapted/strict)"
**Solución**: Verificar que `versionConfig` se está pasando correctamente y que el prompt incluye las adaptaciones.

## 🚀 Próximos Pasos

1. **Inmediato**:
   - Implementar el nuevo router en server.js con feature flag
   - Crear tests unitarios para MethodologyService
   - Actualizar un componente del frontend como prueba

2. **Corto plazo (1-2 semanas)**:
   - Migrar todos los componentes del frontend
   - Implementar caché para mejorar performance
   - Agregar métricas y logging detallado

3. **Mediano plazo (1 mes)**:
   - Eliminar código legacy
   - Optimizar prompts basado en feedback
   - Implementar sistema de A/B testing

## 📝 Notas Importantes

- **NO eliminar** el código legacy hasta confirmar estabilidad
- **Mantener** compatibilidad hacia atrás durante la migración
- **Documentar** cualquier cambio en el API
- **Comunicar** cambios al equipo de frontend
- **Monitorear** métricas después del despliegue

## 💡 Mejoras Futuras

1. **Machine Learning**: Entrenar modelo personalizado con datos de usuarios
2. **Progresión Automática**: Ajustar planes basado en rendimiento real
3. **Integración Wearables**: Usar datos de dispositivos para optimizar
4. **Gamificación**: Sistema de logros y recompensas
5. **Comunidad**: Compartir planes entre usuarios similares

---

## Contacto y Soporte

Para dudas o problemas durante la migración:
- Revisar logs en `/backend/logs/methodology.log`
- Consultar métricas en dashboard de monitoreo
- Usar el adaptador para rollback si es necesario

**Última actualización**: Enero 2025