# 🚀 Acceso Rápido a Logs de Render

## ✅ Estado Actual

Tu Render CLI está **completamente configurado** con API Key:

```
Usuario: Sergio
Email: sergiohernandezlara07@gmail.com
```

---

## 🎯 Método 1: Dashboard Web (MÁS RÁPIDO - Recomendado)

### Paso 1: Accede al Dashboard

Abre en tu navegador:

```
https://dashboard.render.com
```

### Paso 2: Selecciona Tu Servicio

1. Verás una lista de tus servicios
2. Busca tu backend (probablemente llamado algo como: `entrena-con-ia-backend`, `backend`, o similar)
3. Click en el nombre del servicio

### Paso 3: Ve a la Pestaña "Logs"

1. En la página del servicio, verás pestañas en la parte superior
2. Click en **"Logs"**
3. ¡Ya estás viendo tus logs en tiempo real! 🎉

### 🔍 Funciones Disponibles en el Dashboard

**Búsqueda y Filtros:**

- ✅ Buscar texto específico (ej: "error", "OpenAI", "database")
- ✅ Filtrar por nivel (debug, warning, error)
- ✅ Filtrar por instancia (si tienes múltiples)
- ✅ Filtrar por rango de tiempo
- ✅ **Live Tail** - Ver logs en tiempo real

**Búsqueda Avanzada:**

```
# Buscar errores 4xx
status_code:/4../

# Buscar con wildcard
OpenAI*error

# Buscar con regex
/error|warning|fail/i
```

**Información en Cada Log:**

- 🕐 Timestamp (hora local y UTC)
- 📊 Nivel (debug, info, warning, error)
- 🖥️ Instancia (qué servidor generó el log)
- 💬 Mensaje completo

---

## 🎯 Método 2: CLI Desde WSL (Requiere Configuración Extra)

### Configurar Workspace (Solo una vez)

```bash
# Abre WSL
cd /mnt/c/Users/Sergio/Desktop/Entrenaconia

# Configurar workspace
render workspace set
```

### Comandos de Logs

Una vez configurado el workspace:

```bash
# Ver logs en tiempo real (streaming)
render logs --tail --output text

# Ver últimos 200 logs
render logs --limit 200 --output text

# Solo errores
render logs --level error --output text

# Buscar texto específico
render logs --text "OpenAI" --output text

# Rango de tiempo
render logs --start "2025-01-20T10:00:00Z" --end "2025-01-20T12:00:00Z" --output text

# Exportar a JSON
render logs --limit 500 --output json > logs.json
```

---

## 🤖 Integración con Claude Code

Claude Code **ya tiene acceso** a tu cuenta de Render y puede:

### ✅ Disponible Ahora:

- Verificar autenticación: `render whoami`
- Consultar información de la cuenta

### 🔜 Disponible Después de Configurar Workspace:

- Ver logs en tiempo real
- Analizar errores de producción
- Monitorear deploys
- Investigar problemas específicos

---

## 🚨 ¿Qué es Mejor para Ti?

| Situación                       | Método Recomendado                       |
| ------------------------------- | ---------------------------------------- |
| Ver logs ahora mismo            | 🌐 **Dashboard Web**                     |
| Monitoreo continuo              | 🌐 **Dashboard Web** (Live Tail)         |
| Análisis de errores específicos | 🌐 **Dashboard Web** (Búsqueda avanzada) |
| Exportar logs para análisis     | 💻 **CLI** (render logs --output json)   |
| Automatizar monitoreo           | 💻 **CLI** (scripts)                     |
| Integrar con Claude Code        | 💻 **CLI**                               |

---

## 📊 Retención de Logs

Según tu plan de Render:

- **Hobby**: 7 días de logs
- **Professional**: 14 días de logs
- **Organization/Enterprise**: 30 días de logs

**Límite de velocidad:** 6,000 líneas por minuto por instancia

---

## 🎯 RECOMENDACIÓN INMEDIATA

**Para ver tus logs AHORA MISMO:**

1. Abre: https://dashboard.render.com
2. Click en tu servicio backend
3. Click en pestaña "Logs"
4. Activa "Live Tail" para ver logs en tiempo real

**Para integración con Claude Code:**

Ejecuta en WSL:

```bash
render workspace set
```

Y selecciona tu workspace cuando te lo pregunte.

---

## 🆘 Ayuda Rápida

**¿No ves tu servicio en el dashboard?**

- Verifica que estás logueado en la cuenta correcta
- Revisa que el servicio esté desplegado

**¿Los logs no aparecen?**

- Verifica que tu aplicación está corriendo
- Revisa que está generando logs (console.log, etc.)
- Verifica que no excedes el límite de 6,000 líneas/minuto

**¿Quieres más retención de logs?**

- Considera upgrade a plan Professional o superior
- O implementa log streaming a servicios externos (Papertrail, Datadog, etc.)

---

**🎉 ¡Todo está configurado! Accede al dashboard ahora para ver tus logs.**
