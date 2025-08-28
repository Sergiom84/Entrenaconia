# Sistema de Estilos y Diseño - Entrena con IA

## 🎨 Paleta de Colores

### Colores Principales
```css
/* Sistema de colores basado en Tailwind */
:root {
  /* Primarios */
  --primary-yellow: #FACC15;     /* Amarillo principal (yellow-400) */
  --primary-yellow-300: #FDE047; /* Amarillo claro hover */
  --primary-yellow-500: #EAB308; /* Amarillo intenso */
  
  /* Fondos oscuros */
  --background: #000000;         /* Negro absoluto */
  --surface: #1F2937;            /* Gris oscuro (gray-800) */
  --surface-light: #374151;      /* Gris medio (gray-700) */
  
  /* Bordes */
  --border: rgba(250, 204, 21, 0.2);  /* Amarillo con opacidad */
  --border-hover: rgba(250, 204, 21, 0.4);
  
  /* Textos */
  --text-primary: #F1F5F9;       /* Blanco/gris muy claro */
  --text-secondary: #D1D5DB;      /* Gris claro (gray-300) */
  --text-muted: #9CA3AF;         /* Gris medio (gray-400) */
  
  /* Estados */
  --success: #10B981;            /* Verde éxito */
  --warning: #F59E0B;            /* Naranja advertencia */
  --danger: #EF4444;             /* Rojo peligro */
}
```

## 📐 Especificaciones de Componentes

### Tarjetas (Cards)
```css
.card {
  /* Colores del proyecto */
  background: rgb(31 41 55 / 0.8);      /* bg-gray-800/80 */
  border: 1px solid rgba(250, 204, 21, 0.2);  /* border-yellow-400/20 */
  border-radius: 0.75rem;               /* rounded-xl */
  
  /* Dimensiones */
  padding: 1.5rem;                      /* p-6 */
  
  /* Transiciones suaves */
  transition: all 0.3s ease;
}

.card:hover {
  border-color: rgba(250, 204, 21, 0.4);  /* hover:border-yellow-400/40 */
  transform: scale(1.01);                   /* hover:scale-[1.01] */
}

/* Card específica de metodología */
.methodology-card {
  background: rgba(0, 0, 0, 0.8);         /* bg-black/80 */
  border: 1px solid rgb(55 65 81);        /* border-gray-700 */
}

.methodology-card.manual-active {
  cursor: pointer;
}

.methodology-card.manual-active:hover {
  border-color: rgba(250, 204, 21, 0.6); /* hover:border-yellow-400/60 */
}
```

### Modales
```css
.modal {
  /* Fondo principal del proyecto */
  background: rgba(0, 0, 0, 0.95);        /* bg-black/95 */
  border: 1px solid rgba(250, 204, 21, 0.2); /* border-yellow-400/20 */
  border-radius: 1rem;                     /* rounded-xl */
  
  /* Dimensiones responsivas */
  max-width: 32rem;                        /* max-w-2xl para diálogos básicos */
  max-width: 56rem;                        /* max-w-4xl para detalles */
  max-height: 90vh;                        /* max-h-[90vh] */
  padding: 1.5rem;                         /* p-6 */
  
  /* Texto */
  color: white;
  
  /* Scroll */
  overflow-y: auto;
}

.modal-overlay {
  /* Overlay del proyecto */
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.8);         /* bg-black/80 */
  backdrop-filter: blur(2px);             /* backdrop-blur-sm */
  z-index: 50;
  
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

/* Modal de confirmación específico */
.confirmation-modal {
  background: #000000;                     /* bg-black */
  border: 1px solid rgba(250, 204, 21, 0.4); /* border-yellow-400/40 */
  max-width: 32rem;                        /* max-w-2xl */
}
```

