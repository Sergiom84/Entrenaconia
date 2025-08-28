# Guía de Componentes y Funcionalidades - Entrena con IA

## 🎯 Componentes Principales

### Sistema de Metodologías

#### 🧠 MethodologiesScreen
**Ubicación**: `src/components/Methodologie/MethodologiesScreen.jsx`
**Función**: Pantalla principal para selección de metodologías de entrenamiento

**Estados principales**:
- `selectionMode`: 'automatico' | 'manual'
- `isLoading`: Estado de generación de plan
- `showDetails`: Control de modal de detalles

**Botones/Acciones**:
- **Selector Automático**: Activa modo IA con botón "Activar IA"
- **Selector Manual**: Permite selección directa de metodología
- **Cards de metodología**: Click abre modal de confirmación (solo modo manual)
- **Botón "Ver Detalles"**: Abre información completa de metodología

---

#### 🏋️ MethodologyCard
**Ubicación**: `src/components/Methodologie/MethodologyCard.jsx`
**Función**: Tarjeta individual de metodología con información e interacciones

**Props**:
```jsx
{
  methodology: Object,    // Datos de la metodología
  manualActive: boolean,  // Si el modo manual está activo
  onDetails: Function,    // Callback para abrir detalles
  onSelect: Function      // Callback para selección
}
```

**Estructura visual**:
- **Header**: Icono + título + badge de nivel
- **Descripción**: Texto explicativo de la metodología
- **Métricas**: Frecuencia, volumen, intensidad
- **Acciones**: Botones "Ver Detalles" y "Seleccionar Metodología"

**Estados interactivos**:
- **Manual activo**: Cursor pointer, hover effects, seleccionable
- **Manual inactivo**: Solo botón "Ver Detalles" funcional

---

#### 💬 MethodologyDetailsDialog
**Ubicación**: `src/components/Methodologie/MethodologyDetailsDialog.jsx`
**Función**: Modal completo con información detallada de metodología

**Props**:
```jsx
{
  open: boolean,
  onOpenChange: Function,
  detailsMethod: Object,
  selectionMode: string,
  onClose: Function,
  onSelect: Function
}
```

**Estructura de información**:
- **Descripción completa**: Texto detallado de la metodología
- **Video placeholder**: Preparado para contenido multimedia futuro
- **Tabs informativos**: 4 pestañas con información específica

**Tabs disponibles**:
1. **Principios**: Fundamentos básicos de la metodología
2. **Beneficios**: Ventajas y resultados esperados  
3. **Dirigido a**: Público objetivo y especificaciones
4. **Ciencia**: Base científica y fundamentos teóricos

**Botones/Acciones**:
- **Botón "Cerrar"**: Cierra modal sin acción
- **Botón "Seleccionar"**: Solo activo en modo manual, ejecuta selección

---

#### ✅ MethodologyConfirmationModal
**Ubicación**: `src/components/Methodologie/MethodologyConfirmationModal.jsx`
**Función**: Modal de confirmación para selección manual de metodología

**Información mostrada**:
- **Metodología seleccionada**: Nombre y descripción en card destacada
- **Características principales**: Grid con puntos clave (2 columnas)
- **Métricas del plan**: Frecuencia, Intensidad, Objetivo (cards con iconos)
- **Información importante**: Warning sobre personalización del plan

**Estados**:
- **Normal**: Información estática con botones activos
- **Generando**: Spinner, botones deshabilitados, texto dinámico
- **Success**: Navegación automática a rutinas

**Botones/Acciones**:
- **"Cancelar"** (Outline): Cierra sin acción
- **"Confirmar y Generar"** (Amarillo): Inicia generación del plan

---

### 🏠 HomeTrainingSection
**Ubicación**: `src/components/HomeTraining/HomeTrainingSection.jsx`
**Función**: Componente principal de entrenamiento en casa

