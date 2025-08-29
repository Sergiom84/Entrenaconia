# 🚀 Guía completa MCP - Entrena con IA

## 📋 MCP Servers instalados

### ✅ **Instalados y configurados:**

1. **🗄️ PostgreSQL MCP** (`supabase-db`)
   - Conexión directa a Supabase
   - Queries SQL optimizadas
   - Esquema `app` por defecto

2. **📁 Filesystem MCP** (`project-files`)
   - Gestión avanzada de archivos
   - Operaciones masivas
   - Búsquedas inteligentes

3. **🐙 GitHub MCP** (`github-repo`)
   - Gestión de repositorio
   - Commits automáticos
   - Issues y PRs

4. **🔍 Brave Search MCP** (`web-search`)
   - Búsquedas web
   - Documentación técnica
   - Tendencias tecnológicas

## 🎯 Ejemplos de uso prácticos

### **Base de datos (PostgreSQL MCP):**

**Antes (con Bash):**
```bash
PGPASSWORD="Xe05Klm563kkjL" psql -h aws-1-eu-north-1.pooler.supabase.com -p 6543 -U postgres -d postgres -c "SELECT COUNT(*) FROM app.users;"
```

**Ahora (con MCP):**
```
Consultar base de datos: SELECT COUNT(*) FROM users;
```

**Ejemplos específicos:**
- `SELECT * FROM home_training_combinations LIMIT 5;`
- `SELECT user_id, COUNT(*) as total_exercises FROM exercise_history GROUP BY user_id;`
- `UPDATE equipment_catalog SET active = true WHERE code = 'dumbbell';`

### **Archivos (Filesystem MCP):**

**Operaciones disponibles:**
- Búsqueda de archivos por patrón
- Lectura masiva de archivos
- Modificaciones en lote
- Análisis de código

**Ejemplos:**
- "Buscar todos los archivos .jsx que contengan 'useState'"
- "Modificar todos los imports de React en el proyecto"
- "Analizar la estructura de componentes"

### **GitHub (GitHub MCP):**

**Funcionalidades:**
- Crear commits automáticos
- Gestionar branches
- Crear Issues y PRs
- Analizar historial

## ⚙️ Configuración personalizada

### **Para activar GitHub MCP:**

1. Crear token de GitHub:
   - GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
   - Scopes: `repo`, `read:org`, `read:user`

2. Actualizar configuración:
```json
"GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_tu_token_aqui"
```

### **Para activar Brave Search:**

1. Obtener API key de Brave Search
2. Actualizar configuración:
```json
"BRAVE_SEARCH_API_KEY": "tu_api_key_aqui"
```

## 🔧 Comandos útiles MCP

### **Gestión de base de datos:**
- `Listar todas las tablas del esquema app`
- `Mostrar estructura de la tabla users`
- `Ejecutar consulta: SELECT * FROM methodology_plans WHERE user_id = 1;`
- `Optimizar consulta lenta: [tu query]`

### **Análisis de proyecto:**
- `Analizar estructura del proyecto`
- `Encontrar archivos duplicados`
- `Revisar imports no utilizados`
- `Generar documentación de API`

### **Gestión Git:**
- `Crear commit con mensaje descriptivo`
- `Crear branch para nueva feature`
- `Analizar cambios desde último commit`
- `Generar changelog`

## 🎯 Beneficios inmediatos

### **⚡ Velocidad:**
- Queries SQL directas (sin bash)
- Operaciones de archivos masivas
- Automatización de Git

### **🎯 Precisión:**
- Menos errores de sintaxis
- Validación automática
- Sugerencias inteligentes

### **🔄 Automatización:**
- Workflows completos
- Análisis automático
- Reportes generados

## 📊 Estado actual

```
✅ PostgreSQL MCP: Configurado y listo
✅ Filesystem MCP: Configurado y listo  
✅ GitHub MCP: Instalado (requiere token)
✅ Brave Search MCP: Instalado (requiere API key)
```

## 🚀 Próximos pasos

1. **Probar PostgreSQL MCP**: Ejecutar consultas a Supabase
2. **Configurar GitHub token**: Para gestión completa de repositorio
3. **Experimentar con Filesystem**: Operaciones masivas en código
4. **Obtener Brave API**: Para búsquedas web avanzadas

---

*¡Los MCP están listos para potenciar tu desarrollo! 🚀*