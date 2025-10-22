# 🪟 Cómo Usar Render CLI desde Windows

## ✅ Solución Simple: Los Comandos Ya Funcionan

Tu Render CLI está configurado en WSL, pero ahora **puedes usarlo desde Windows CMD/PowerShell** sin necesidad de abrir WSL manualmente.

---

## 🚀 Comandos Disponibles desde Windows

Abre **CMD** o **PowerShell** en Windows y ejecuta:

### Ver Tu Usuario

```bash
npm run render:whoami
```

Resultado esperado:

```
Name: Sergio
Email: sergiohernandezlara07@gmail.com
```

### Listar Servicios

```bash
npm run render:services
```

Mostrará todos tus servicios de Render.

### Script Interactivo

```bash
npm run render:wsl
```

Menú interactivo con opciones:

- whoami
- services
- logs
- tail

---

## 📋 Cómo Funciona

Los comandos `npm run render:*` ejecutan scripts `.bat` que:

1. Llaman a WSL automáticamente
2. Cargan la configuración de Render
3. Ejecutan el comando
4. Muestran el resultado en Windows

**No necesitas abrir WSL manualmente.** Todo funciona desde tu terminal de Windows.

---

## 🎯 Ejemplo de Uso Completo

### Abrir CMD en Windows:

1. Presiona `Win + R`
2. Escribe: `cmd`
3. Presiona Enter

### Navegar al proyecto:

```cmd
cd C:\Users\Sergio\Desktop\Entrenaconia
```

### Ejecutar comandos:

```cmd
REM Ver usuario
npm run render:whoami

REM Ver servicios
npm run render:services

REM Menú interactivo
npm run render:wsl
```

---

## 🌐 Alternativa: Dashboard Web (Más Fácil para Logs)

Si solo quieres ver logs, la forma más rápida es:

1. Abre: https://dashboard.render.com
2. Click en tu servicio backend
3. Click en pestaña "Logs"
4. Activa "Live Tail"

**¡Listo!** Verás logs en tiempo real sin comandos.

---

## 🔧 Troubleshooting

### Error: "wsl: not found" o "WSL no disponible"

**Causa:** WSL no está instalado o no está en el PATH.

**Solución:**

```powershell
# Verificar si WSL está instalado
wsl --version

# Si no está instalado, instalarlo:
wsl --install
```

Luego reinicia tu computadora.

---

### Error: "bash: not found"

**Causa:** WSL no tiene bash instalado (raro, pero posible).

**Solución:**

1. Abre WSL: `wsl`
2. Verifica: `which bash`
3. Si no existe, instala: `sudo apt install bash`

---

### Los comandos no muestran nada

**Causa:** Puede haber un problema con la configuración de WSL.

**Solución rápida:**

Abre WSL manualmente:

```cmd
wsl
```

Luego ejecuta:

```bash
cd /mnt/c/Users/Sergio/Desktop/Entrenaconia
render whoami
```

Si funciona desde WSL pero no desde Windows CMD, el problema es con los scripts `.bat`.

---

## 🎓 Comandos Adicionales

### Instalar Render CLI en Windows (Opcional)

Si prefieres tener Render CLI nativo en Windows:

```cmd
npm run render:install:win
```

Esto te guiará para instalar con:

- Chocolatey
- Scoop
- Descarga manual

---

## 📚 Resumen de Comandos

| Desde Windows CMD/PowerShell | Acción                  |
| ---------------------------- | ----------------------- |
| `npm run render:whoami`      | Ver usuario autenticado |
| `npm run render:services`    | Listar servicios        |
| `npm run render:wsl`         | Menú interactivo        |
| `npm run render:install:win` | Instalar CLI en Windows |

| Desde WSL            | Acción                  |
| -------------------- | ----------------------- |
| `render whoami`      | Ver usuario             |
| `render services`    | Listar servicios        |
| `render logs --tail` | Ver logs en tiempo real |

---

## 🎯 Recomendación Final

**Para ver logs ahora mismo:**

🌐 **Usa el dashboard web:** https://dashboard.render.com

Es más fácil, más visual, y tiene funciones avanzadas de búsqueda.

**Para automatización o scripts:**

💻 **Usa los comandos npm** desde Windows CMD.

---

**¿Dudas?** Ejecuta `npm run render:wsl` para un menú interactivo que te guía.
