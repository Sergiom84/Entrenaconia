# Guía de Componentes y Funcionalidades

## 🎯 Componentes Principales

### Dashboard Components

#### 📊 StatsCard
**Ubicación**: `/src/components/dashboard/StatsCard.tsx`
**Función**: Muestra estadísticas del usuario en tarjetas visuales

**Props**:
```typescript
interface StatsCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  className?: string;
}
```

**Botones/Acciones**:
- Click en tarjeta: Navega a detalles de la estadística
- Hover: Muestra tooltip con información adicional

---

#### 🏋️ TrainingPlanCard
**Ubicación**: `/src/components/dashboard/TrainingPlanCard.tsx`
**Función**: Visualiza planes de entrenamiento individuales

**Props**:
```typescript
interface TrainingPlanCardProps {
  plan: TrainingPlan;
  onEdit?: () => void;
  onDelete?: () => void;
  onStart?: () => void;
}
```

**Botones/Acciones**:
- **Botón "Iniciar"** (`onStart`): Comienza la sesión de entrenamiento
- **Botón "Editar"** (`onEdit`): Abre modal de edición del plan
- **Botón "Eliminar"** (`onDelete`): Elimina el plan con confirmación
- **Botón "Ver Detalles"**: Expande/colapsa información adicional

---

#### 🎯 MethodologySelector
**Ubicación**: `/src/components/dashboard/MethodologySelector.tsx`
**Función**: Permite seleccionar metodologías de entrenamiento

**Metodologías Disponibles**:
1. **HIIT (High Intensity Interval Training)**
   - Función: Entrenamientos de alta intensidad con intervalos
   - Ideal para: Pérdida de grasa, mejora cardiovascular

2. **Fuerza Progresiva**
   - Función: Incremento gradual de cargas
   - Ideal para: Ganancia muscular, fuerza

3. **Entrenamiento Funcional**
   - Función: Movimientos naturales del cuerpo
   - Ideal para: Movilidad, equilibrio, vida diaria

4. **Calistenia**
   - Función: Ejercicios con peso corporal
   - Ideal para: Entrenamiento en casa, flexibilidad

5. **Powerlifting**
   - Función: Levantamientos de potencia
   - Ideal para: Fuerza máxima, competición

**Botones/Acciones**:
- **Selector de Metodología**: Dropdown con descripción
- **Botón "Aplicar"**: Genera plan con metodología seleccionada
- **Botón "Más Info"**: Abre modal con detalles completos

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