# Funcionalidad de Metodologías - Entrena con IA

## 📋 Visión General

El sistema de metodologías es el corazón de la aplicación, permitiendo a los usuarios generar planes de entrenamiento personalizados mediante IA. Ofrece dos modos principales: **Automático** (IA elige la mejor metodología) y **Manual** (usuario selecciona metodología específica).

## 🎯 Modos de Funcionamiento

### Modo Automático (Recomendado)
**Ubicación**: `src/components/Methodologie/MethodologiesScreen.jsx:160-192`

**Funcionamiento**:
- El usuario hace clic en "Activar IA"
- Sistema envía perfil completo a `/api/methodologie/generate-plan`
- IA analiza datos del usuario y selecciona metodología óptima
- Genera plan personalizado de 4-5 semanas

**Flujo de interacción**:
1. **Selector de modo** → Click en card "Automático"
2. **Botón "Activar IA"** → Ejecuta `handleActivateIA(null)`
3. **Modal de éxito** → Muestra plan generado
4. **Botón "Ir a Rutinas"** → Navega a `/routines` con datos del plan

### Modo Manual (Selección personalizada)
**Ubicación**: `src/components/Methodologie/MethodologiesScreen.jsx:194-217`

**Funcionamiento**:
- Usuario selecciona modo manual
- Cards de metodología se activan (cursor pointer, hover effects)
- Click en card abre modal de confirmación
- Confirma y genera plan con metodología específica

**Flujo de interacción**:
1. **Selector de modo** → Click en card "Manual"
2. **Card de metodología** → Click ejecuta `handleManualCardClick()`
3. **Modal de confirmación** → `MethodologyConfirmationModal`
4. **Botón "Confirmar y Generar"** → Ejecuta `confirmManualSelection()`
5. **Navegación directa** → Va a `/routines` con plan manual

## 🗂️ Metodologías Disponibles

### Base de datos de metodologías
**Ubicación**: `src/components/Methodologie/methodologiesData.js`

**Metodologías implementadas**:

#### 1. Heavy Duty
- **Enfoque**: Alta intensidad, bajo volumen
- **Nivel**: Intermedio-Avanzado
- **Frecuencia**: 2-3 días/semana
- **Compatible casa**: ✅ Sí
- **Icono**: ⚡ (Zap)

#### 2. Powerlifting
- **Enfoque**: Fuerza máxima en 3 levantamientos básicos
- **Nivel**: Intermedio-Competición
- **Frecuencia**: 4-6 días/semana
- **Compatible casa**: ❌ No
- **Icono**: 🏆 (Trophy)

#### 3. Hipertrofia
- **Enfoque**: Crecimiento muscular
- **Nivel**: Principiante-Avanzado
- **Frecuencia**: 4-5 días/semana
- **Compatible casa**: ✅ Sí
- **Icono**: 🏋️ (Dumbbell)

#### 4. Funcional
- **Enfoque**: Movimientos naturales
- **Nivel**: Principiante-Intermedio
- **Frecuencia**: 3-4 días/semana
- **Compatible casa**: ✅ Sí
- **Icono**: 📊 (Activity)

#### 5. Oposiciones
- **Enfoque**: Preparación física para pruebas
- **Nivel**: Principiante-Intermedio
- **Frecuencia**: 4-5 días/semana
- **Compatible casa**: ✅ Sí
- **Icono**: 🎯 (Target)

#### 6. CrossFit
- **Enfoque**: Condición física general
- **Nivel**: Intermedio-Avanzado
- **Frecuencia**: 3-5 días/semana
- **Compatible casa**: ❌ No
- **Icono**: 🎯 (Target)

#### 7. Calistenia
- **Enfoque**: Fuerza relativa con peso corporal
- **Nivel**: Principiante-Avanzado
- **Frecuencia**: 4-6 días/semana
- **Compatible casa**: ✅ Sí
- **Icono**: 👤 (User)

#### 8. Entrenamiento en Casa
- **Enfoque**: Adaptabilidad con equipamiento mínimo
- **Nivel**: Principiante-Intermedio
- **Frecuencia**: 3-5 días/semana
- **Compatible casa**: ✅ Sí
- **Icono**: 🏠 (Home)
- **Estado**: 🆕 Nueva metodología

## 🎨 Componentes Visuales

### MethodologyCard
**Ubicación**: `src/components/Methodologie/MethodologyCard.jsx`

**Estructura visual**:
```jsx
Card {
  CardHeader {
    - Icono + Título + Badge de nivel
    - Descripción
  }
  CardContent {
    - Frecuencia, Volumen, Intensidad (grid)
    - Botones: "Ver Detalles" + "Seleccionar"
  }
}
```

**Estados interactivos**:
- **Modo manual activo**: `cursor-pointer`, `hover:border-yellow-400/60`, `hover:scale-[1.01]`
- **Modo automático**: Solo hover básico (`hover:border-gray-600`)

### MethodologyDetailsDialog  
**Ubicación**: `src/components/Methodologie/MethodologyDetailsDialog.jsx`

**Funcionalidades**:
- **Tabs de información**: Principios, Beneficios, Dirigido a, Ciencia
- **Video placeholder**: Preparado para videos explicativos futuros
- **Badges informativos**: Focus y nivel
- **Botón de selección**: Solo activo en modo manual

### MethodologyConfirmationModal
**Ubicación**: `src/components/Methodologie/MethodologyConfirmationModal.jsx`

