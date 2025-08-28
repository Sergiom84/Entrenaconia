# Guía de Armonía Visual - Entrena con IA

## 🎯 Objetivo

Esta guía garantiza que todas las secciones de la aplicación mantengan la **coherencia visual** y **experiencia de usuario unificada**, basándose en los patrones identificados en **Metodologías**, **Rutinas** y **Entrenamiento en Casa**.

## 📐 Reglas de Diseño Universal

### 1. Fondo y Contenedores Base

**✅ USAR SIEMPRE**:
```jsx
// Fondo principal de toda sección
<div className="min-h-screen bg-black text-white">
  
// Container responsivo principal  
<div className="max-w-6xl mx-auto p-6">

// Container específico para contenido centrado
<div className="max-w-4xl mx-auto">
```

**❌ EVITAR**: Fondos diferentes a negro, contenedores sin max-width

### 2. Sistema de Cards Obligatorio

**✅ ESTRUCTURA ESTÁNDAR**:
```jsx
<Card className="bg-gray-800/80 border-yellow-400/20">
  <CardHeader className="pb-3">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Icon className="w-7 h-7 text-yellow-400" />
        <CardTitle className="text-white text-xl">Título</CardTitle>
      </div>
      <Badge className="border-yellow-400 text-yellow-400">Estado</Badge>
    </div>
    <CardDescription className="text-gray-400">Descripción</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Contenido con espaciado space-y-4 */}
  </CardContent>
</Card>
```

**✅ VARIANTES PERMITIDAS**:
- `bg-gray-800/50` para cards menos prominentes
- `bg-black/80` para cards de selección (metodologías)
- `bg-gray-800/70` para cards de progreso

**❌ PROHIBIDO**: Fondos sin transparencia, bordes de otros colores que no sea amarillo

### 3. Modales Estandarizados

**✅ PLANTILLA OBLIGATORIA**:
```jsx
<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent className="max-w-2xl bg-black/95 border-yellow-400/20 text-white max-h-[90vh] overflow-y-auto">
    <DialogHeader>
      <div className="flex items-center justify-between">
        <div>
          <DialogTitle className="text-2xl text-white flex items-center">
            <Icon className="w-6 h-6 mr-2 text-yellow-400" />
            Título del Modal
          </DialogTitle>
          <DialogDescription className="text-gray-400 mt-2">
            Descripción opcional
          </DialogDescription>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>
    </DialogHeader>

    <div className="space-y-6">
      {/* Contenido principal */}
    </div>

    <DialogFooter className="flex justify-between pt-4 border-t border-gray-700">
      <Button variant="outline">Cancelar</Button>
      <Button className="bg-yellow-400 text-black hover:bg-yellow-300">
        Acción Principal
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**✅ TAMAÑOS PERMITIDOS**:
- `max-w-md`: Confirmaciones simples
- `max-w-2xl`: Modales estándar  
- `max-w-4xl`: Modales con mucha información

### 4. Grids de Información Consistentes

**✅ GRID 4 COLUMNAS (métricas principales)**:
```jsx
<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
  {metrics.map((metric, idx) => (
    <div key={idx} className="p-3 rounded-lg bg-[color]/10 border border-[color]/30">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-[color]" />
        <span className="text-xs uppercase tracking-wide text-[color]">
          {metric.label}
        </span>
      </div>
      <div className="text-lg font-semibold text-white">{metric.value}</div>
    </div>
  ))}
</div>
```

**✅ COLORES POR TIPO DE MÉTRICA**:
- **Metodología/Objetivo**: `yellow-400`
- **Duración/Tiempo**: `blue-400`  
- **Frecuencia/Series**: `green-400`
- **Progresión/Intensidad**: `purple-400`
- **Dificultad**: `red-400`

**✅ GRID 2 COLUMNAS (detalles)**:
```jsx
<div className="grid grid-cols-2 gap-4 text-sm">
  <div className="flex justify-between">
    <span className="text-gray-400">Label:</span>
    <span className="text-white font-medium">Value</span>
  </div>
</div>
```

## 🔘 Sistema de Botones Obligatorio

### Jerarquía Visual Estricta

**1. PRIMARIO** (Una sola acción principal por pantalla):
```jsx
<Button className="bg-yellow-400 text-black hover:bg-yellow-300">
  <Icon className="w-4 h-4 mr-2" />
  Acción Principal
