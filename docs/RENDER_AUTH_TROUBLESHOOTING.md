# 🔐 Guía de Autenticación de Render CLI

## Problema: "exec: xdg-open: executable file not found"

Este error ocurre en WSL porque no puede abrir el navegador automáticamente. **No es un problema grave**, solo requiere autenticación manual.

---

## ✅ Soluciones (Elige una)

### 🎯 Solución 1: Autenticación con Navegador (Recomendada)

#### **Paso 1: Genera el código de autorización**

```bash
npm run render:auth
```

Verás algo como esto:

```
Complete login in the Render Dashboard with code: 6I7R-VH5H-MN2B-GUEW

Opening your browser to:
https://dashboard.render.com/device-authorization/6I7R-VH5H-MN2B-GUEW
```

#### **Paso 2: Abre la URL en tu navegador de Windows**

Copia y pega la URL completa:

```
https://dashboard.render.com/device-authorization/6I7R-VH5H-MN2B-GUEW
```

#### **Paso 3: Ingresa el código**

Cuando Render te lo pida, ingresa el código:

```
6I7R-VH5H-MN2B-GUEW
```

#### **Paso 4: Autoriza la aplicación**

- Acepta los permisos
- La CLI en WSL detectará automáticamente que autorizaste

#### **Paso 5: Verifica que funcionó**

```bash
npm run render:whoami
```

Deberías ver tu información de usuario de Render.

---

### 🔑 Solución 2: Usar API Key (Alternativa)

Si prefieres no usar el navegador cada vez:

#### **Paso 1: Crear API Key en Render**

1. Ve a: https://dashboard.render.com/u/settings#api-keys
2. Click en **"Create New API Key"**
3. Dale un nombre: `Claude Code CLI`
4. Copia la key (solo la mostrarán una vez)

#### **Paso 2: Configurar API Key**

```bash
npm run render:apikey
```

Te pedirá que pegues tu API Key (no se verá al escribir por seguridad).

#### **Paso 3: Verificar**

```bash
npm run render:whoami
```

---

### 🪟 Solución 3: Usar Windows Native (Si WSL da problemas)

Si prefieres evitar WSL completamente:

#### **Paso 1: Instalar Render CLI en Windows**

Descarga desde: https://github.com/render-oss/cli/releases/latest

O usa chocolatey:

```powershell
choco install render
```

#### **Paso 2: Autenticar en Windows CMD/PowerShell**

```bash
npm run render:auth:win
```

Esto abrirá el navegador automáticamente en Windows.

---

## 🧪 Verificar que Todo Funciona

Después de autenticarte con cualquier método, ejecuta:

```bash
# Ver tu usuario
npm run render:whoami

# Listar servicios
npm run render:services

# Ver logs
npm run render:logs view backend
```

---

## 🚨 Troubleshooting Común

### Error: "Not authenticated"

**Causa:** No has completado la autenticación o la sesión expiró.

**Solución:**

```bash
npm run render:auth
```

---

### Error: "Invalid API key"

**Causa:** La API key está mal copiada o expiró.

**Solución:**

1. Ve a https://dashboard.render.com/u/settings#api-keys
2. Crea una nueva API key
3. Ejecuta: `npm run render:apikey`
4. Pega la nueva key

---

### El código de autorización expiró

**Causa:** Tardaste más de 10 minutos en completar la autorización.

**Solución:**

```bash
npm run render:auth
```

Te generará un código nuevo.

---

### No se abren los logs

**Causa:** No has especificado el ID del servicio correcto.

**Solución:**

```bash
# 1. Lista tus servicios y copia el ID (srv-xxxx)
npm run render:services

# 2. Usa ese ID para ver logs
render logs --resources srv-xxxxx --output text
```

---

### "Cannot find render command"

**Causa:** El PATH no está configurado correctamente.

**Solución en WSL:**

```bash
export PATH=$PATH:/home/sergio/.local/bin
source ~/.bashrc
render --version
```

---

## 📝 Comandos de Diagnóstico

Si algo no funciona, ejecuta estos comandos y comparte la salida:

```bash
# Verificar instalación
which render
render --version

# Verificar autenticación
render whoami

# Ver configuración del PATH
echo $PATH | grep ".local/bin"

# Ver variable de API key (si usas ese método)
echo $RENDER_API_KEY | sed 's/./*/g'  # Oculta la key por seguridad
```

---

## 🎓 Métodos de Autenticación: Comparación

| Método             | Pros                         | Contras                    | Recomendado para    |
| ------------------ | ---------------------------- | -------------------------- | ------------------- |
| **Navegador**      | Más seguro, fácil de revocar | Requiere navegador         | Uso diario          |
| **API Key**        | Sin navegador, permanente    | Más difícil de revocar     | Automatización/CI   |
| **Windows Native** | Navegador se abre automático | Requiere instalación extra | Usuarios de Windows |

---

## ✅ Checklist de Configuración Exitosa

- [ ] `render --version` muestra la versión
- [ ] `render whoami` muestra tu usuario
- [ ] `render services` lista tus servicios
- [ ] `render logs --tail` puede conectarse (aunque no tengas servicios)

Si todos los ítems están marcados, ¡estás listo! 🎉

---

## 🆘 Ayuda Adicional

- **Documentación oficial**: https://render.com/docs/cli
- **GitHub Issues**: https://github.com/render-oss/cli/issues
- **Community Forum**: https://community.render.com/

---

**💡 Consejo:** Usa `npm run render:auth` siempre que necesites reautenticarte. Es el método más fácil.
