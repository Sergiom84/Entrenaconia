# 🔧 Scripts de Verificación - Entrena con IA

## 📋 Descripción

Estos scripts te permiten verificar y corregir automáticamente la configuración de puertos de tu aplicación, detectar desfases entre frontend y backend, y reiniciar los servicios correctamente.

## 📁 Archivos incluidos

- **`check-and-restart.sh`** - Script para Git Bash / Linux / macOS
- **`check-and-restart.bat`** - Script para Windows Command Prompt
- **`README-scripts.md`** - Esta documentación

## 🚀 Uso rápido

### Git Bash (Recomendado)

```bash
./check-and-restart.sh
```

### Windows CMD

```cmd
check-and-restart.bat
```

## ✨ Funcionalidades

### 🔍 Verificación automática

- **Configuración en archivos**: Lee `.env.local`, `backend/.env` y `vite.config.js`
- **Puertos en uso**: Detecta qué servicios están ejecutándose
- **Conectividad**: Prueba si el backend responde correctamente
- **Detección de desfases**: Identifica inconsistencias entre configuraciones

### ⚙️ Opciones disponibles

| Opción | Descripción                                  |
| ------ | -------------------------------------------- |
| **1**  | Ver estado detallado actual                  |
| **2**  | Reiniciar servicios con configuración actual |
| **3**  | Configurar puertos recomendados y reiniciar  |
| **4**  | Solo matar procesos en puertos específicos   |
| **5**  | Abrir aplicación en navegador _(solo .bat)_  |

## 🎯 Configuración recomendada

```
Frontend: Puerto 5173
Backend:  Puerto 3002
```

Esta configuración:

- ✅ Usa los puertos por defecto de Vite y Express
- ✅ Evita conflictos con otros servicios
- ✅ Es la configuración estándar del proyecto

## 🔧 Lo que hace cada opción

### Opción 1: Estado detallado

Muestra un resumen completo:

- Puerto configurado vs puerto en uso
- Estado de conectividad frontend ↔ backend
- Desfases detectados

### Opción 2: Reiniciar con configuración actual

1. Mata todos los procesos en los puertos configurados
2. Inicia backend en segundo plano
3. Inicia frontend en segundo plano
4. Muestra las URLs para acceder

### Opción 3: Configuración recomendada

1. Actualiza automáticamente `.env.local` y `backend/.env`
2. Aplica puertos recomendados (Frontend: 5173, Backend: 3002)
3. Reinicia ambos servicios con la nueva configuración
4. ✅ **Opción más segura para resolver conflictos**

### Opción 4: Matar procesos específicos

- Permite liberar puertos específicos manualmente
- Útil cuando hay procesos "zombie" ocupando puertos

## 🔍 Detección de problemas comunes

El script detecta automáticamente:

| Problema                                        | Detección          | Solución          |
| ----------------------------------------------- | ------------------ | ----------------- |
| Frontend apunta a puerto incorrecto del backend | ❌ DESFASE         | Opción 3          |
| Servicios no ejecutándose                       | ❌ PROBLEMA        | Opción 2 o 3      |
| Puertos ocupados por otros procesos             | ⚠️ Puerto X en uso | Opción 4          |
| Backend no responde                             | ❌ Conectividad    | Reiniciar backend |

## 🐛 Solución de problemas

### "No se puede verificar el puerto"

- En Git Bash: El sistema no tiene `lsof` disponible
- **Solución**: Usa el archivo `.bat` en Windows

### "Error: Port already in use"

- **Causa**: Otro proceso está usando el puerto
- **Solución**: Ejecuta la opción 4 para matar el proceso

### "Backend no responde"

- **Causa**: Backend está crasheado o en puerto incorrecto
- **Solución**: Opción 3 para reconfigurar completamente

### Script se cuelga

- **Causa**: Proceso interactivo esperando entrada
- **Solución**: `Ctrl+C` para salir y usar opción 4

## 📱 Configuración actual vs detectada

El script siempre te muestra:

```
Configuración en archivos:
  Frontend: Puerto 5174 → API 3002
  Backend: Puerto 3002

Puertos actualmente en uso:
  ✅ Puerto 5174 en uso (Frontend)
  ✅ Puerto 3002 en uso (Backend)

Análisis de desfases:
  ✅ No se detectaron desfases
```

## 🌐 Acceso a la aplicación

Después de ejecutar el script, accede a tu aplicación en:

- **http://localhost:5173** (configuración recomendada)
- **http://localhost:[PUERTO_DETECTADO]** (configuración actual)

## ⚡ Casos de uso comunes

### "Acabo de clonar el proyecto"

```bash
./check-and-restart.sh
# Selecciona opción 3 para configuración limpia
```

### "La aplicación no carga"

```bash
./check-and-restart.sh
# Revisa la sección de desfases
# Usa opción 2 o 3 según los problemas detectados
```

### "Tengo múltiples versiones corriendo"

```bash
./check-and-restart.sh
# Selecciona opción 4 para matar todos los procesos
# Luego opción 3 para empezar limpio
```

### "Solo quiero verificar qué está corriendo"

```bash
./check-and-restart.sh
# Selecciona opción 1 para estado detallado
```

## 🔒 Seguridad

Los scripts:

- ✅ Solo modifican archivos de configuración del proyecto
- ✅ No envían datos por red
- ✅ No requieren permisos especiales
- ✅ Todos los cambios son reversibles manualmente

## 💡 Tips

- **Usa Git Bash**: Mejor compatibilidad y colores
- **Opción 3 primero**: Si tienes dudas, siempre elige la configuración recomendada
- **Guarda tu trabajo**: Los scripts matan procesos sin guardar cambios
- **Verifica el navegador**: Cierra pestañas viejas después de cambiar puertos

---

## ❓ ¿Problemas?

Si el script no funciona como esperabas:

1. **Verifica permisos**: `chmod +x check-and-restart.sh`
2. **Usa la versión correcta**: `.sh` para Git Bash, `.bat` para CMD
3. **Revisa los logs**: El script muestra información detallada de errores
4. **Configuración manual**: Puedes editar `.env.local` y `backend/.env` manualmente

¡Los scripts están diseñados para ser seguros y informativos!
