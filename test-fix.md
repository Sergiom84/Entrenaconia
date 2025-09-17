# Fix de Error: process is not defined

## Problema Resuelto
El error `ReferenceError: process is not defined` que ocurría en la ruta de metodologías ha sido corregido.

## Causa del Error
Los archivos estaban intentando usar `process.env` (API de Node.js) en el navegador, lo cual no está disponible en el entorno del cliente.

## Solución Aplicada
Se reemplazaron todas las referencias a `process` con las APIs correctas de Vite:
- `process.env.REACT_APP_API_URL` → `import.meta.env.VITE_API_URL`
- `process.env.NODE_ENV === 'development'` → `import.meta.env.DEV`

## Archivos Modificados
1. **src/components/Methodologie/exercises/ExerciseDatabase.js** (línea 13 y 31)
2. **src/hooks/useAuth.js** (línea 50)
3. **src/hooks/useRegistration.js** (línea 48)
4. **src/components/nutrition/NutritionAI.jsx** (línea 289)
5. **src/components/Methodologie/shared/MethodologyDetailsDialog.jsx** (línea 74)
6. **src/components/Methodologie/methodologies/CalisteniaManual/CalisteniaMuscleGroups.js** (línea 80)
7. **src/components/Methodologie/methodologies/CalisteniaManual/CalisteniaLevels.js** (línea 98)
8. **src/components/routines/RoutineScreen.jsx** (líneas 100 y 109)

## Verificación
Para verificar que el error está resuelto:
1. Navega a la ruta de metodologías en la aplicación
2. La página debe cargar sin errores
3. No debe aparecer el error `process is not defined` en la consola

## Notas Técnicas
En Vite, las variables de entorno se acceden mediante:
- `import.meta.env.VITE_*` para variables personalizadas
- `import.meta.env.DEV` para verificar si está en desarrollo
- `import.meta.env.PROD` para verificar si está en producción
- `import.meta.env.MODE` para obtener el modo actual

El servidor de desarrollo ya está corriendo en el puerto 5173.