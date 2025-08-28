# Patrones Visuales Comunes - Entrena con IA

## 🎨 Análisis de Consistencia Visual

Basado en el análisis detallado de los componentes de **Metodologías**, **Rutinas** y **Entrenamiento en Casa**, he identificado los patrones visuales comunes que mantienen la cohesión en toda la aplicación.

## 📋 Estructura de Cards Consistente

### Patrón Base de Tarjetas
**Aplicado en**: MethodologyCard, RoutineCalendar, HomeTrainingCard, RoutineScreen

```jsx
// Estructura visual común
<Card className="bg-gray-800/80 border-yellow-400/20">
  <CardHeader>
    <Icon + Title + Badge/State>
    <Description>
  </CardHeader>
  <CardContent>
    <InfoGrid> // Métricas en grid 2-4 columnas
    <ActionButtons> // Botones alineados
  </CardContent>
</Card>
```

**Elementos consistentes**:
- Fondo: `bg-gray-800` con transparencias (`/80`, `/50`, `/70`)
- Bordes: `border-yellow-400/20` (estándar) a `border-yellow-400/40` (énfasis)
- Esquinas redondeadas: `rounded-xl` o `rounded-2xl`
- Padding uniforme: `p-6` para contenido principal

## 💫 Sistema de Estados Visuales

### Estados de Interactividad
**Consistente en todas las secciones**:

```css
/* Estado normal */
.interactive-card {
  transition: all 0.3s ease;
  border: 1px solid rgba(250, 204, 21, 0.2);
}

/* Estado hover */
.interactive-card:hover {
  border-color: rgba(250, 204, 21, 0.4);
  transform: scale(1.01); /* o translateY(-2px) */
  background: bg-gray-800/90;
}

/* Estado activo/seleccionado */
.interactive-card.active {
  border-color: #FACC15; /* yellow-400 */
  ring: 2px ring-yellow-400/30;
  background: bg-gray-800;
}
```

### Indicadores de Estado
**Patrones encontrados**:

1. **Estado completado**: 
   - Color: `text-green-400`, `border-green-500`, `bg-green-900/20`
   - Ícono: CheckCircle

2. **Estado en progreso**:
   - Color: `text-blue-400`, `border-blue-500`, `bg-blue-900/20`  
   - Ícono: PlayCircle

3. **Estado pendiente**:
   - Color: `text-gray-400`, `border-gray-600`, `bg-gray-700/30`

4. **Estado de error/cancelado**:
   - Color: `text-red-400`, `border-red-500`, `bg-red-900/20`

## 🔲 Grids de Información Consistentes

### Grid 4 Columnas (Desktop)
**Usado en**: RoutineScreen summary, MethodologyConfirmationModal, HomeTrainingProgress

```jsx
<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
  <div className="p-3 rounded-lg bg-[color]/10 border border-[color]/30">
    <div className="flex items-center gap-2 mb-2">
      <Icon className="w-4 h-4 text-[color]" />
      <span className="text-xs uppercase tracking-wide text-[color]">Label</span>
    </div>
    <div className="text-lg font-semibold text-white">Value</div>
  </div>
</div>
```

**Colores por métrica**:
- Metodología/Objetivo: `yellow-400`
- Duración/Tiempo: `blue-400`
- Frecuencia/Series: `green-400`
- Progresión/Intensidad: `purple-400`

### Grid 2 Columnas (Mobile-first)
**Usado en**: Exercise details, MethodologyCard metrics

```jsx
<div className="grid grid-cols-2 gap-4 text-sm">
  <div className="flex justify-between">
    <span className="text-gray-400">Label:</span>
    <span className="text-white font-medium">Value</span>
  </div>
</div>
```

## 🎯 Sistema de Modales Unificado

### Estructura Modal Estándar
**Aplicado en**: MethodologyDetailsDialog, RoutineDayModal, HomeTrainingPlanModal

