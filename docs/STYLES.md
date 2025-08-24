# Sistema de Estilos y Diseño

## 🎨 Paleta de Colores

### Colores Principales
```css
/* Variables CSS en globals.css */
:root {
  /* Primarios */
  --primary: #3B82F6;        /* Azul principal */
  --primary-hover: #2563EB;  /* Azul hover */
  --primary-light: #93C5FD;  /* Azul claro */
  
  /* Secundarios */
  --secondary: #10B981;      /* Verde éxito */
  --warning: #F59E0B;        /* Naranja advertencia */
  --danger: #EF4444;         /* Rojo peligro */
  
  /* Neutros */
  --background: #0F172A;     /* Fondo oscuro */
  --surface: #1E293B;        /* Superficie tarjetas */
  --border: #334155;         /* Bordes */
  --text-primary: #F1F5F9;   /* Texto principal */
  --text-secondary: #94A3B8; /* Texto secundario */
}
```

## 📐 Especificaciones de Componentes

### Tarjetas (Cards)
```css
.card {
  /* Dimensiones */
  padding: 1.5rem;           /* 24px */
  border-radius: 0.75rem;    /* 12px */
  
  /* Colores */
  background: var(--surface);
  border: 1px solid var(--border);
  
  /* Sombras */
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  
  /* Transiciones */
  transition: all 0.3s ease;
}

.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.2);
}
```

### Modales
```css
.modal {
  /* Dimensiones */
  min-width: 400px;
  max-width: 600px;
  max-height: 90vh;
  padding: 2rem;
  border-radius: 1rem;
  
  /* Colores */
  background: var(--surface);
  border: 1px solid var(--border);
  
  /* Overlay */
  backdrop-filter: blur(5px);
}

.modal-overlay {
  background: rgba(0, 0, 0, 0.7);
}
```

### Botones
```css
.button {
  /* Dimensiones base */
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  
  /* Transiciones */
  transition: all 0.2s ease;
}

/* Variantes */
.button-primary {
  background: var(--primary);
  color: white;
}

.button-secondary {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-primary);
}

.button-danger {
  background: var(--danger);
  color: white;
}

/* Tamaños */
.button-sm { padding: 0.25rem 0.75rem; }
.button-md { padding: 0.5rem 1rem; }
.button-lg { padding: 0.75rem 1.5rem; }
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