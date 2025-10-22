# 📊 Guía de Uso de Render CLI

Esta guía explica cómo usar Render CLI para acceder a logs y gestionar servicios desde la terminal.

## 🚀 Instalación

### Linux/WSL (Ya instalado)

```bash
curl -fsSL https://raw.githubusercontent.com/render-oss/cli/refs/heads/main/bin/install.sh | sh
```

El PATH ya está configurado en tu `.bashrc`. Si abres una nueva terminal, ya tendrás acceso a `render`.

### Windows

Descarga el ejecutable desde: https://github.com/render-oss/cli/releases/latest

O usa el gestor de paquetes:

```powershell
# Con Chocolatey
choco install render

# Con Scoop
scoop install render
```

## 🔐 Autenticación

### Primera vez (Obligatorio)

```bash
# Esto abrirá tu navegador para autenticarte
npm run render:login

# O directamente:
render login
```

### Verificar autenticación

```bash
render whoami
```

### Usar API Key (Opcional para scripts)

Si necesitas automatización, puedes usar una API key:

1. Ve a tu dashboard de Render
2. Settings → API Keys → Create New API Key
3. Añade a tu `.env` o `.bashrc`:

```bash
export RENDER_API_KEY="tu-api-key-aqui"
```

## 📋 Comandos Principales

### Listar Servicios

```bash
# Modo interactivo (recomendado)
render services

# Modo texto (para scripts)
npm run render:services
```

### Ver Logs

#### Opción 1: Usando scripts npm (Recomendado)

```bash
# Linux/WSL
npm run render:logs list                    # Listar servicios
npm run render:logs tail backend           # Streaming logs
npm run render:logs view backend           # Ver últimos 100 logs
npm run render:logs errors backend         # Solo errores

# Windows
npm run render:logs:win list
npm run render:logs:win tail backend
```

#### Opción 2: Comando directo

```bash
# Ver últimos logs (modo interactivo)
render logs

# Streaming en tiempo real (NO funciona en modo no-interactivo)
npm run render:tail

# Ver logs de un servicio específico
render logs --resources srv-xxxxx --limit 200

# Filtrar por nivel de error
render logs --resources srv-xxxxx --level error

# Buscar texto específico
render logs --resources srv-xxxxx --text "Database connection"

# Rango de tiempo
render logs --resources srv-xxxxx --start "2025-01-20T10:00:00Z" --end "2025-01-20T12:00:00Z"

# Salida en JSON (para scripts)
render logs --resources srv-xxxxx --output json --limit 100
```

### Gestionar Deploys

```bash
# Ver deploys
render deploys

# Reiniciar servicio
render restart

# Desplegar manualmente (si aplica)
render services
# (Luego selecciona el servicio y opción de deploy)
```

### Sesiones de Base de Datos

```bash
# Conectar a PostgreSQL
render psql

# Con pgcli (mejor interfaz)
render pgcli
```

### SSH a Instancias

```bash
render ssh
```

## 🎯 Casos de Uso Comunes

### Debugging de Errores de Producción

```bash
# Paso 1: Ver servicios y obtener el ID
npm run render:services

# Paso 2: Ver errores recientes
npm run render:logs errors backend

# Paso 3: Si necesitas más contexto, ver todos los logs
npm run render:logs view backend --limit 500
```

### Monitorear Deploys en Tiempo Real

```bash
# Terminal 1: Ver el deploy
render deploys

# Terminal 2: Streaming de logs
npm run render:tail
```

### Buscar Logs Específicos

```bash
# Buscar "OpenAI API error"
render logs --resources srv-xxxxx --text "OpenAI API error" --limit 100

# Buscar en un rango de tiempo específico
render logs --resources srv-xxxxx \
  --start "2025-01-20T09:00:00Z" \
  --end "2025-01-20T10:00:00Z" \
  --output text
```

### Exportar Logs para Análisis