</Button>
```

**2. SECUNDARIO** (Acciones importantes pero no principales):
```jsx
<Button className="bg-gray-700 hover:bg-gray-600 text-gray-100 border border-yellow-400/20">
  Acción Secundaria
</Button>
```

**3. OUTLINE** (Acciones neutrales/cancelar):
```jsx
<Button variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white">
  Cancelar
</Button>
```

**4. ESTADOS ESPECÍFICOS**:
```jsx
// Éxito/Completado
<Button className="bg-green-600 hover:bg-green-500 text-white">

// Destructivo/Eliminar
<Button className="bg-red-600 hover:bg-red-500 text-white">

// Información/Navegación
<Button className="bg-blue-600 hover:bg-blue-500 text-white">
```

## 🎨 Estados Visuales Universales

### Estados de Elementos Interactivos

**✅ NORMAL**:
```css
transition: all 0.3s ease;
border: 1px solid rgba(250, 204, 21, 0.2);
```

**✅ HOVER**:
```css
border-color: rgba(250, 204, 21, 0.4);
transform: scale(1.01); /* o translateY(-2px) */
```

**✅ ACTIVO/SELECCIONADO**:
```css
border-color: #FACC15;
box-shadow: 0 0 0 2px rgba(250, 204, 21, 0.3);
```

### Estados de Progreso

**✅ COMPLETADO**:
```jsx
className="text-green-400 bg-green-900/20 border-green-500"
```

**✅ EN PROGRESO**:
```jsx  
className="text-blue-400 bg-blue-900/20 border-blue-500"
```

**✅ PENDIENTE**:
```jsx
className="text-gray-400 bg-gray-700/30 border-gray-600"
```

**✅ ERROR/CANCELADO**:
```jsx
className="text-red-400 bg-red-900/20 border-red-500"
```

## 📊 Barras de Progreso Estandarizadas

**✅ PLANTILLA OBLIGATORIA**:
```jsx
<div className="mb-4">
  <div className="flex justify-between text-sm text-gray-400 mb-1">
    <span>Progreso</span>
    <span>{Math.round(percentage)}%</span>
  </div>
  <div className="w-full bg-gray-700 rounded-full h-3">
    <div 
      className="bg-gradient-to-r from-green-500 to-blue-500 h-3 rounded-full transition-all duration-500"
      style={{ width: `${percentage}%` }}
    />
  </div>
</div>
```

**✅ VARIANTES PERMITIDAS**:
- `from-yellow-400 to-orange-500`: Para progreso de sesión
- `from-green-500 to-blue-500`: Para progreso general
- `from-blue-500 to-purple-500`: Para progreso semanal

## 🏷️ Sistema de Badges y Labels

**✅ BADGES ESTÁNDAR**:
```jsx
// Nivel/Dificultad
<Badge className="border-yellow-400 text-yellow-400 bg-yellow-400/10">
  {level}
</Badge>

// Tipo/Categoría
<Badge className="bg-blue-400/20 text-blue-400 border-blue-400/30">
  {type}  
</Badge>

// Estado
<Badge className="bg-green-400/20 text-green-400">
  ✓ Completado
</Badge>
```

**✅ LABELS DE MÉTRICAS**:
```jsx
<span className="text-xs uppercase tracking-wide text-[color]">
  LABEL
</span>
```

## ⏱️ Indicadores de Carga Obligatorios

**✅ SPINNER INLINE**:
```jsx
<div className="w-4 h-4 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
```

**✅ OVERLAY DE CARGA**:
```jsx
<div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
  <div className="bg-gray-800 border border-yellow-400/30 rounded-lg p-8 text-center shadow-xl">
    <svg className="w-12 h-12 text-yellow-400 animate-spin mx-auto mb-4" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
    </svg>
    <p className="text-white font-semibold text-lg">Mensaje de carga</p>
    <p className="text-gray-400 text-sm mt-2">Descripción opcional</p>
  </div>
