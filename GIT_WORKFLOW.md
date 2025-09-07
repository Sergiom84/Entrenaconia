# 🚀 Git Workflow - Entrena con IA

Flujo de trabajo optimizado para evitar pérdida de código y conflictos complejos.

## 🎯 Objetivos

- **Nunca perder funcionalidades** al hacer merge
- **Detectar conflictos temprano** con rebases frecuentes
- **Mantener historial limpio** con conventional commits
- **Automatizar verificaciones** con hooks de calidad

## 🛠️ Herramientas Configuradas

### ✅ GitLens (VS Code)

- **Configuración**: `.vscode/settings.json`
- **Funciones**: CodeLens, blame inline, historial visual
- **Instalación**: Automática via `.vscode/extensions.json`

### ✅ Pre-commit Hooks (Husky)

- **Lint automático** en archivos modificados
- **Verificación de sintaxis** del backend
- **Conventional commits** obligatorios
- **Archivos**: `.husky/pre-commit`, `.husky/commit-msg`

### ✅ Git Configuration

```bash
git config --global rerere.enabled true        # Recuerda resoluciones de conflictos
git config --global pull.rebase true           # Rebase por defecto en pull
git config --global rebase.autoStash true      # Auto-stash durante rebase
```

### ✅ Git Aliases

```bash
git s           # Status resumido
git lg          # Log con gráfico
git dfm         # Diff con main
git sync        # Rebase con origin/main
git new-branch  # Crear rama desde main actualizado
```

## 📋 Flujo de Trabajo Diario

### 1. 🌅 Al Empezar el Día

```bash
# Actualizar main
git update-main
# o manualmente:
git switch main && git pull origin main

# Crear nueva funcionalidad
git new-branch feat/mi-funcionalidad
# o manualmente:
git switch -c feat/mi-funcionalidad
```

### 2. 🔄 Durante el Desarrollo

```bash
# Sincronizar con main (DIARIAMENTE)
git sync
# o manualmente:
git fetch origin && git rebase origin/main

# Commits con formato correcto
git cm "feat(calistenia): add unified prompt system"
git cm "fix(auth): resolve JWT token validation"
```

### 3. 🧪 Antes del Merge

```bash
# Checklist automático
./scripts/git-workflow.sh pre-merge-check

# Verificaciones manuales
git dfm                    # Ver todos los cambios
npm run lint              # Verificar código
npm run build             # Verificar build
git conflicts             # Ver conflictos pendientes (si hay)
```

### 4. 🔄 Merge Strategy

```bash
# Opción A: Squash Merge (recomendado para features)
# - En GitHub: "Squash and merge"
# - Mantiene main limpio con un commit por feature

# Opción B: Merge Commit
# - En GitHub: "Create a merge commit"
# - Preserva el historial de la rama
```

## 🆘 Situaciones de Emergencia

### 🔥 Cambio Urgente de Rama

```bash
# Guarda todo rápidamente
./scripts/git-workflow.sh emergency-switch main

# O manualmente:
git stash push -u -m "Emergency stash $(date)"
git switch main
```

### 🔍 Funcionalidad Perdida

```bash
# Buscar commits perdidos
./scripts/git-workflow.sh find-lost-commits

# O usar bisect para encontrar el problema
git bisect start
git bisect bad                    # Estado actual con problema
git bisect good <commit-bueno>    # Commit que sabemos que funcionaba
# Seguir las instrucciones de git bisect

# Recuperar commit específico
git cherry-pick <commit-hash>
```

### ⚔️ Conflictos en VS Code

1. **Current Change** = Tu código
2. **Incoming Change** = Código de main
3. **No usar "Accept Both" a ciegas**
4. **Resolver manualmente** revisando la lógica

```bash
# Ver diferencias específicas
git diff --ours --theirs archivo-conflictivo.js

# Tomar tu versión
git checkout --ours archivo.js

# Tomar versión de main
git checkout --theirs archivo.js
```

## 📊 Scripts Disponibles

### `./scripts/git-workflow.sh`

