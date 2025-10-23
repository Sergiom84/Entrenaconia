# 🚨 ALERTA DE SEGURIDAD - CREDENCIALES EXPUESTAS

## Estado: CRÍTICO

Este repositorio ha expuesto credenciales sensibles en el historial de Git. Se requiere **acción inmediata**.

---

## 📊 Resumen de Credenciales Expuestas

### Credenciales Encontradas en el Historial de Git:

1. **Supabase Database**
   - Host: `aws-1-eu-north-1.pooler.supabase.com`
   - User: `postgres.lhsnmjgdtjalfcsurxvg`
   - Password: `Xe05Klm563kkjL`
   - Project ID: `lhsnmjgdtjalfcsurxvg`

2. **Supabase Keys**
   - SUPABASE_ANON_KEY: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - SUPABASE_URL: `https://lhsnmjgdtjalfcsurxvg.supabase.co`

3. **OpenAI API Keys** (múltiples)
   - OPENAI_API_KEY_HOME_TRAINING
   - OPENAI_API_KEY_CORRECTION_VIDEO
   - Otras claves API

4. **JWT Secret**
   - Expuesto en commits antiguos

---

## 🔍 Archivos Afectados

### En el Historial de Git:

- ✅ `backend/.env` (commit 438399f)
- ✅ `.claude/mcp_settings.json` (múltiples commits)
- ✅ `.claude/settings.local.json` (múltiples commits)

### Archivos con Credenciales Hardcodeadas:

- ✅ `backend/db.js` (línea 14-15) - **YA CORREGIDO**

---

## ⚡ ACCIONES INMEDIATAS REQUERIDAS

### 1. Cambiar TODAS las Credenciales Expuestas

#### a) Supabase Database

1. Ve a tu panel de Supabase: https://supabase.com/dashboard
2. Navega a: Settings → Database → Connection string
3. **Resetear contraseña de la base de datos**
4. Actualiza el archivo `backend/.env` con la nueva contraseña

#### b) OpenAI API Keys

1. Ve a: https://platform.openai.com/api-keys
2. **Revoca todas las API keys expuestas**
3. Genera nuevas claves API
4. Actualiza `backend/.env` con las nuevas claves

#### c) JWT Secret

1. Genera un nuevo secret seguro:
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```
2. Actualiza `JWT_SECRET` en `backend/.env`

---

## 🧹 Limpiar el Historial de Git

### Opción 1: BFG Repo Cleaner (Recomendado)

```bash
# 1. Instalar BFG
# Windows: choco install bfg
# Mac: brew install bfg
# Linux: Descargar desde https://rtyley.github.io/bfg-repo-cleaner/

# 2. Hacer backup del repositorio
cd ..
cp -r Entrenaconia Entrenaconia-backup

# 3. Limpiar archivos sensibles
cd Entrenaconia
bfg --delete-files '.env'
bfg --delete-files 'mcp_settings.json'
bfg --delete-files 'settings.local.json'

# 4. Limpiar referencias
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# 5. Force push (⚠️ ADVERTENCIA: Esto reescribe el historial)
git push --force --all
git push --force --tags
```

### Opción 2: Git Filter-Repo (Alternativa)

```bash
# 1. Instalar git-filter-repo
pip3 install git-filter-repo

# 2. Backup
cd ..
cp -r Entrenaconia Entrenaconia-backup

# 3. Eliminar archivos sensibles del historial
cd Entrenaconia
git filter-repo --invert-paths \
  --path backend/.env \
  --path .claude/mcp_settings.json \
  --path .claude/settings.local.json

# 4. Force push
git push --force --all
git push --force --tags
```

### Opción 3: Crear un Nuevo Repositorio (Más Seguro)

Si el repositorio es privado y no ha sido clonado por muchas personas:

```bash
# 1. Eliminar .git
rm -rf .git

# 2. Inicializar nuevo repositorio
git init

# 3. Añadir archivos (sin credenciales)
git add .

# 4. Commit inicial
git commit -m "chore: inicializar repositorio limpio sin credenciales"

# 5. Crear nuevo repositorio en GitHub y push
git remote add origin <NEW_REPO_URL>
git branch -M main
git push -u origin main
```

---

## 🔒 Prevención de Futuras Exposiciones

### 1. Verificar .gitignore

✅ **Ya actualizado** - Los siguientes archivos están protegidos:

```
.env
.env.local
.env.development
.env.production
backend/.env
backend/.env.local
.claude/mcp_settings.json
.claude/settings.local.json
.render/
```

### 2. Usar Archivos .example

✅ **Ya creado**:

- `backend/.env.example` - Plantilla sin credenciales
- `.claude/mcp_settings.json.example` - Plantilla MCP

### 3. Pre-commit Hooks

Instala git-secrets para prevenir commits de credenciales:

```bash
# Instalar git-secrets
# Windows: choco install git-secrets
# Mac: brew install git-secrets
# Linux: git clone https://github.com/awslabs/git-secrets

# Configurar
git secrets --install
git secrets --register-aws
git secrets --add 'Xe05Klm563kkjL'
git secrets --add 'sk-proj-[A-Za-z0-9-_]+'
git secrets --add 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'
```

### 4. Verificar Antes de Commit

Siempre ejecuta antes de hacer commit:

```bash
# Verificar qué archivos se van a subir
git status

# Verificar el contenido
git diff --cached

# Buscar credenciales
git diff --cached | grep -i "password\|secret\|key\|token"
```

---

## 📋 Checklist de Seguridad

- [ ] Cambiar contraseña de Supabase
- [ ] Revocar y regenerar OpenAI API keys
- [ ] Generar nuevo JWT_SECRET
- [ ] Actualizar todos los archivos .env locales
- [ ] Limpiar historial de Git (elegir una opción)
- [ ] Verificar que .gitignore esté actualizado
- [ ] Configurar pre-commit hooks
- [ ] Notificar a colaboradores (si aplica)
- [ ] Verificar logs de Supabase y OpenAI para accesos no autorizados
- [ ] Considerar habilitar 2FA en Supabase y OpenAI

---

## 🆘 Recursos Adicionales

- [GitHub: Removing sensitive data](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)
- [BFG Repo-Cleaner](https://rtyley.github.io/bfg-repo-cleaner/)
- [git-secrets](https://github.com/awslabs/git-secrets)
- [Supabase Security](https://supabase.com/docs/guides/platform/going-into-prod#security)

---

## 📞 Contacto de Emergencia

Si detectas actividad sospechosa:

1. Revoca inmediatamente todas las credenciales
2. Revisa logs de acceso en Supabase Dashboard
3. Revisa uso de API en OpenAI Dashboard
4. Considera rotar TODAS las credenciales

---

**Fecha de detección**: 2025-10-23
**Estado**: Pendiente de acción
**Prioridad**: CRÍTICA
