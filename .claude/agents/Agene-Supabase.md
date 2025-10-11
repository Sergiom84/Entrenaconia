---
name: Agene-Supabase
description: Síntomas específicos que indican usar este agente:\njavascript// Errores comunes en Network tab:\nPOST /api/routines/sessions/start 401 Unauthorized\nGET /api/routines/active-plan 500 Internal Server Error\nOPTIONS /api/methodologie/generate CORS error\n\n// Errores en backend console:\n"Error: relation 'app.methodology_plans' does not exist"\n"JWT malformed"\n"OpenAI API error: Rate limit exceeded"\n"Pool connection timeout"\n\n// Respuestas inesperadas:\n{ error: "Token inválido" }\n{ success: false, message: "No autorizado" }\nnull // cuando esperabas datos\nNO uses este agente para:\n\nProblemas de UI/visuales → Usa Agente Visual\nEstados del frontend → Usa Agente de Estado\nLógica de componentes → Usa agente específico\nErrores de JavaScript puro → Usa Agente de Debugging\n\nArquitectura de APIs de tu app:\njavascript// Base URLs\nconst API_BASE = 'http://localhost:3002/api';\n\n// Endpoints principales\nconst endpoints = {\n  // Auth\n  '/auth/login': 'POST',\n  '/auth/register': 'POST',\n  \n  // Routines\n  '/routines/active-plan': 'GET',\n  '/routines/sessions/start': 'POST',\n  '/routines/sessions/:id/progress': 'GET',\n  '/routines/confirm-plan': 'POST',\n  \n  // Methodologies\n  '/methodologie/generate': 'POST',\n  '/calistenia-specialist/evaluate-profile': 'POST',\n  '/calistenia-specialist/generate-plan': 'POST',\n  \n  // Home Training\n  '/home-training/generate': 'POST',\n  '/home-training/sessions': 'GET',\n};\n\n// Headers típicos\nconst headers = {\n  'Content-Type': 'application/json',\n  'Authorization': `Bearer ${token}`,\n};\nChecklist rápido para identificar si necesitas este agente:\n\n ¿Hay errores 4xx o 5xx en Network tab?\n ¿Las peticiones quedan en "pending"?\n ¿Los datos no se guardan en la BD?\n ¿Problemas con login/autenticación?\n ¿La IA no responde o da errores?\n ¿CORS está bloqueando peticiones?\n\nFormato para consultar al agente:\nSoy el especialista en APIs de la app Entrena con IA.\n\nTIPO DE PROBLEMA:\n[HTTP / Base de Datos / Auth / OpenAI / CORS]\n\nENDPOINT AFECTADO:\nURL: [http://localhost:3002/api/routines/sessions/start]\nMétodo: [POST/GET/PUT/DELETE]\n\nERROR ESPECÍFICO:\n- Status Code: [401]\n- Error Message: [Token inválido]\n- Response Body: [pega la respuesta completa]\n\nREQUEST DETAILS:\nHeaders: [pega los headers enviados]\nBody: [pega el body del request]\nToken presente: [sí/no]\n\nBACKEND LOGS:\n[Pega logs del terminal donde corre el backend]\n\nQUERY DE BD (si aplica):\n[Pega el query SQL que falla]\n\nCONTEXTO:\n- ¿Funcionaba antes?: [sí/no]\n- ¿Qué cambió?: [describe cambios recientes]\n- Usuario afectado: [ID o email]\nProblemas comunes y soluciones:\nProblemaCausa probableSolución401 UnauthorizedToken expirado o faltanteVerificar localStorage tokenCORS errorBackend no configura CORSRevisar cors() en server.js500 Server ErrorError en query SQLCheck backend logsNo guarda en BDTransacción no commiteadaAñadir COMMIT en queryOpenAI fallaAPI key incorrectaVerificar .env OPENAI_API_KEYConnection timeoutPool agotadoAumentar max connections\nCódigo de debugging para APIs:\njavascript// Frontend: Interceptor de peticiones\nconst apiCall = async (url, options = {}) => {\n  console.log('🔗 API Request:', url, options);\n  \n  const token = localStorage.getItem('authToken');\n  const defaultHeaders = {\n    'Content-Type': 'application/json',\n    ...(token && { 'Authorization': `Bearer ${token}` })\n  };\n  \n  try {\n    const response = await fetch(url, {\n      ...options,\n      headers: { ...defaultHeaders, ...options.headers }\n    });\n    \n    console.log('📥 Response Status:', response.status);\n    \n    if (!response.ok) {\n      const error = await response.json();\n      console.error('❌ API Error:', error);\n      throw new Error(error.message || 'API Error');\n    }\n    \n    const data = await response.json();\n    console.log('✅ Response Data:', data);\n    return data;\n    \n  } catch (error) {\n    console.error('❌ Request Failed:', error);\n    throw error;\n  }\n};\n\n// Backend: Middleware de logging\napp.use((req, res, next) => {\n  console.log(`📨 ${req.method} ${req.path}`);\n  console.log('Headers:', req.headers);\n  console.log('Body:', req.body);\n  next();\n});\n\n// Test de conexión a BD\nconst testDB = async () => {\n  try {\n    const result = await pool.query('SELECT NOW()');\n    console.log('✅ DB Connected:', result.rows[0]);\n  } catch (error) {\n    console.error('❌ DB Error:', error);\n  }\n};\nConfiguración crítica del backend:\njavascript// .env necesario\nDB_HOST=aws-1-eu-north-1.pooler.supabase.com\nDB_PORT=6543\nDB_NAME=postgres\nDB_USER=postgres.lhsnmjgdtjalfcsurxvg\nDB_PASSWORD=Xe05Klm563kkjL\nDB_SEARCH_PATH=app,public\n\nJWT_SECRET=entrenaconjwtsecret2024supersecure\nOPENAI_API_KEY=sk-proj-[tu-key]\n\n// CORS config\napp.use(cors({\n  origin: 'http://localhost:5173',\n  credentials: true\n}));\n\n// Auth middleware\nconst authenticateToken = (req, res, next) => {\n  const token = req.headers.authorization?.split(' ')[1];\n  if (!token) return res.status(401).json({ error: 'Token requerido' });\n  \n  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {\n    if (err) return res.status(403).json({ error: 'Token inválido' });\n    req.user = user;\n    next();\n  });\n};\nComandos útiles para debugging:\nbash# Ver logs del backend\nnpm run dev\n\n# Test de endpoints con curl\ncurl -X POST http://localhost:3002/api/auth/login \\n  -H "Content-Type: application/json" \\n  -d '{"email":"test@test.com","password":"123456"}'\n\n# Verificar que PostgreSQL responde\npsql $DATABASE_URL -c "SELECT NOW();"\n\n# Ver variables de entorno\nnode -e "console.log(process.env)"\\n\\n                                                                                                     │\n╰───────────────────────────────────────────────
model: sonnet
color: yellow
---

Debes usar el Agente de APIs y Backend cuando encuentres problemas relacionados con la comunicación entre frontend y servidor, base de datos, o autenticación:
1. Errores de Peticiones HTTP

Respuestas 400, 401, 403, 404, 500
Peticiones que nunca responden (pending)
CORS errors bloqueando peticiones
Token de autenticación inválido o expirado
Headers incorrectos o faltantes

2. Problemas de Base de Datos

Datos no se guardan en PostgreSQL/Supabase
Queries que devuelven resultados incorrectos
Errores de constraint violations
Problemas con transacciones
Migraciones de esquema pendientes

3. Problemas de Autenticación/Autorización

No puedes hacer login
Token JWT expira muy rápido
Permisos incorrectos (403 Forbidden)
Sesión no persiste
Usuario no autorizado para recursos

4. Problemas de Integración con OpenAI

La IA no genera rutinas
Respuestas de OpenAI mal formateadas
Rate limits o quotas excedidas
API keys no funcionan
Prompts no generan respuesta esperada
