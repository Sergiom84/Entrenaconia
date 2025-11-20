# 🔧 Troubleshooting - MCP Supabase

## Estado Actual

- ✅ `.mcp.json` configurado en `/mnt/c/Users/Sergio/Desktop/Entrenaconia/.mcp.json`
- ✅ Access Token: `sbp_a695c76d20b4c0e34b4bf218f79c76469b04fa57`
- ✅ Servidor MCP: `@supabase/mcp-server-supabase@latest`
- ⚠️ Conexión: Fallando

## Pasos para Resolver

### 1️⃣ Deshabilita y Rehabilita

```bash
/mcp disable supabase
/mcp enable supabase
```

### 2️⃣ Si Aún Falla, Usa Debug Mode

```bash
claude --debug
```

Esto mostrará los logs en tiempo real. Busca líneas como:

```
[supabase] Connecting...
[supabase] Connection established
```

### 3️⃣ Limpia la Caché de NPM

```bash
npm cache clean --force
npx -y @supabase/mcp-server-supabase@latest --access-token "sbp_a695c76d20b4c0e34b4bf218f79c76469b04fa57"
```

### 4️⃣ Verifica el Token de Acceso

El token actual es: `sbp_a695c76d20b4c0e34b4bf218f79c76469b04fa57`

Puedes verificarlo en: https://supabase.com/dashboard/account/tokens

### 5️⃣ Si el Token Expiró

1. Ve a https://supabase.com/dashboard/account/tokens
2. Genera un nuevo token
3. Actualiza `.mcp.json` con el nuevo token

## Configuración Actual (.mcp.json)

```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": [
        "-y",
        "@supabase/mcp-server-supabase@latest",
        "--access-token",
        "sbp_a695c76d20b4c0e34b4bf218f79c76469b04fa57"
      ]
    }
  }
}
```

## Alternativa: Usar URL de Proyecto

Si el token no funciona, puedes usar la URL del proyecto:

```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": [
        "-y",
        "@supabase/mcp-server-supabase@latest",
        "--project-ref",
        "lhsnmjgdtjalfcsurxvg"
      ]
    }
  }
}
```

**Nota**: Con esta configuración, Claude Code usará el proyecto de forma más limitada.

## Verificar Credenciales en .env

Tus credenciales actuales son:

- **Project ID**: `lhsnmjgdtjalfcsurxvg`
- **DB Host**: `aws-1-eu-north-1.pooler.supabase.com`
- **DB User**: `postgres.lhsnmjgdtjalfcsurxvg`
- **Anon Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

## Logs a Buscar

Cuando ejecutes `claude --debug`, busca estos mensajes:

✅ **Éxito**:

```
[supabase] MCP server started
[supabase] Connection pool established
```

❌ **Errores Comunes**:

```
[supabase] Authentication failed - invalid token
[supabase] Timeout connecting to database
[supabase] Invalid project reference
```

## Siguiente Paso

Una vez que el MCP esté funcionando, podrás:

1. Consultar la base de datos directamente
2. Ejecutar queries SQL
3. Ver el esquema de tablas
4. Inspeccionar datos

---

**Última actualización**: 2025-01-19
**Estado**: En troubleshooting
