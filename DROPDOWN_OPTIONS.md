# 📋 Opciones para Dropdowns del Frontend - Registro de Usuario

## 👤 **Sexo** 
```javascript
const sexoOptions = [
  { value: 'masculino', label: 'Masculino' },
  { value: 'femenino', label: 'Femenino' }
];
```

## 🎯 **Objetivo Principal**
```javascript
const objetivoOptions = [
  { value: 'perder_peso', label: 'Perder peso' },
  { value: 'ganar_musculo', label: 'Ganar músculo' }, // Se mapea a 'ganar_masa_muscular' en BD
  { value: 'tonificar', label: 'Tonificar' },
  { value: 'ganar_peso', label: 'Ganar peso' },
  { value: 'mejorar_resistencia', label: 'Mejorar resistencia' },
  { value: 'mejorar_flexibilidad', label: 'Mejorar flexibilidad' },
  { value: 'salud_general', label: 'Salud general' },
  { value: 'mantenimiento', label: 'Mantenimiento' },
  { value: 'rehabilitacion', label: 'Rehabilitación' }
];
```

## 💪 **Enfoque de Entrenamiento**
```javascript
const enfoqueOptions = [
  { value: 'fuerza', label: 'Fuerza' },
  { value: 'hipertrofia', label: 'Hipertrofia' },
  { value: 'resistencia', label: 'Resistencia' },
  { value: 'funcional', label: 'Funcional' }, // Se mapea a 'general' en BD
  { value: 'hiit', label: 'HIIT' }, // Se mapea a 'perdida_peso' en BD
  { value: 'mixto', label: 'Mixto' } // Se mapea a 'general' en BD
];
```

## 📅 **Horario Preferido**
```javascript
const horarioOptions = [
  { value: 'mañana', label: 'Mañana' },
  { value: 'media_mañana', label: 'Media mañana' },
  { value: 'tarde', label: 'Tarde' },
  { value: 'noche', label: 'Noche' }
];
```

## 🏃 **Nivel de Actividad**
```javascript
const nivelActividadOptions = [
  { value: 'sedentario', label: 'Sedentario' },
  { value: 'ligero', label: 'Ligero' },
  { value: 'moderado', label: 'Moderado' },
  { value: 'activo', label: 'Activo' },
  { value: 'muy_activo', label: 'Muy activo' }
];
```

---

## 🔄 **Mapeos automáticos en el backend:**

- **ganar_musculo** → se guarda como **ganar_masa_muscular**
- **funcional** → se guarda como **general** 
- **hiit** → se guarda como **perdida_peso**
- **mixto** → se guarda como **general**

*El backend se encarga automáticamente de mapear los valores del frontend a los valores permitidos en la base de datos.*