```bash
# Exportar a JSON
render logs --resources srv-xxxxx --limit 1000 --output json > logs.json

# Exportar a YAML
render logs --resources srv-xxxxx --limit 1000 --output yaml > logs.yaml

# Procesar con jq (Linux)
render logs --resources srv-xxxxx --output json | jq '.[] | select(.level=="error")'
```

## 🛠️ Scripts Personalizados

### Script Bash (Linux/WSL)

Ubicación: `scripts/render-logs.sh`

```bash
# Ver ayuda
./scripts/render-logs.sh

# Listar servicios
./scripts/render-logs.sh list

# Streaming logs
./scripts/render-logs.sh tail backend

# Ver últimos logs
./scripts/render-logs.sh view backend

# Filtrar errores
./scripts/render-logs.sh errors backend
```

### Script Batch (Windows)

Ubicación: `scripts/render-logs.bat`

```cmd
REM Ver ayuda
scripts\render-logs.bat

REM Listar servicios
scripts\render-logs.bat list

REM Streaming logs
scripts\render-logs.bat tail backend

REM Ver últimos logs
scripts\render-logs.bat view backend

REM Filtrar errores
scripts\render-logs.bat errors backend
```

## 🔧 Configuración Avanzada

### Workspace Management

Si tienes múltiples equipos/workspaces:

```bash
# Ver workspace actual
render whoami

# Cambiar workspace
render workspace
```

### Output Formats

Render CLI soporta 4 formatos de salida:

1. **interactive** (default): UI interactiva con navegación
2. **text**: Texto plano para lectura humana
3. **json**: Estructurado para scripts
4. **yaml**: Estructurado alternativo

```bash
render services --output json | jq '.[] | .name'
```

### Flags Útiles

```bash
--confirm          # Saltar confirmaciones (para scripts)
--output json      # Salida estructurada
--limit N          # Limitar resultados
--tail             # Streaming (solo modo interactivo)
```

## 🚨 Troubleshooting

### Error: "render: command not found"

```bash
# Linux/WSL
export PATH=$PATH:/home/sergio/.local/bin
source ~/.bashrc

# O reinstalar
curl -fsSL https://raw.githubusercontent.com/render-oss/cli/refs/heads/main/bin/install.sh | sh
```

### Error: "Not authenticated"

```bash
render login
```

### El streaming no funciona

El flag `--tail` **solo funciona en modo interactivo**. Si estás usando `--output json/yaml/text`, no puedes hacer streaming.

```bash
# ✅ Correcto
render logs --tail

# ❌ Incorrecto
render logs --tail --output json
```

### Ver más de 100 logs

```bash
# Default es 100
render logs --resources srv-xxxxx --limit 500

# Sin límite (cuidado con la cantidad)
render logs --resources srv-xxxxx --limit 99999
```

## 📚 Recursos Adicionales

- **Documentación oficial**: https://render.com/docs/cli
- **GitHub repo**: https://github.com/render-oss/cli
- **Dashboard de Render**: https://dashboard.render.com
- **Release notes**: https://github.com/render-oss/cli/releases

## 💡 Tips & Tricks

1. **Usa el modo interactivo para explorar**: `render logs` sin flags te da una UI visual
2. **Combina con herramientas Unix**: `render logs --output json | jq | less`
3. **Crea aliases en tu shell**:
   ```bash
   alias rlogs='render logs --tail'
   alias rservices='render services --output text'
   ```
4. **Usa scripts para tareas repetitivas**: Los scripts en `scripts/` ya están configurados
5. **El comando `render --help` es tu amigo**: Cada subcomando tiene su propia ayuda

## 🎓 Integración con Claude Code

Claude Code ahora puede ejecutar comandos de Render para:

- ✅ Ver logs en tiempo real durante debugging
- ✅ Identificar errores de producción
- ✅ Monitorear deploys
- ✅ Acceder a la base de datos via psql
- ✅ Gestionar servicios

Ejemplo de uso:

```bash
# Claude puede ejecutar:
render logs --resources srv-xxxxx --level error --limit 50 --output text
```

Y analizar los logs para encontrar problemas.

---

**🚀 ¡Listo! Ahora tienes acceso completo a los logs de producción desde la terminal.**
