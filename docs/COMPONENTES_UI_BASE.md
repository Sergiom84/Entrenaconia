# Componentes UI Base - Entrena con IA

## 🎨 Sistema de Diseño

El proyecto utiliza un sistema de componentes base ubicados en `src/components/ui/` que proporcionan consistencia visual y funcional en toda la aplicación.

## 🃏 Card System

### Card
**Ubicación**: `src/components/ui/card.jsx`

**Componentes disponibles**:
```jsx
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardContent, 
  CardFooter 
} from '@/components/ui/card.jsx'
```

**Estructura básica**:
```jsx
<Card className="bg-gray-800 border-yellow-400/20">
  <CardHeader>
    <CardTitle>Título</CardTitle>
    <CardDescription>Descripción</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Contenido principal */}
  </CardContent>
  <CardFooter>
    {/* Botones de acción */}
  </CardFooter>
</Card>
```

**Clases CSS base**:
- `Card`: `rounded-lg border bg-card text-card-foreground shadow-sm`
- `CardHeader`: `flex flex-col space-y-1.5 p-6`
- `CardTitle`: `text-2xl font-semibold leading-none tracking-tight`
- `CardDescription`: `text-sm text-muted-foreground`
- `CardContent`: `p-6 pt-0`
- `CardFooter`: `flex items-center p-6 pt-0`

## 🔘 Button System

### Button
**Ubicación**: `src/components/ui/button.jsx`

**Variantes disponibles**:
- `default`: Estilo primario estándar
- `destructive`: Para acciones peligrosas
- `outline`: Botón con borde sin fondo
- `secondary`: Estilo secundario
- `ghost`: Botón transparente
- `link`: Estilo de enlace con subrayado

**Tamaños disponibles**:
- `sm`: Botón pequeño (h-9 px-3)
- `default`: Tamaño estándar (h-10 py-2 px-4) 
- `lg`: Botón grande (h-11 px-8)

**Uso en el proyecto**:
```jsx
// Botón primario amarillo (customizado)
<Button className="bg-yellow-400 text-black hover:bg-yellow-300">
  Activar IA
</Button>

// Botón outline para acciones secundarias
<Button variant="outline" className="border-gray-600 text-gray-300">
  Ver Detalles
</Button>
```

## 💬 Dialog System

### Dialog
**Ubicación**: `src/components/ui/dialog.jsx`

**Componentes del sistema**:
```jsx
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from '@/components/ui/dialog.jsx'
```

**Estructura base**:
```jsx
<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent className="max-w-2xl bg-black border-yellow-400/20">
    <DialogHeader>
      <DialogTitle>Título del Modal</DialogTitle>
      <DialogDescription>Descripción opcional</DialogDescription>
    </DialogHeader>
    
    {/* Contenido principal */}
    
    <DialogFooter>
      <Button variant="outline">Cancelar</Button>
      <Button className="bg-yellow-400 text-black">Confirmar</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**Características**:
- **Overlay automático**: Fondo semi-transparente con blur
- **Cierre por click**: Click fuera del modal para cerrar
- **Responsive**: Adaptado a diferentes tamaños de pantalla
- **Z-index management**: Control automático de capas

## 🏷️ Badge System

### Badge
**Ubicación**: `src/components/ui/badge.jsx`

**Uso en metodologías**:
```jsx
<Badge variant="outline" className="border-yellow-400 text-yellow-400">
  Intermedio
</Badge>
```

**Variantes típicas**:
- `default`: Badge sólido
- `outline`: Badge con borde
- `destructive`: Para estados de error/peligro

## 📋 Form Components

### Input
**Ubicación**: `src/components/ui/input.jsx`

**Clases base del proyecto**:
```css
.form-input {
  @apply w-full bg-gray-700/60 border border-yellow-400/20 
         rounded-lg px-4 py-3 text-gray-100 placeholder-gray-300 
         focus:outline-none focus:border-yellow-400 transition-colors;
}
```

### Label
**Ubicación**: `src/components/ui/label.jsx`

**Uso estándar**:
```jsx
<Label className="block text-gray-100 font-semibold mb-2">
  Etiqueta del campo
</Label>
```

## 🔘 Radio Group System

### RadioGroup
**Ubicación**: `src/components/ui/radio-group.jsx`

**Uso en selección de modos**:
```jsx
<RadioGroup value={selectionMode} onValueChange={setSelectionMode}>
  <div className="flex items-center gap-2">
    <RadioGroupItem value="automatico" id="automatico" />
    <Label htmlFor="automatico">Automático</Label>
  </div>
</RadioGroup>
```

## 📑 Tabs System

### Tabs
**Ubicación**: `src/components/ui/tabs.jsx`

**Componentes del sistema**:
```jsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx'
```

**Uso en detalles de metodología**:
```jsx
<Tabs defaultValue="principles" className="w-full">
  <TabsList className="grid w-full grid-cols-4 bg-gray-800">
    <TabsTrigger value="principles">Principios</TabsTrigger>
    <TabsTrigger value="benefits">Beneficios</TabsTrigger>
    <TabsTrigger value="target">Dirigido a</TabsTrigger>
    <TabsTrigger value="science">Ciencia</TabsTrigger>
  </TabsList>
  
  <TabsContent value="principles" className="mt-4">
    {/* Contenido de principios */}
  </TabsContent>
</Tabs>
```

## ⚡ Alert System

### Alert
**Ubicación**: `src/components/ui/alert.jsx`

**Uso para mostrar errores**:
```jsx
<Alert className="mb-6 bg-red-900/30 border-red-400/40">
  <AlertCircle className="w-4 h-4 text-red-400" />
  <AlertDescription className="text-red-200">
    {error}
  </AlertDescription>
</Alert>
```

## 📏 Separator

### Separator
**Ubicación**: `src/components/ui/separator.jsx`

**Uso para divisiones visuales**:
```jsx
<Separator className="bg-yellow-400/20" />
```

## 🎨 Tema Visual Consistente

### Paleta de Colores Aplicada

**Fondos**:
- `bg-black`: Fondo principal absoluto
- `bg-gray-800`: Superficie de componentes
- `bg-black/95`: Modales con transparencia
- `bg-yellow-400/10`: Fondos de highlight

**Bordes**:
- `border-yellow-400/20`: Bordes estándar
- `border-yellow-400/40`: Bordes de énfasis
- `border-gray-700`: Bordes neutros

**Textos**:
- `text-white`: Texto principal
- `text-gray-300`: Texto secundario
- `text-gray-400`: Texto muted
- `text-yellow-400`: Texto de énfasis

### Transiciones Estándar

Todos los componentes incluyen:
```css
transition: all 0.2s ease;
```

Para hover effects y cambios de estado suaves.

## 🔧 Utilidades

### cn (Class Name utility)
**Ubicación**: `src/lib/utils.js`

**Función**: Combina classes condicionales
```jsx
import { cn } from '@/lib/utils'

<div className={cn(
  'base-classes',
  condition && 'conditional-classes',
  className
)} />
```

## 📱 Responsive Design

### Breakpoints utilizados
- `sm`: 640px - Móvil grande
- `md`: 768px - Tablet  
- `lg`: 1024px - Desktop
- `xl`: 1280px - Desktop grande

### Patrones comunes
```jsx
// Grid responsive
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

// Padding responsive  
<div className="p-4 md:p-6">

// Text responsive
<h1 className="text-2xl md:text-3xl lg:text-4xl">
```

---

**Estado**: ✅ Componentes base implementados  
**Última actualización**: Agosto 2025  
**Consistencia**: Sistema unificado de diseño