```bash
./scripts/git-workflow.sh update-main        # Actualizar main
./scripts/git-workflow.sh create-branch feat/nueva  # Nueva rama
./scripts/git-workflow.sh daily-sync         # Sincronizar con main
./scripts/git-workflow.sh pre-merge-check    # Checklist pre-merge
./scripts/git-workflow.sh emergency-switch main # Cambio emergencia
./scripts/git-workflow.sh find-lost-commits  # Buscar commits perdidos
```

### `./scripts/git-aliases.sh`

- Configura todos los aliases útiles
- Solo ejecutar una vez: `./scripts/git-aliases.sh`

## 🎯 Conventional Commits

### Formato

```
<tipo>(<ámbito>): <descripción>

[cuerpo opcional]

[footer opcional]
```

### Tipos

- **feat**: Nueva funcionalidad
- **fix**: Corrección de bug
- **docs**: Cambios de documentación
- **style**: Formato de código (sin cambios funcionales)
- **refactor**: Refactoring (sin cambios funcionales)
- **test**: Añadir o modificar tests
- **chore**: Mantenimiento (deps, config, etc.)
- **perf**: Mejoras de rendimiento
- **ci**: Cambios en CI/CD
- **build**: Cambios en el build

### Ejemplos

```bash
git cm "feat(auth): add JWT refresh token mechanism"
git cm "fix(ui): resolve modal overlay z-index issue"
git cm "docs(readme): update installation instructions"
git cm "refactor(api): extract auth middleware to separate file"
git cm "chore(deps): update React to 19.1.0"
```

## 🔧 Configuración de Proyecto

### package.json Scripts

```json
{
  "scripts": {
    "lint": "eslint --config .eslint.config.mjs .",
    "lint:fix": "eslint --config .eslint.config.mjs . --fix",
    "pre-commit": "lint-staged",
    "test:quick": "echo '⚡ Quick tests' && exit 0"
  }
}
```

### lint-staged Config

```json
{
  "lint-staged": {
    "*.{js,jsx,ts,tsx}": ["eslint --fix", "git add"],
    "*.{json,md,yml,yaml}": ["prettier --write", "git add"],
    "backend/**/*.js": ["node -c"]
  }
}
```

## 🚦 Reglas de Oro

### ✅ HACER

- **Rebase frecuente** con main (diariamente)
- **Commits pequeños** y descriptivos
- **Ramas cortas** (1-3 días máximo)
- **Verificar build** antes del merge
- **Resolver conflictos** tan pronto como aparezcan

### ❌ NO HACER

- `git push -f` en ramas compartidas
- Mezclar refactors grandes con features
- Ignorar cambios en `package-lock.json`
- Commits sin mensaje descriptivo
- Ramas que viven semanas sin sincronizar

## 🎯 Beneficios

### 🛡️ Prevención de Problemas

- **Pre-commit hooks** evitan código roto
- **Rebase frecuente** evita conflictos complejos
- **Git rerere** recuerda resoluciones de conflictos
- **Conventional commits** facilitan el historial

### ⚡ Productividad

- **Scripts automatizados** para operaciones comunes
- **Aliases de git** para comandos frecuentes
- **GitLens** para contexto visual inmediato
- **Templates de PR** con checklists completos

### 🔍 Troubleshooting

- **Reflog** para recuperar commits perdidos
- **Git bisect** para encontrar regressions
- **Herramientas de diff** avanzadas
- **Stash de emergencia** para cambios rápidos

---

## 🚀 Quick Start

1. **Instalar GitLens** en VS Code (automático)
2. **Configurar aliases**: `./scripts/git-aliases.sh`
3. **Crear nueva rama**: `git new-branch feat/mi-feature`
4. **Desarrollar con commits**: `git cm "feat: add new feature"`
5. **Sincronizar diariamente**: `git sync`
6. **Pre-merge check**: `./scripts/git-workflow.sh pre-merge-check`
7. **Crear PR** usando el template

**¡Nunca más perderás código al hacer merge!** 🎯