**Estructura técnica**:
```typescript
interface HomeTrainingSectionProps {
  userId: string;
  userProfile: UserProfile;
}

const HomeTrainingSection = () => {
  // Estados principales
  const [selectedEquipment, setSelectedEquipment] = useState(null);
  const [selectedTrainingType, setSelectedTrainingType] = useState(null);
  const [generatedPlan, setGeneratedPlan] = useState(null);
  const [currentSession, setCurrentSession] = useState(null);
  const [showExerciseModal, setShowExerciseModal] = useState(false);
  
  // Funciones clave
  const generateTraining = async () => {
    // Genera rutina basada en equipamiento y tipo seleccionado
  };
  
  const startTraining = async () => {
    // Inicia nueva sesión de entrenamiento
  };
  
  const handleExerciseComplete = async (durationSeconds) => {
    // Completa ejercicio y actualiza progreso
  };
}
```

**Botones/Acciones principales**:
- **"Generar Mi Entrenamiento"**: Ejecuta `generateTraining()` con IA
- **"Comenzar Entrenamiento"**: Inicia sesión con `startTraining()`
- **"Continuar Entrenamiento"**: Reanuda sesión en progreso
- **Cards de equipamiento**: Selección de tipo de equipamiento disponible
- **Botones tipo entrenamiento**: Funcional, HIIT, Fuerza

---

### Secciones Funcionales

#### 🏠 Entrenamiento en Casa
**Ubicación**: `/src/app/dashboard/training/home`
**Función**: Planes específicos para entrenar sin equipamiento

**Características**:
- Ejercicios con peso corporal
- Adaptable a espacios pequeños
- Videos demostrativos
- Progresiones por nivel

**Botones/Acciones**:
- **"Generar Plan Casero"**: Crea rutina personalizada
- **"Ver Ejercicios"**: Biblioteca de movimientos
- **"Configurar Espacio"**: Define limitaciones del espacio

---

#### 🥗 Nutrición
**Ubicación**: `/src/app/dashboard/nutrition`
**Función**: Gestión de planes nutricionales

**Características**:
- Cálculo de macronutrientes
- Recetas personalizadas
- Seguimiento de calorías
- Lista de compras

**Botones/Acciones**:
- **"Generar Plan Nutricional"**: Crea plan según objetivos
- **"Registrar Comida"**: Log de alimentos consumidos
- **"Ver Recetas"**: Biblioteca de recetas saludables
- **"Calcular Macros"**: Calculadora de macronutrientes

---

#### 📈 Progreso
**Ubicación**: `/src/app/dashboard/progress`
**Función**: Seguimiento y visualización del progreso

**Características**:
- Gráficos de evolución
- Fotos de progreso
- Medidas corporales
- Logros desbloqueados

**Botones/Acciones**:
- **"Registrar Medidas"**: Añade nuevas mediciones
- **"Subir Foto"**: Añade foto de progreso
- **"Ver Historial"**: Timeline completo
- **"Exportar Datos"**: Descarga en PDF/Excel

---

### Modales y Diálogos

#### 💬 Modal de Confirmación
**Función**: Confirmar acciones destructivas

**Botones**:
- **"Confirmar"** (Rojo): Ejecuta la acción
- **"Cancelar"** (Gris): Cierra sin cambios

#### 📝 Modal de Edición
**Función**: Editar planes y configuraciones

**Botones**:
- **"Guardar"** (Azul): Guarda cambios
- **"Cancelar"** (Gris): Descarta cambios
- **"Restablecer"** (Naranja): Vuelve a valores originales

#### ℹ️ Modal de Información
**Función**: Mostrar información detallada

**Botones**:
- **"Cerrar"** (Gris): Cierra el modal
- **"Más Info"** (Azul): Enlaces a documentación

## 🔘 Referencia de Botones

### Botones Primarios
- **Crear/Generar**: Acciones principales de creación
- **Guardar**: Persistir cambios
- **Iniciar**: Comenzar actividades

### Botones Secundarios
- **Editar**: Modificar elementos existentes
- **Ver Más**: Expandir información
- **Configurar**: Ajustar preferencias

### Botones de Peligro
- **Eliminar**: Remover permanentemente
- **Cancelar Suscripción**: Acciones irreversibles

### Botones de Navegación
- **Volver**: Regresar a vista anterior
- **Siguiente**: Avanzar en proceso
- **Ir a**: Navegación directa