</div>
```

## 🔤 Tipografía Estricta

### Jerarquía Obligatoria

**✅ TÍTULOS PRINCIPALES**:
```jsx
<h1 className="text-3xl font-bold text-yellow-400 mb-2">
```

**✅ SUBTÍTULOS**:
```jsx
<h2 className="text-xl font-semibold text-white mb-4">
```

**✅ LABELS/ETIQUETAS**:
```jsx
<span className="text-xs uppercase tracking-wide text-[color]">
```

**✅ TEXTO PRINCIPAL**:
```jsx
<p className="text-gray-100 leading-relaxed">
```

**✅ TEXTO SECUNDARIO**:
```jsx
<p className="text-gray-400 text-sm">
```

**✅ VALORES/MÉTRICAS**:
```jsx
<div className="text-lg font-semibold text-white">
```

## 📱 Layout Responsivo Consistente

### Breakpoints Estándar
```jsx
// Mobile first approach
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

// Padding responsivo
<div className="p-4 md:p-6">

// Text responsive
<h1 className="text-2xl md:text-3xl lg:text-4xl">
```

### Contenedores Responsivos
```jsx
// Para secciones principales
<div className="max-w-6xl mx-auto">

// Para contenido centrado
<div className="max-w-4xl mx-auto">

// Para modales/formularios
<div className="max-w-2xl mx-auto">
```

## 🎯 Patrones de Implementación

### Flujo de Estados para Nuevas Secciones

1. **Estados de carga**: Usar siempre overlay con spinner amarillo
2. **Estados vacíos**: Ícono grande gris + mensaje + CTA amarillo
3. **Estados de error**: Alert rojo con ícono AlertCircle
4. **Estados de éxito**: Alert verde con ícono CheckCircle

### Navegación Consistente

**✅ BOTÓN DE RETORNO**:
```jsx
<Button 
  onClick={handleBack}
  variant="outline" 
  className="mb-6 border-yellow-400/50 text-yellow-400 hover:border-yellow-400 hover:bg-yellow-400/10"
>
  <ArrowLeft className="w-4 h-4 mr-2" />
  Volver a [Sección]
</Button>
```

**✅ HEADER DE SECCIÓN**:
```jsx
<div className="text-center mb-12">
  <h1 className="text-3xl md:text-4xl font-bold text-yellow-400 mb-2">
    Título de la Sección
  </h1>
  <p className="text-lg text-gray-300 max-w-4xl mx-auto">
    Descripción de la funcionalidad
  </p>
</div>
```

## ✨ Microinteracciones Requeridas

### Transiciones Obligatorias
```css
/* Todos los elementos interactivos */
transition: all 0.3s ease;

/* Hover effects */
transition: colors 0.2s ease;
transition: transform 0.2s ease;

/* Progreso y estados */
transition: all 0.5s ease;
```

### Efectos Hover Estándar
- **Cards**: `scale(1.01)` + cambio borde
- **Botones**: Cambio color + leve shadow
- **Items calendario**: `bg-yellow-400/10`

## 🚫 Elementos Prohibidos

**❌ NO USAR JAMÁS**:
- Fondos que no sean negro/gris oscuro
- Colores primarios que no sean amarillo
- Bordes de colores que no sea amarillo/gris
- Cards sin transparencia
- Botones sin jerarquía visual clara
- Modales sin overlay oscuro
- Texto blanco puro (#ffffff) - usar `text-white` de Tailwind
- Espaciado inconsistente
- Transiciones bruscas
- Estados sin feedback visual

## 📋 Checklist de Implementación

Antes de crear cualquier componente nuevo:

**✅ Verificar**:
- [ ] ¿Usa el fondo negro estándar?
- [ ] ¿Sigue la estructura de Card establecida?
- [ ] ¿Usa los colores de estado correctos?
- [ ] ¿Implementa los hover effects estándar?
- [ ] ¿Incluye indicadores de carga apropiados?
- [ ] ¿Mantiene la jerarquía de botones?
- [ ] ¿Usa la tipografía establecida?
- [ ] ¿Es responsivo con los breakpoints estándar?
- [ ] ¿Incluye transiciones suaves?
- [ ] ¿Sigue los patrones de espaciado?

---

**🎯 Objetivo Final**: Que cualquier usuario pueda navegar entre Metodologías → Rutinas → Entrenamiento en Casa y sentir una experiencia completamente unificada y predecible.

**📈 Resultado**: Aplicación con identidad visual sólida, fácil de mantener y expandir.