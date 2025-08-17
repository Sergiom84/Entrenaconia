# Instrucciones de Desarrollo - Entrena con IA

> **⚠️ IMPORTANTE**: Este documento solo se actualizará cuando el usuario lo indique explícitamente.

## 📋 Reglas Generales de Desarrollo

### 🗑️ Limpieza de Código - REGLA FUNDAMENTAL

**INSTRUCCIÓN #1**: Cualquier archivo que sea para realizar un test, una prueba, para probar un script para la base de datos, según se use, debe ser eliminado inmediatamente después de su uso.

**Aplicación**:
- ❌ **NO mantener**: Archivos de prueba temporales
- ❌ **NO mantener**: Scripts de testing de base de datos
- ❌ **NO mantener**: Archivos de ejemplo o demo
- ❌ **NO mantener**: Código comentado extenso sin uso
- ❌ **NO mantener**: Dependencias no utilizadas
- ❌ **NO mantener**: Archivos de configuración duplicados
- ❌ **NO mantener**: Assets no utilizados (imágenes, iconos, etc.)

**Objetivo**: Mantener el código limpio, eficiente y solo con lo necesario para la aplicación en producción.

**Excepciones**: 
- Archivos de configuración esenciales (package.json, tailwind.config.js, etc.)
- Tests unitarios oficiales del proyecto (cuando se implementen)
- Documentación oficial del proyecto (carpeta docs/)

## 🔧 Estándares de Desarrollo

### 📂 INSTRUCCIÓN #2: Nomenclatura de Archivos y Rutas

**REGLA FUNDAMENTAL**: Los nombres de archivos y carpetas deben ser fácilmente identificables y seguir un patrón consistente basado en la funcionalidad.

**Patrón de Nomenclatura**:
- **Frontend**: `[Funcionalidad][TipoComponente].jsx`
- **Backend**: `[funcionalidad][TipoArchivo].js`
- **Carpetas**: Nombre descriptivo de la funcionalidad principal

**Ejemplo - Entrenamiento en Casa**:
```
Frontend:
src/components/HomeTraining/
├── HomeTrainingSection.jsx
├── IAHomeTraining.jsx
├── HomeTrainingCard.jsx
├── HomeTrainingTimer.jsx

Backend:
backend/routes/
├── homeTraining.js
├── iahomeTraining.js

backend/models/
├── homeTrainingModel.js
├── exerciseModel.js
```

**Beneficios**:
- ✅ **Localización rápida**: Fácil encontrar archivos relacionados
- ✅ **Debugging eficiente**: Identificar problemas por área funcional
- ✅ **Mantenimiento claro**: Saber exactamente qué hace cada archivo
- ✅ **Escalabilidad**: Patrón consistente para nuevas funcionalidades

### Estructura de Archivos
- **Organización clara**: Cada archivo debe tener un propósito específico
- **Nomenclatura consistente**: Seguir el patrón establecido arriba
- **Ubicación lógica**: Archivos en carpetas apropiadas según su función

### Código Limpio
- **Sin código muerto**: Eliminar imports, funciones o variables no utilizadas
- **Comentarios útiles**: Solo comentarios que aporten valor, no obviedades
- **Funciones pequeñas**: Máximo 50 líneas por función cuando sea posible
- **Responsabilidad única**: Cada componente/función debe tener un propósito claro

### Dependencias
- **Solo las necesarias**: No instalar librerías "por si acaso"
- **Versiones específicas**: Usar versiones exactas en package.json cuando sea crítico
- **Auditoría regular**: Revisar y eliminar dependencias no utilizadas

## 📁 Gestión de Archivos

### Archivos Permitidos
- **Componentes React**: Archivos .jsx/.tsx funcionales
- **Estilos**: CSS/Tailwind necesarios para la aplicación
- **Configuración**: Archivos de config esenciales del proyecto
- **Assets**: Solo imágenes, iconos y recursos utilizados en la app
- **Documentación**: Archivos .md en carpeta docs/
- **Backend**: Archivos de servidor, rutas, modelos necesarios

### Archivos a Eliminar Inmediatamente
- **test.js, prueba.js, ejemplo.js**: Cualquier archivo de prueba temporal
- **script-db.sql, test-query.sql**: Scripts de prueba de base de datos
- **demo-component.jsx**: Componentes de demostración
- **unused-asset.png**: Assets no referenciados en el código
- **old-version.js**: Versiones anteriores de archivos
- **backup-*.js**: Archivos de respaldo temporales

## 🚀 Flujo de Desarrollo

### Antes de Implementar
1. **Planificar**: Definir exactamente qué archivos se necesitan
2. **Revisar**: Verificar que no existan archivos similares
3. **Limpiar**: Eliminar archivos obsoletos antes de crear nuevos

### Durante el Desarrollo
1. **Crear solo lo necesario**: No archivos "por si acaso"
2. **Probar en el mismo archivo**: Evitar crear archivos de prueba separados
3. **Eliminar inmediatamente**: Borrar cualquier archivo temporal al terminar

### Después de Implementar
1. **Auditoría**: Revisar que todos los archivos sean necesarios
2. **Limpieza**: Eliminar imports no utilizados
3. **Optimización**: Verificar que no hay código duplicado

## 🔍 Checklist de Limpieza

### Antes de Cada Commit
- [ ] ¿Todos los archivos son necesarios para la aplicación?
- [ ] ¿No hay archivos de prueba temporal?
- [ ] ¿Todos los imports se utilizan?
- [ ] ¿No hay código comentado extenso sin propósito?
- [ ] ¿Las dependencias en package.json se utilizan?
- [ ] ¿No hay assets no referenciados?

### Revisión Semanal
- [ ] Auditar carpeta completa del proyecto
- [ ] Verificar tamaño del bundle de producción
- [ ] Revisar dependencias no utilizadas
- [ ] Limpiar archivos de log o temporales del sistema

## 🎯 Objetivos de Estas Instrucciones

### Eficiencia
- **Código más rápido**: Menos archivos = menos tiempo de compilación
- **Bundle más pequeño**: Solo código necesario en producción
- **Mantenimiento fácil**: Menos archivos = menos complejidad

### Profesionalismo
- **Código limpio**: Apariencia profesional del repositorio
- **Fácil navegación**: Desarrolladores encuentran lo que necesitan rápidamente
- **Sin confusión**: No hay archivos que generen dudas sobre su propósito

### Performance
- **Menos peso**: Aplicación más ligera
- **Carga más rápida**: Menos recursos a descargar
- **Mejor SEO**: Tiempos de carga optimizados

## 📝 Notas Adicionales

### Herramientas Recomendadas
- **ESLint**: Para detectar código no utilizado
- **Webpack Bundle Analyzer**: Para analizar el tamaño del bundle
- **npm-check**: Para revisar dependencias no utilizadas

### Excepciones Temporales
Si por alguna razón específica se necesita mantener un archivo temporal:
1. **Documentar el motivo** en comentario del archivo
2. **Establecer fecha límite** para su eliminación
3. **Crear recordatorio** para limpieza posterior

---

**Regla de oro**: "Si no se usa en producción, no debe estar en el código"

**Última actualización**: 16 de agosto de 2025  
**Versión del documento**: 1.0
