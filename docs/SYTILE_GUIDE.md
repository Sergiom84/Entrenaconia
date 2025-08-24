# 🎨 Guía de Estilos y Diseño

## 🎨 Paleta de Colores

### Colores Principales
```css
:root {
  /* Colores Primarios */
  --primary-color: #4F46E5;        /* Índigo - Color principal */
  --primary-hover: #4338CA;        /* Índigo oscuro - Hover */
  --primary-light: #818CF8;        /* Índigo claro - Fondos suaves */
  
  /* Colores Secundarios */
  --secondary-color: #10B981;      /* Verde - Éxito/Completado */
  --secondary-hover: #059669;      /* Verde oscuro - Hover */
  
  /* Colores de Acento */
  --accent-color: #F59E0B;         /* Naranja - Llamadas a la acción */
  --accent-hover: #D97706;         /* Naranja oscuro - Hover */
  
  /* Grises */
  --gray-50: #F9FAFB;
  --gray-100: #F3F4F6;
  --gray-200: #E5E7EB;
  --gray-300: #D1D5DB;
  --gray-400: #9CA3AF;
  --gray-500: #6B7280;
  --gray-600: #4B5563;
  --gray-700: #374151;
  --gray-800: #1F2937;
  --gray-900: #111827;
  
  /* Estados */
  --error-color: #EF4444;          /* Rojo - Errores */
  --warning-color: #F59E0B;        /* Amarillo - Advertencias */
  --info-color: #3B82F6;           /* Azul - Información */
  --success-color: #10B981;        /* Verde - Éxito */
}
```

## 📝 Tipografía

### Configuración Base
```css
:root {
  /* Familia de Fuentes */
  --font-primary: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-mono: 'JetBrains Mono', 'Courier New', monospace;
  
  /* Tamaños de Texto */
  --text-xs: 0.75rem;      /* 12px */
  --text-sm: 0.875rem;     /* 14px */
  --text-base: 1rem;       /* 16px */
  --text-lg: 1.125rem;     /* 18px */
  --text-xl: 1.25rem;      /* 20px */
  --text-2xl: 1.5rem;      /* 24px */
  --text-3xl: 1.875rem;    /* 30px */
  --text-4xl: 2.25rem;     /* 36px */
  
  /* Pesos de Fuente */
  --font-light: 300;
  --font-normal: 400;
  --font-medium: 500;
  --font-semibold: 600;
  --font-bold: 700;
  
  /* Altura de Línea */
  --leading-tight: 1.25;
  --leading-normal: 1.5;
  --leading-relaxed: 1.75;
  
  /* Espaciado de Letras */
  --tracking-tight: -0.025em;
  --tracking-normal: 0;
  --tracking-wide: 0.025em;
}
```

## 🗂️ Componentes UI

### Tarjetas (Cards)
```css
.card {
  background: var(--gray-50);
  border: 1px solid var(--gray-200);
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
}

.card:hover {
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.card-header {
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  color: var(--gray-900);
  margin-bottom: 16px;
}

.card-body {
  font-size: var(--text-base);
  color: var(--gray-600);
  line-height: var(--leading-normal);
}

.card-footer {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--gray-200);
}
```

### Botones
```css
.btn {
  /* Base */
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px 20px;
  font-size: var(--text-base);
  font-weight: var(--font-medium);
  border-radius: 8px;
  transition: all 0.2s ease;
  cursor: pointer;
  border: none;
  outline: none;
}

/* Variantes */
.btn-primary {
  background: var(--primary-color);
  color: white;
}

.btn-primary:hover {
  background: var(--primary-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.3);
}

.btn-secondary {
  background: var(--gray-200);
  color: var(--gray-700);
}

.btn-secondary:hover {
  background: var(--gray-300);
}

.btn-success {
  background: var(--success-color);
  color: white;
}

.btn-danger {
  background: var(--error-color);
  color: white;
}

/* Tamaños */
.btn-sm {
  padding: 6px 12px;
  font-size: var(--text-sm);
}

.btn-lg {
  padding: 14px 28px;
  font-size: var(--text-lg);
}

/* Estado deshabilitado */
.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

### Modales
```css
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.modal {
  background: white;
  border-radius: 16px;
  max-width: 500px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  animation: modalSlideIn 0.3s ease;
}

