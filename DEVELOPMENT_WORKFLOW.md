# 🚀 Development Workflow - Entrena con IA

## 📋 Flujo de Desarrollo

### 1. **Crear Nueva Funcionalidad**
```bash
# Siempre desde main actualizado
git checkout main
git pull origin main

# Crear rama específica
git checkout -b feat/nombre-descriptivo
# Ejemplos:
# git checkout -b feat/exercise-feedback-system
# git checkout -b fix/routine-persistence-bug
# git checkout -b refactor/api-endpoints
```

### 2. **Tipos de Ramas**
- `feat/` - Nuevas funcionalidades
- `fix/` - Corrección de bugs
- `refactor/` - Refactoring de código
- `docs/` - Solo documentación
- `perf/` - Mejoras de rendimiento
- `test/` - Añadir tests

### 3. **Durante el Desarrollo**
```bash
# Commits frecuentes y específicos
git add .
git commit -m "feat: add exercise completion persistence"

# Push regular para backup
git push origin feat/nombre-rama
```

### 4. **Pre-commit Automático**
El sistema ejecutará automáticamente:
- ✅ `npm run lint` - Verificar estilo de código
- ✅ `npm run build` - Verificar que compila
- ❌ Bloquea commits directos a `main`

### 5. **Crear Pull Request**
```bash
# Cuando la feature esté completa
git push origin feat/nombre-rama

# Ir a GitHub y crear PR con el template
```

### 6. **Checklist Antes del PR**
- [ ] La aplicación compila sin errores
- [ ] No hay errores de lint
- [ ] He probado la funcionalidad manualmente
- [ ] No rompe funcionalidad existente
- [ ] Commit messages son descriptivos

## 🔧 Comandos Útiles

### Testing Local
```bash
# Verificar que todo funciona
npm run lint        # Revisar estilo
npm run build       # Verificar compilación
npm run dev         # Probar en desarrollo
```

### Gestión de Ramas
```bash
# Ver todas las ramas
git branch -a

# Cambiar a rama existente
git checkout feat/mi-rama

# Actualizar desde main
git checkout main
git pull origin main
git checkout feat/mi-rama
git merge main  # O rebase si prefieres
```

### Limpieza
```bash
# Eliminar rama local después del merge
git branch -d feat/rama-mergeada

# Eliminar rama remota
git push origin --delete feat/rama-mergeada
```

## 🚨 Reglas Importantes

### ❌ NO HACER
- ❌ Commits directos a `main`
- ❌ Cambios masivos en múltiples áreas
- ❌ Push sin probar localmente
- ❌ Merge sin code review

### ✅ SIEMPRE HACER
- ✅ Crear PR para cada cambio
- ✅ Probar antes de commitear
- ✅ Mensajes de commit descriptivos
- ✅ Cambios pequeños y específicos

## 📊 Monitoreo Automático

### GitHub Actions
- 🔄 Se ejecuta en cada PR y push a `main`
- ✅ Tests de integración
- 🏗️ Verificación de build
- 📋 Code quality checks

### Notificaciones
- 📧 Email si el build falla
- 💬 Comentarios automáticos en PR
- ✅ Status checks requeridos para merge

## 🛠️ Configuración IDE

### VS Code (Recomendado)
```json
// .vscode/settings.json
{
  "editor.formatOnSave": true,
  "eslint.autoFixOnSave": true,
  "git.autofetch": true
}
```

### Extensiones Útiles
- ESLint
- Prettier
- GitLens
- Auto Import - ES6, TS, JSX

## 🎯 Objetivos del Workflow

1. **Prevenir bugs** con testing automático
2. **Mantener calidad** con code reviews
3. **Evitar conflictos** con ramas pequeñas
4. **Documentar cambios** con PR descriptions
5. **Backup automático** con push frecuente

---

## 📞 Ayuda y Troubleshooting

### Error: "Pre-commit failed"
```bash
# Revisar errores de lint
npm run lint

# Revisar errores de build  
npm run build

# Fix manual y volver a intentar
git commit --amend
```

### Error: "Cannot push to main"
```bash
# Crear rama feature
git checkout -b feat/mi-cambio
git push origin feat/mi-cambio
# Crear PR desde GitHub
```

### Conflictos de Merge
```bash
# Actualizar desde main
git checkout main
git pull origin main
git checkout feat/mi-rama
git merge main

# Resolver conflictos manualmente
# git add . && git commit
```

---

*Configurado: Septiembre 2025*
*Proyecto: Entrena con IA*