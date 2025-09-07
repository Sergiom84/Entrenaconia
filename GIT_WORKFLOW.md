# 🚀 Development Workflow - Entrena con IA

_Configurado: Septiembre 2025 — Proyecto: Entrena con IA_

## 📋 Flujo de Desarrollo

### 1. Crear Nueva Funcionalidad

```bash
git checkout main
git pull origin main
git checkout -b feat/nombre-descriptivo
```

### 2. Tipos de Ramas

- **feat/** - Nuevas funcionalidades
- **fix/** - Corrección de bugs
- **refactor/** - Refactoring de código
- **docs/** - Solo documentación
- **perf/** - Mejoras de rendimiento
- **test/** - Añadir tests

### 3. Durante el Desarrollo

```bash
git add .
git commit -m "feat: add exercise completion persistence"
git push origin feat/nombre-rama
```

### 4. Sincronización con main

```bash
git fetch origin
git rebase origin/main
# o
git merge origin/main
```

### 5. Pre-commit Automático

```bash
npm i -D husky lint-staged eslint prettier
npm run prepare
npx husky add .husky/pre-commit "npx lint-staged"
npx husky add .husky/pre-push "npm run test && npm run build"
```

**package.json:**

```json
{
  "scripts": {
    "lint": "eslint .",
    "build": "npm run build",
    "test": "npm run test",
    "prepare": "husky install"
  },
  "lint-staged": {
    "*.{js,jsx,ts,tsx}": ["eslint --fix", "git add"],
    "*.{md,json,css,scss}": ["prettier --write", "git add"]
  }
}
```

### 6. Crear Pull Request

```bash
git push origin feat/nombre-rama
```

**Checklist:**

- ✅ Compila sin errores
- ✅ Lint ok
- ✅ Probado manual
- ✅ No rompe funcionalidades
- ✅ Commits descriptivos

### 7. Plantilla PR

`.github/pull_request_template.md` ya configurada con:

- ✅ Qué cambia
- ✅ Cómo se probó
- ✅ Riesgos
- ✅ Checklist completo

### 8. Convención Commits

- **feat(scope):** Nueva funcionalidad
- **fix(scope):** Corrección de bug
- **docs:** Documentación
- **refactor:** Refactoring
- **test:** Tests
- **perf:** Rendimiento

### 9. Estrategia de Merge + Protección

- **Squash & Merge** (recomendado)
- Branch protection en main: PR requerido, checks verdes, no force push

### 10. CI GitHub Actions

`.github/workflows/ci.yml` configurado:

```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]
jobs:
  build-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "18" }
      - run: npm ci
      - run: npm run lint
      - run: npm run build
      - run: npm run test
```

### 11. Releases

```bash
./scripts/release.sh create_release v1.3.0
./scripts/release.sh list_releases
```

### 12. Rollback

```bash
./scripts/release.sh rollback v1.2.0
```

## 🔧 Comandos Útiles

### Testing

```bash
npm run lint
npm run build
npm run dev
```

### Ramas

```bash
git branch -a
git checkout feat/mi-rama
git checkout main
git pull origin main
git checkout feat/mi-rama
git merge main
```

### Limpieza

```bash
git branch -d feat/rama-mergeada
git push origin --delete feat/rama-mergeada
```

## 🚨 Reglas

- ❌ No commits directos a main
- ❌ No cambios masivos
- ❌ No push sin probar
- ❌ No merge sin review
- ✅ Siempre PR
- ✅ Commits descriptivos
- ✅ Cambios pequeños

## 🛠️ Configuración VS Code

`.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": { "source.fixAll.eslint": "explicit" },
  "eslint.validate": ["javascript", "typescript", "react"],
  "git.autofetch": true
}
```

**Extensiones:**

- ESLint
- Prettier
- GitLens
- Auto Import

## 📞 Troubleshooting

### Pre-commit failed

```bash
npm run lint
npm run build
git commit --amend
```

### Cannot push to main

```bash
git checkout -b feat/mi-cambio
git push origin feat/mi-cambio
```

### Conflictos

```bash
git checkout main
git pull origin main
git checkout feat/mi-rama
git merge main
# Resolver en VS Code/GitLens
git add .
git commit
```

---

## 📋 Flujo de Trabajo Diario (Scripts Automatizados)

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