```jsx
<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent className="max-w-2xl bg-black/95 border-yellow-400/20 text-white">
    <DialogHeader>
      <DialogTitle className="flex items-center">
        <Icon className="w-6 h-6 mr-2 text-yellow-400" />
        Title
      </DialogTitle>
      <DialogDescription className="text-gray-400">
        Subtitle/description
      </DialogDescription>
    </DialogHeader>
    
    {/* Content with consistent spacing */}
    <div className="space-y-6">
      {/* Info cards con bg-[color]/10 border border-[color]/30 */}
    </div>
    
    <DialogFooter className="flex justify-between">
      <Button variant="outline">Cancelar</Button>
      <Button className="bg-yellow-400 text-black">Confirmar</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**Características consistentes**:
- Fondo: `bg-black/95` (semi-transparente)
- Tamaños: `max-w-2xl` (básico), `max-w-4xl` (detalles)
- Altura máxima: `max-h-[90vh]`
- Scroll: `overflow-y-auto`

## 🔘 Sistema de Botones Coherente

### Jerarquía Visual de Botones

1. **Primario (CTA principal)**:
   ```jsx
   <Button className="bg-yellow-400 text-black hover:bg-yellow-300">
     <Icon className="w-4 h-4 mr-2" />
     Texto de acción
   </Button>
   ```

2. **Secundario (Acciones alternativas)**:
   ```jsx
   <Button className="bg-gray-700 hover:bg-gray-600 text-gray-100 border border-yellow-400/20">
     Texto secundario
   </Button>
   ```

3. **Outline (Acciones neutras)**:
   ```jsx
   <Button variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-800">
     Cancelar
   </Button>
   ```

4. **Estados específicos**:
   - Verde: Estados completados o éxito
   - Rojo: Acciones destructivas o errores
   - Azul: Información o navegación

## ⏱️ Indicadores de Carga Consistentes

### Spinner Estándar
**Usado en**: MethodologiesScreen, HomeTrainingSection, RoutineExerciseModal

```jsx
// Spinner inline
<div className="w-4 h-4 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />

// Overlay completo
<div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
  <div className="bg-gray-800 border border-yellow-400/30 rounded-lg p-8 text-center">
    <svg className="w-12 h-12 text-yellow-400 animate-spin mx-auto mb-4" />
    <p className="text-white font-semibold">Mensaje de carga</p>
  </div>
</div>
```

## 🏷️ Sistema de Badges y Tags

### Badges de Estado
**Consistente en toda la aplicación**:

```jsx
// Badge de nivel/dificultad
<Badge className="border-yellow-400 text-yellow-400 bg-yellow-400/10">
  Intermedio
</Badge>

// Badge de tipo/categoría  
<Badge className="bg-blue-400/20 text-blue-400">
  Funcional
</Badge>

// Badge de estado
<Badge className="bg-green-400/20 text-green-400">
  Completado
</Badge>
```

## 📊 Barras de Progreso Estandarizadas

### Progreso Visual
**Usado en**: HomeTrainingProgress, RoutineScreen, SessionProgress

```jsx
<div className="w-full bg-gray-700 rounded-full h-3">
  <div 
    className="bg-gradient-to-r from-green-500 to-blue-500 h-3 rounded-full transition-all duration-500"
    style={{ width: `${percentage}%` }}
  />
</div>
```

## 🎨 Microinteracciones Consistentes

### Transiciones Estándar
```css
/* Para todos los elementos interactivos */
transition: all 0.3s ease;

/* Para hover effects específicos */
transition: colors 0.2s ease;
transition: transform 0.2s ease;

/* Para barras de progreso */
transition: all 0.5s ease;
```

### Hover Effects Comunes
1. **Cards**: `hover:scale-[1.01]` + cambio de borde
2. **Botones**: Cambio de color background
3. **Elementos de calendario**: `hover:bg-yellow-400/10`

## 🔤 Tipografía Consistente

### Jerarquía de Texto
```jsx
// Títulos principales
<h1 className="text-3xl font-bold text-yellow-400">

// Subtítulos de sección  
<h2 className="text-xl font-semibold text-white">

// Labels/etiquetas
<span className="text-xs uppercase tracking-wide text-[color]">

// Descripción/texto secundario
<p className="text-gray-400 text-sm">

// Valores/métricas
<div className="text-lg font-semibold text-white">
```

## 🎯 Patrones de Layout

### Contenedores Responsivos
```jsx
// Layout principal
<div className="min-h-screen bg-black">
  <div className="max-w-6xl mx-auto p-6">
    {/* Contenido */}
  </div>
</div>

// Cards grid responsivo  
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
```

### Espaciado Consistente
- Padding interno cards: `p-6`
- Espaciado entre secciones: `mb-6`, `mb-8`
- Gap en grids: `gap-4`, `gap-6`
- Espaciado en listas: `space-y-3`, `space-y-4`

---

**Conclusión**: El análisis revela un sistema de diseño maduro y consistente que utiliza patrones visuales claros para mantener la cohesión entre todas las secciones de la aplicación, facilitando la extensión futura manteniendo la armonía visual.