**Información mostrada**:
- **Metodología seleccionada**: Nombre y descripción
- **Características**: Grid con puntos clave
- **Métricas**: Frecuencia, Intensidad, Objetivo (cards con iconos)
- **Información importante**: Warning sobre personalización
- **Botones**: Cancelar (outline) + Confirmar (amarillo)

**Estados de carga**:
- Spinner durante generación
- Botones deshabilitados
- Texto dinámico "Generando..."

## 🔄 Flujos de Datos

### Perfil de Usuario
**Función**: `sanitizeProfile()` en `methodologiesData.js:10-19`

**Campos numéricos procesados**:
```javascript
const NUMBER_KEYS = [
  'edad','peso_kg','altura_cm','grasa_corporal','masa_muscular',
  'agua_corporal','metabolismo_basal','cintura','pecho','brazos',
  'muslos','cuello','antebrazos','comidas_diarias',
  'frecuencia_semanal','años_entrenando','meta_peso','meta_grasa'
];
```

### APIs Utilizadas

#### Modo Automático
- **Endpoint**: `/api/methodologie/generate-plan`
- **Método**: POST
- **Body**: `{ perfil: sanitizedProfile, metodologia_forzada: null }`
- **Response**: `{ success, plan, metadata }`

#### Modo Manual
- **Endpoint**: `/api/methodology-manual/generate-manual`
- **Método**: POST
- **Headers**: Authorization Bearer token
- **Body**: `{ metodologia_solicitada: methodologyName }`
- **Response**: `{ success, plan, planId }`

## 🎯 Interacciones del Usuario

### Botones y Acciones Principales

#### En MethodologiesScreen:
1. **Selector de modo** (Automático/Manual)
   - **Acción**: Cambio de estado visual de cards
   - **Efecto**: Habilita/deshabilita interactividad

2. **Botón "Activar IA"** (Solo modo automático)
   - **Función**: `handleActivateIA()`
   - **Estado loading**: Overlay con spinner
   - **Resultado**: Modal de éxito

3. **Cards de metodología** (Solo modo manual activo)
   - **Función**: `handleManualCardClick(methodology)`
   - **Efecto**: Abre modal de confirmación

4. **Botón "Ver Detalles"** (En todas las cards)
   - **Función**: `handleOpenDetails(methodology)`
   - **Efecto**: Abre `MethodologyDetailsDialog`

#### En MethodologyDetailsDialog:
1. **Tabs de información**
   - **Pestañas**: Principios, Beneficios, Dirigido a, Ciencia
   - **Contenido**: Información detallada de metodología

2. **Botón "Seleccionar"** (Solo en modo manual)
   - **Función**: Cierra dialog y ejecuta selección
   - **Estado**: Deshabilitado en modo automático

#### En MethodologyConfirmationModal:
1. **Botón "Cancelar"**
   - **Función**: Cierra modal y resetea estado
   - **Estilo**: Outline, gris

2. **Botón "Confirmar y Generar"**
   - **Función**: `confirmManualSelection()`
   - **Estados**: Normal → Loading → Success
   - **Navegación**: Automática a `/routines`

## 🎨 Estilos Visuales

### Paleta de Colores
- **Fondo principal**: `bg-black` (Negro absoluto)
- **Cards**: `bg-black/80` con `border-gray-700`
- **Accents**: `text-yellow-400` (títulos), `border-yellow-400/20` (bordes)
- **Estados hover**: `border-yellow-400/40`, `scale-[1.01]`

### Iconografía
- **Lucide React**: Biblioteca de iconos utilizada
- **Iconos contextuales**: Cada metodología tiene icono específico
- **Estados**: Iconos cambian color según contexto (amarillo para activo)

### Animaciones
- **Transiciones suaves**: `transition-all duration-300`
- **Hover effects**: Escala y cambio de borde
- **Loading**: Spinner rotativo durante procesamiento

## 🔧 Configuración Técnica

### Dependencias Principales
```json
{
  "react": "^18.x",
  "react-router-dom": "^6.x",
  "lucide-react": "iconos",
  "@/components/ui/*": "Componentes base"
}
```

### Estructura de Archivos
```
src/components/Methodologie/
├── MethodologiesScreen.jsx      # Pantalla principal
├── MethodologyCard.jsx          # Card individual
├── MethodologyDetailsDialog.jsx # Modal de detalles
├── MethodologyConfirmationModal.jsx # Modal confirmación
└── methodologiesData.js         # Base de datos estática
```

## 🚀 Estados de Carga

### Indicadores Visuales
1. **Overlay completo**: Durante generación IA automática
2. **Spinner en botón**: Durante confirmación manual
3. **Estados disabled**: Botones no interactuables durante carga
4. **Textos dinámicos**: "Procesando...", "Generando...", etc.

## 📊 Métricas Mostradas

### En Cards de Metodología
- **Frecuencia**: X días/semana
- **Volumen**: Bajo/Moderado/Alto
- **Intensidad**: Baja/Moderada/Alta/Muy alta
- **Nivel**: Principiante/Intermedio/Avanzado

### En Modal de Confirmación  
- **Duración**: Frecuencia semanal específica
- **Intensidad**: Nivel exacto
- **Objetivo**: Meta principal de la metodología

---

**Última actualización**: Agosto 2025  
**Versión**: 1.0  
**Estado**: ✅ Implementación completa funcional