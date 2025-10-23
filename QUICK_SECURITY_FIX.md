# 🚨 Guía Rápida de Seguridad - Acción Inmediata

## ⚡ Paso 1: Cambiar Credenciales (5-10 minutos)

### A. Supabase Database Password

1. Ve a: https://supabase.com/dashboard/project/lhsnmjgdtjalfcsurxvg/settings/database
2. Scroll hasta "Database Password"
3. Click en "Reset Database Password"
4. Copia la nueva contraseña
5. Actualiza en `backend/.env`:
   ```bash
   DATABASE_URL=postgresql://postgres.lhsnmjgdtjalfcsurxvg:NUEVA_PASSWORD@aws-1-eu-north-1.pooler.supabase.com:6543/postgres
   DB_PASSWORD=NUEVA_PASSWORD
   ```

### B. OpenAI API Keys

1. Ve a: https://platform.openai.com/api-keys
2. Revoca estas claves:
   - `sk-proj-71n6CwNRFH...` (HOME_TRAINING)
   - `sk-proj-P9XQC5MbZ6...` (CORRECTION_VIDEO)
   - Cualquier otra expuesta
3. Crea nuevas claves
4. Actualiza en `backend/.env`:
   ```bash
   OPENAI_API_KEY=sk-proj-TU_NUEVA_CLAVE
   ```

### C. JWT Secret

```bash
# Genera un nuevo secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Actualiza en backend/.env
JWT_SECRET=tu_nuevo_secret_generado
```

---

## ⚡ Paso 2: Limpiar Git (2 minutos)

### Opción A: Mantener historial pero proteger archivos

```bash
# Ya hecho automáticamente:
# - Archivos eliminados del tracking
# - .gitignore actualizado
# - Archivos .example creados

# Solo necesitas hacer commit:
git add .
git commit -m "chore: proteger credenciales sensibles"
git push
```

### Opción B: Limpiar historial completo (10 minutos)

```bash
# Usa BFG Repo Cleaner - ver SECURITY_ALERT.md para instrucciones
# O crea un nuevo repositorio desde cero
```

---

## ⚡ Paso 3: Verificar (2 minutos)

```bash
# 1. Verificar que backend funciona con nuevas credenciales
cd backend
npm run dev

# 2. Verificar que no hay credenciales en archivos tracked
git grep "Xe05Klm563kkjL"  # No debe encontrar nada
git grep "sk-proj-71n6"     # No debe encontrar nada

# 3. Verificar .gitignore
cat .gitignore | grep ".env"
```

---

## ✅ Checklist Rápido

- [ ] ✅ Backend/.env actualizado con nueva password de Supabase
- [ ] ✅ OpenAI API keys revocadas y regeneradas
- [ ] ✅ JWT_SECRET regenerado
- [ ] ✅ Backend funciona con nuevas credenciales (`npm run dev`)
- [ ] ✅ Commit de cambios al repositorio
- [ ] 📖 Leer SECURITY_ALERT.md para limpieza completa del historial

---

## 🆘 Si algo no funciona

1. **Backend no inicia**: Verifica DATABASE_URL en backend/.env
2. **OpenAI falla**: Verifica que OPENAI_API_KEY sea válida
3. **Errores de autenticación**: Verifica JWT_SECRET

---

## 📞 Archivos Creados para Ti

- ✅ `SECURITY_ALERT.md` - Guía completa de seguridad
- ✅ `backend/.env.example` - Plantilla sin credenciales
- ✅ `.claude/mcp_settings.json.example` - Plantilla MCP
- ✅ `scripts/security-cleanup.sh` - Script de limpieza automática
- ✅ `.gitignore` actualizado - Archivos sensibles protegidos
- ✅ `backend/db.js` corregido - Sin credenciales hardcodeadas

---

**Tiempo estimado total: 15-20 minutos**
**Prioridad: CRÍTICA** 🔴
