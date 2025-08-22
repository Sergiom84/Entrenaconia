# API de Corrección por Fotos - Documentación

## Configuración Implementada

### 1. Nueva API Key Configurada
```env
OPENAI_API_KEY_PHOTO_CORRECTION=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
```

### 2. Módulo PHOTO_CORRECTION en aiConfigs.js
```javascript
PHOTO_CORRECTION: {
  key: 'PHOTO_CORRECTION',
  envKey: 'OPENAI_API_KEY_PHOTO_CORRECTION',
  model: 'gpt-4o-mini',
  temperature: 0.3,
  max_output_tokens: 1500,
  // ... configuración completa
}
```

### 3. Nueva Ruta Registrada
- **Endpoint base:** `/api/ai-photo-correction`
- **Archivo:** `backend/routes/aiPhotoCorrection.js`

## Endpoints Disponibles

### 1. Análisis Completo de Fotos
**POST** `/api/ai-photo-correction/analyze`

**Características:**
- ✅ Subida de múltiples fotos (máximo 5)
- ✅ Análisis detallado de técnica
- ✅ Contextualización con información del usuario
- ✅ Respuesta JSON estructurada

**Parámetros:**
- `photos` (files): Array de imágenes (máximo 5, 10MB cada una)
- `exercise_name` (string): Nombre del ejercicio
- `exercise_description` (string, opcional): Descripción del ejercicio
- `user_context` (JSON string, opcional): Contexto del usuario (nivel, objetivo, lesiones)

**Ejemplo de uso desde frontend:**
```javascript
const formData = new FormData();
formData.append('photos', file1);
formData.append('photos', file2);
formData.append('exercise_name', 'Sentadilla');
formData.append('exercise_description', 'Sentadilla básica con peso corporal');
formData.append('user_context', JSON.stringify({
  nivel: 'intermedio',
  objetivo: 'ganar_musculo',
  lesiones: ['rodilla_izquierda']
}));

const response = await fetch('/api/ai-photo-correction/analyze', {
  method: 'POST',
  body: formData,
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

**Respuesta esperada:**
```json
{
  "success": true,
  "analysis": {
    "analisis_general": "Evaluación general de la técnica...",
    "correcciones": [
      {
        "aspecto": "Postura de espalda",
        "problema": "Ligera flexión hacia adelante",
        "solucion": "Mantén el pecho erguido y activa el core",
        "importancia": "alta"
      }
    ],
    "puntos_positivos": ["Buena profundidad en la sentadilla"],
    "recomendaciones_adicionales": "Consejos adicionales...",
    "nivel_riesgo": "bajo",
    "nota_final": "Mensaje motivador..."
  },
  "metadata": {
    "exercise_analyzed": "Sentadilla",
    "photos_count": 2,
    "model_used": "gpt-4o-mini",
    "timestamp": "2025-08-22T...",
    "user_context": {...}
  }
}
```

### 2. Análisis Rápido (Una sola foto)
**POST** `/api/ai-photo-correction/quick-check`

**Características:**
- ✅ Análisis de una sola foto
- ✅ Respuesta más rápida y concisa
- ✅ Menor uso de tokens

**Parámetros:**
- `photo` (file): Una imagen
- `exercise_name` (string): Nombre del ejercicio

**Ejemplo de uso:**
```javascript
const formData = new FormData();
formData.append('photo', file);
formData.append('exercise_name', 'Push-up');

const response = await fetch('/api/ai-photo-correction/quick-check', {
  method: 'POST',
  body: formData,
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

## Integración en Frontend

### Ubicación sugerida:
**Sección:** "Corrección por video IA" → "Subir fotos para análisis" → Botón "Análisis"

### Flujo recomendado:
1. **Usuario sube fotos** (1-5 imágenes)
2. **Especifica ejercicio** (dropdown o input)
3. **Información adicional** (opcional): descripción del ejercicio
4. **Presiona "Análisis"**
5. **Sistema envía fotos a `/api/ai-photo-correction/analyze`**
6. **Muestra respuesta estructurada** con correcciones y recomendaciones

### Componente sugerido:
```jsx
const PhotoAnalysis = () => {
  const [photos, setPhotos] = useState([]);
  const [exerciseName, setExerciseName] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState(null);

  const handleAnalysis = async () => {
    setAnalyzing(true);
    const formData = new FormData();
    photos.forEach(photo => formData.append('photos', photo));
    formData.append('exercise_name', exerciseName);
    
    try {
      const response = await fetch('/api/ai-photo-correction/analyze', {
        method: 'POST',
        body: formData,
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setResults(data.analysis);
    } catch (error) {
      console.error('Error en análisis:', error);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div>
      <PhotoUpload onPhotosChange={setPhotos} maxPhotos={5} />
      <ExerciseSelector value={exerciseName} onChange={setExerciseName} />
      <button onClick={handleAnalysis} disabled={!photos.length || analyzing}>
        {analyzing ? 'Analizando...' : 'Análizar Técnica'}
      </button>
      {results && <AnalysisResults data={results} />}
    </div>
  );
};
```

## Ventajas del Sistema Implementado

### 1. ✅ Arquitectura Modular
- Cada IA tiene su propia configuración
- API keys separadas por funcionalidad
- Fácil mantenimiento y escalabilidad

### 2. ✅ Flexibilidad
- Análisis completo para evaluaciones detalladas
- Análisis rápido para checks instantáneos
- Contextualización con perfil de usuario

### 3. ✅ Seguridad
- Validación de tipos de archivo
- Límites de tamaño y cantidad
- Manejo de errores robusto

### 4. ✅ Optimización
- Diferentes niveles de detalle en imágenes
- Control de tokens por endpoint
- Respuestas JSON estructuradas

## Estado Actual de las APIs

| Módulo | API Key | Archivo | Estado |
|--------|---------|---------|---------|
| VIDEO_CORRECTION | ✅ `OPENAI_API_KEY_VIDEO_CORRECTION` | `aiVideoCorrection.js` | ✅ Configurado |
| HOME_TRAINING | ✅ `OPENAI_API_KEY_HOME_TRAINING` | `IAHomeTraining.js` | ✅ Corregido |
| PHOTO_CORRECTION | ✅ `OPENAI_API_KEY_PHOTO_CORRECTION` | `aiPhotoCorrection.js` | ✅ Nuevo |

**¡Todo listo para implementar la funcionalidad de análisis de fotos en el frontend!**