### Botones
```css
.button {
  /* Base común */
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.5rem;                   /* rounded-md */
  font-size: 0.875rem;                     /* text-sm */
  font-weight: 500;                        /* font-medium */
  transition: all 0.2s ease;              /* transition-colors */
  
  /* Estados disabled */
  &:disabled {
    opacity: 0.5;
    pointer-events: none;
  }
}

/* Variante primaria - Amarillo del proyecto */
.button-primary {
  background: #FACC15;                     /* bg-yellow-400 */
  color: black;                            /* text-black */
  padding: 0.75rem 1.5rem;               /* py-3 px-6 */
}

.button-primary:hover {
  background: #FDE047;                     /* hover:bg-yellow-300 */
}

/* Variante secundaria - Gris con borde amarillo */
.button-secondary {
  background: #374151;                     /* bg-gray-700 */
  color: #F3F4F6;                         /* text-gray-100 */
  border: 1px solid rgba(250, 204, 21, 0.2); /* border-yellow-400/20 */
  padding: 0.75rem 1.5rem;               /* py-3 px-6 */
}

.button-secondary:hover {
  background: #4B5563;                     /* hover:bg-gray-600 */
}

/* Variante outline */
.button-outline {
  background: transparent;
  border: 1px solid #6B7280;              /* border-gray-600 */
  color: #9CA3AF;                         /* text-gray-300 */
}

.button-outline:hover {
  background: #1F2937;                     /* hover:bg-gray-800 */
  color: white;                           /* hover:text-white */
}

/* Tamaños */
.button-sm { 
  height: 2.25rem;                        /* h-9 */
  padding: 0 0.75rem;                     /* px-3 */
}

.button-md { 
  height: 2.5rem;                         /* h-10 */
  padding: 0 1rem;                        /* px-4 */
}

.button-lg { 
  height: 2.75rem;                        /* h-11 */
  padding: 0 2rem;                        /* px-8 */
}
```

## 📝 Tipografía

### Fuentes
```css
/* Sistema de fuentes */
--font-sans: 'Inter', system-ui, -apple-system, sans-serif;
--font-mono: 'Fira Code', 'Courier New', monospace;

/* Tamaños */
--text-xs: 0.75rem;    /* 12px */
--text-sm: 0.875rem;   /* 14px */
--text-base: 1rem;     /* 16px */
--text-lg: 1.125rem;   /* 18px */
--text-xl: 1.25rem;    /* 20px */
--text-2xl: 1.5rem;    /* 24px */
--text-3xl: 1.875rem;  /* 30px */
--text-4xl: 2.25rem;   /* 36px */

/* Pesos */
--font-light: 300;
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
```

### Encabezados
```css
h1 {
  font-size: var(--text-4xl);
  font-weight: var(--font-bold);
  color: var(--text-primary);
  margin-bottom: 1rem;
}

h2 {
  font-size: var(--text-3xl);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin-bottom: 0.75rem;
}

h3 {
  font-size: var(--text-2xl);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin-bottom: 0.5rem;
}
```

## 🎯 Componentes Específicos

### Stats Cards
```css
.stats-card {
  background: linear-gradient(135deg, var(--surface) 0%, #2D3748 100%);
  padding: 1.5rem;
  border-radius: 1rem;
  border: 1px solid var(--border);
  
  /* Icono */
  .icon {
    width: 2.5rem;
    height: 2.5rem;
    color: var(--primary);
  }
  
  /* Valor */
  .value {
    font-size: var(--text-3xl);
    font-weight: var(--font-bold);
    color: var(--text-primary);
  }
  
  /* Título */
  .title {
    font-size: var(--text-sm);
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
}
```

### Training Cards
```css
.training-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  padding: 1.25rem;
  
  /* Badge de dificultad */
  .difficulty-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
  }
  
  .difficulty-easy { 
    background: rgba(16, 185, 129, 0.2);
    color: #10B981;
  }
  
  .difficulty-medium { 
    background: rgba(245, 158, 11, 0.2);
    color: #F59E0B;
  }
  
  .difficulty-hard { 
    background: rgba(239, 68, 68, 0.2);
    color: #EF4444;
  }
}
```

## 📱 Responsive Design

### Breakpoints
```css
/* Tailwind Breakpoints */
sm: 640px   /* Móvil grande */
md: 768px   /* Tablet */
lg: 1024px  /* Desktop */
xl: 1280px  /* Desktop grande */
2xl: 1536px /* Desktop extra grande */
```

### Grid System
```css
/* Dashboard Grid */
.dashboard-grid {
  display: grid;
  gap: 1.5rem;
  
  /* Mobile */
  grid-template-columns: 1fr;
  
  /* Tablet */
  @media (min-width: 768px) {
    grid-template-columns: repeat(2, 1fr);
  }
  
  /* Desktop */
  @media (min-width: 1024px) {
    grid-template-columns: repeat(3, 1fr);
  }
}
```

## 🎭 Animaciones

### Transiciones Estándar
```css
/* Duración */
--duration-fast: 150ms;
--duration-normal: 300ms;
--duration-slow: 500ms;

/* Easing */
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
--ease-out: cubic-bezier(0, 0, 0.2, 1);
--ease-in: cubic-bezier(0.4, 0, 1, 1);
```

### Animaciones Comunes
```css
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from { 
    transform: translateY(10px);
    opacity: 0;
  }
  to { 
    transform: translateY(0);
    opacity: 1;
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
```