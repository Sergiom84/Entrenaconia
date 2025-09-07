# 📋 Patrón Estándar para Consultas de Perfil de Usuario

## 🎯 Problema Identificado (**CORREGIDO**)

**ERROR INICIAL**: Asumimos incorrectamente que los datos del perfil estaban en `app.user_profiles`.

**REALIDAD**: Los datos principales del perfil (edad, peso, altura, alergias, etc.) **SÍ están en `app.users`**.  
La tabla `app.user_profiles` solo contiene campos específicos: `objetivo_principal`, `limitaciones_fisicas`, `metodologia_preferida`, `music_config`.

## ✅ Solución Implementada

**USAR SIEMPRE** el siguiente patrón para consultas de perfil completo:

```sql
SELECT
  u.id, u.nombre, u.apellido, u.email, u.created_at,
  p.edad, p.sexo, p.peso, p.altura,
  p.anos_entrenando, p.nivel_entrenamiento, p.objetivo_principal,
  p.nivel_actividad, p.grasa_corporal, p.masa_muscular,
  p.pecho, p.brazos, p.alergias, p.medicamentos,
  p.suplementacion, p.limitaciones_fisicas,
  -- Añadir otros campos según necesidades específicas
FROM app.users u
LEFT JOIN app.user_profiles p ON u.id = p.user_id
WHERE u.id = $1
```

## 🔧 Archivos Corregidos (Septiembre 2025)

### Consultas de Perfil Completo

1. **calisteniaSpecialist.js** ✅ - Evaluación y generación de planes
2. **calisteniaManual.js** ✅ - `getUserProfileWithEquipment()`
3. **aiMethodologie.js** ✅ - Generación de metodologías automáticas
4. **IAHomeTraining.js** ✅ - Entrenamiento en casa con IA
5. **methodologyManual.js** ✅ - Metodologías manuales
6. **users.js** ✅ - API de perfil de usuario (GET /users/:id)
7. **gymRoutineAI.js** ✅ - Rutinas de gimnasio con IA

### Consultas Específicas

8. **bodyComposition.js** ✅ - Solo altura para cálculo IMC

## 📊 Campos Disponibles

### Tabla `users` (Básicos)

- `id`, `nombre`, `apellido`, `email`
- `created_at`, `updated_at`

### Tabla `user_profiles` (Perfil Completo)

- **Físicos**: `edad`, `sexo`, `peso`, `altura`
- **Entrenamiento**: `nivel_entrenamiento`, `anos_entrenando`, `frecuencia_semanal`
- **Composición**: `grasa_corporal`, `masa_muscular`, `agua_corporal`, `metabolismo_basal`
- **Medidas**: `cintura`, `pecho`, `brazos`, `muslos`, `cuello`, `antebrazos`, `cadera`
- **Objetivos**: `objetivo_principal`, `meta_peso`, `meta_grasa_corporal`
- **Salud**: `alergias`, `medicamentos`, `limitaciones_fisicas`, `historial_medico`
- **Preferencias**: `metodologia_preferida`, `nivel_actividad`, `horario_preferido`
- **Nutrición**: `suplementacion`, `alimentos_excluidos`, `comidas_por_dia`

## ⚠️ Casos Especiales que NO Necesitan JOIN

### Archivos que están CORRECTOS (solo necesitan datos básicos):

1. **auth.js** ✅ - Login/registro

   ```sql
   SELECT id, email, password_hash FROM app.users WHERE email = $1
   ```

2. **Scripts de verificación/testing** ✅ - Solo verifican existencia
   ```sql
   SELECT * FROM app.users WHERE id = $1
   ```

## 🛠️ Implementación en Nuevos Archivos

**SIEMPRE** usar este template para nuevas consultas:

```javascript
// ✅ CORRECTO - Template para copiar/pegar
const getUserProfile = async (userId) => {
  const userQuery = await pool.query(
    `
    SELECT 
      u.id, u.nombre, u.apellido, u.email,
      p.edad, p.sexo, p.peso, p.altura,
      p.nivel_entrenamiento, p.anos_entrenando, p.objetivo_principal,
      p.nivel_actividad, p.limitaciones_fisicas, p.alergias,
      -- Añadir campos específicos según necesidades
    FROM app.users u
    LEFT JOIN app.user_profiles p ON u.id = p.user_id
    WHERE u.id = $1
  `,
    [userId],
  );

  if (userQuery.rowCount === 0) {
    throw new Error("Usuario no encontrado");
  }

  return userQuery.rows[0];
};
```

```javascript
// ❌ INCORRECTO - No hacer esto nunca
const getUserProfile = async (userId) => {
  const userQuery = await pool.query(
    `
    SELECT * FROM app.users WHERE id = $1  // ❌ Datos de perfil estarán vacíos
  `,
    [userId],
  );
};
```

## 🔍 Cómo Detectar el Problema

Si ves logs como estos, significa que falta el JOIN:

```
{
  'Datos Básicos': {
    edad: 'No especificado',          // ❌ Debería tener valor real
    peso: 'No especificado',          // ❌ Debería tener valor real
    altura: 'No especificado',        // ❌ Debería tener valor real
  }
}
```

## 📈 Beneficios de la Corrección

1. **Datos Reales**: La IA recibe información completa del usuario
2. **Personalizaciones Precisas**: Planes adaptados al perfil real
3. **Mejor UX**: Recomendaciones más acertadas
4. **Consistencia**: Todas las APIs usan el mismo patrón

---

_Documentado: Septiembre 7, 2025_  
_Aplicado a: 8 archivos backend_  
_Estado: Implementación completa ✅_