.modal-header {
  padding: 24px;
  border-bottom: 1px solid var(--gray-200);
}

.modal-title {
  font-size: var(--text-2xl);
  font-weight: var(--font-semibold);
  color: var(--gray-900);
}

.modal-body {
  padding: 24px;
}

.modal-footer {
  padding: 24px;
  border-top: 1px solid var(--gray-200);
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

@keyframes modalSlideIn {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

### Formularios
```css
.form-group {
  margin-bottom: 20px;
}

.form-label {
  display: block;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--gray-700);
  margin-bottom: 6px;
}

.form-input {
  width: 100%;
  padding: 10px 14px;
  font-size: var(--text-base);
  border: 1px solid var(--gray-300);
  border-radius: 8px;
  transition: all 0.2s ease;
}

.form-input:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
}

.form-input-error {
  border-color: var(--error-color);
}

.form-error-message {
  font-size: var(--text-sm);
  color: var(--error-color);
  margin-top: 4px;
}

.form-select {
  appearance: none;
  background-image: url("data:image/svg+xml,...");
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 40px;
}
```

### Alertas y Notificaciones
```css
.alert {
  padding: 16px;
  border-radius: 8px;
  display: flex;
  align-items: start;
  gap: 12px;
  margin-bottom: 16px;
}

.alert-info {
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.2);
  color: var(--info-color);
}

.alert-success {
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.2);
  color: var(--success-color);
}

.alert-warning {
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.2);
  color: var(--warning-color);
}

.alert-error {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  color: var(--error-color);
}

.toast {
  position: fixed;
  top: 20px;
  right: 20px;
  padding: 16px 20px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  animation: slideInRight 0.3s ease;
  z-index: 2000;
}

@keyframes slideInRight {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}
```

## 📱 Responsive Design

### Breakpoints
```css
:root {
  --screen-sm: 640px;   /* Móvil grande */
  --screen-md: 768px;   /* Tablet */
  --screen-lg: 1024px;  /* Desktop */
  --screen-xl: 1280px;  /* Desktop grande */
  --screen-2xl: 1536px; /* Desktop extra grande */
}

/* Media Queries */
@media (max-width: 640px) {
  /* Estilos móvil */
  .container {
    padding: 16px;
  }
  
  .card {
    padding: 16px;
  }
  
  .modal {
    width: 95%;
    margin: 10px;
  }
}

@media (min-width: 641px) and (max-width: 1024px) {
  /* Estilos tablet */
  .container {
    padding: 24px;
  }
}

@media (min-width: 1025px) {
  /* Estilos desktop */
  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 32px;
  }
}
```

## ✨ Animaciones y Transiciones

### Animaciones Comunes
```css
/* Fade In */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Slide Up */
@keyframes slideUp {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

/* Pulse */
@keyframes pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
}

/* Spin */
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Skeleton Loading */
@keyframes skeleton {
  0% {
    background-position: -200px 0;
  }
  100% {
    background-position: calc(200px + 100%) 0;
  }
}

.skeleton {
  background: linear-gradient(
    90deg,
    var(--gray-200) 25%,
    var(--gray-100) 50%,
    var(--gray-200) 75%
  );
  background-size: 200px 100%;
  animation: skeleton 1.5s ease infinite;
}
```

## 🌙 Tema Oscuro (Dark Mode)

```css
[data-theme="dark"] {
  --bg-primary: var(--gray-900);
  --bg-secondary: var(--gray-800);
  --text-primary: var(--gray-50);
  --text-secondary: var(--gray-300);
  --border-color: var(--gray-700);
  
  /* Inversión de colores para dark mode */
  --card-bg: var(--gray-800);
  --card-border: var(--gray-700);
  --input-bg: var(--gray-700);
}

/* Toggle de tema */
.theme-toggle {
  position: fixed;
  top: 20px;
  right: 80px;
  background: var(--gray-200);
  border-radius: 20px;
  padding: 4px;
  width: 60px;
  height: 32px;
  cursor: pointer;
}

.theme-toggle-slider {
  width: 24px;
  height: 24px;
  background: white;
  border-radius: 50%;
  transition: transform 0.3s ease;
}

[data-theme="dark"] .theme-toggle-slider {
  transform: translateX(28px);
}
```