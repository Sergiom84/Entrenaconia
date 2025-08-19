import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db.js';

const router = express.Router();

// Registro de usuario
router.post('/register', async (req, res) => {
  try {
    const {
      nombre,
      apellido,
      email,
      password,
      edad,
      sexo,
      peso,
      altura,
      nivelEntrenamiento,
      anosEntrenando,
      frecuenciaSemanal,
      metodologiaPreferida,
      nivelActividad,
      // Medidas corporales
      cintura,
      pecho,
      brazos,
      muslos,
      cuello,
      antebrazos,
      // Información de salud
      historialMedico,
      limitacionesFisicas,
      alergias,
      medicamentos,
      // Objetivos
      objetivoPrincipal,
      metaPeso,
      metaGrasaCorporal,
      enfoqueEntrenamiento,
      horarioPreferido,
      comidasPorDia,
      suplementacion,
      alimentosExcluidos
    } = req.body;

    // Validar campos requeridos
    if (!nombre || !apellido || !email || !password) {
      return res.status(400).json({
        error: 'Los campos nombre, apellido, email y contraseña son requeridos'
      });
    }

    // Verificar si el usuario ya existe
    const existingUser = await pool.query(
      'SELECT id FROM app.users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        error: 'Ya existe un usuario con este email'
      });
    }

    // Encriptar contraseña
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Función para convertir cadenas vacías a null
    const toNullIfEmpty = (value) => {
      if (value === '' || value === undefined || value === null) return null;
      return value;
    };

    const toNumberOrNull = (value) => {
      if (value === '' || value === undefined || value === null) return null;
      const num = Number(value);
      return isNaN(num) ? null : num;
    };

    // Procesar valores numéricos
    const anosEntrenamientoValue = toNumberOrNull(anosEntrenando);
    const frecuenciaSemanalValue = toNumberOrNull(frecuenciaSemanal);

    // Validaciones opcionales (solo si el usuario proporciona valores)
    if (anosEntrenamientoValue !== null && (anosEntrenamientoValue < 0 || anosEntrenamientoValue > 50)) {
      return res.status(400).json({
        error: 'Los años de entrenamiento deben estar entre 0 y 50'
      });
    }

    if (frecuenciaSemanalValue !== null && (frecuenciaSemanalValue < 0 || frecuenciaSemanalValue > 7)) {
      return res.status(400).json({
        error: 'La frecuencia semanal debe estar entre 0 y 7 días'
      });
    }
    // Detectar tipos de columnas para campos que pueden ser ARRAY o TEXT según el esquema
    const arrayFields = ['alergias', 'medicamentos', 'suplementacion', 'alimentos_excluidos', 'limitaciones_fisicas'];
    const typeRes = await pool.query(`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE table_schema = ANY (current_schemas(true))
        AND table_name = 'users'
        AND column_name = ANY ($1)
    `, [arrayFields]);

    const isArrayColumn = Object.fromEntries(
      typeRes.rows.map(r => [
        r.column_name,
        r.data_type === 'ARRAY' || (r.udt_name && r.udt_name.startsWith('_'))
      ])
    );

    const normalizeArrayValue = (val, arrayExpected) => {
      if (val === '' || val === undefined || val === null) return null;
      if (!arrayExpected) return val; // se espera TEXT simple
      if (Array.isArray(val)) {
        return val
          .map(v => (v == null ? '' : String(v).trim()))
          .filter(Boolean);
      }
      if (typeof val === 'string') {
        const parts = val.split(',').map(s => s.trim()).filter(Boolean);
        return parts.length ? parts : [val.trim()];
      }
      return null;
    };

    const alergiasValue = normalizeArrayValue(alergias, isArrayColumn['alergias']);
    const medicamentosValue = normalizeArrayValue(medicamentos, isArrayColumn['medicamentos']);
    const suplementacionValue = normalizeArrayValue(suplementacion, isArrayColumn['suplementacion']);
    const alimentosExcluidosValue = normalizeArrayValue(alimentosExcluidos, isArrayColumn['alimentos_excluidos']);


    // Insertar usuario en la base de datos (created_at y updated_at se manejan automáticamente)
    const result = await pool.query(
      `INSERT INTO app.users (
        nombre, apellido, email, password_hash, edad, sexo, peso, altura,
        nivel_entrenamiento, anos_entrenando, frecuencia_semanal,
        metodologia_preferida, nivel_actividad, cintura, pecho, brazos,
        muslos, cuello, antebrazos, historial_medico, limitaciones_fisicas,
        alergias, medicamentos, objetivo_principal, meta_peso,
        meta_grasa_corporal, enfoque_entrenamiento, horario_preferido,
        comidas_por_dia, suplementacion, alimentos_excluidos
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28,
        $29, $30, $31
      ) RETURNING id, nombre, apellido, email, created_at`,
      [
        nombre, apellido, email, hashedPassword,
        toNumberOrNull(edad), toNullIfEmpty(sexo), toNumberOrNull(peso), toNumberOrNull(altura),
        toNullIfEmpty(nivelEntrenamiento), anosEntrenamientoValue, frecuenciaSemanalValue,
        toNullIfEmpty(metodologiaPreferida), toNullIfEmpty(nivelActividad),
        toNumberOrNull(cintura), toNumberOrNull(pecho), toNumberOrNull(brazos),
        toNumberOrNull(muslos), toNumberOrNull(cuello), toNumberOrNull(antebrazos),
        toNullIfEmpty(historialMedico), toNullIfEmpty(limitacionesFisicas),
        alergiasValue, medicamentosValue, toNullIfEmpty(objetivoPrincipal),
        toNumberOrNull(metaPeso), toNumberOrNull(metaGrasaCorporal), toNullIfEmpty(enfoqueEntrenamiento),
        toNullIfEmpty(horarioPreferido), toNumberOrNull(comidasPorDia), suplementacionValue,
        alimentosExcluidosValue
      ]
    );

    const user = result.rows[0];

    // Generar JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Usuario registrado exitosamente',
      user: {
        id: user.id,
        nombre: user.nombre,
        apellido: user.apellido,
        email: user.email
      },
      token
    });

  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Login de usuario
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validar campos requeridos
    if (!email || !password) {
      return res.status(400).json({
        error: 'Email y contraseña son requeridos'
      });
    }

    // Buscar usuario
    const result = await pool.query(
      'SELECT id, nombre, apellido, email, password_hash FROM app.users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: 'Credenciales incorrectas'
      });
    }

    const user = result.rows[0];

    // Verificar contraseña
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Credenciales incorrectas'
      });
    }

    // Generar JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login exitoso',
      user: {
        id: user.id,
        nombre: user.nombre,
        apellido: user.apellido,
        email: user.email
      },
      token
    });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Verificar token
router.get('/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Token no proporcionado' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const result = await pool.query(
      'SELECT id, nombre, apellido, email FROM app.users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }

    res.json({ user: result.rows[0] });

  } catch (error) {
    console.error('Error verificando token:', error);
    res.status(401).json({ error: 'Token inválido' });
  }
});

export default router;
