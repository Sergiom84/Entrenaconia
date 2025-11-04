-- ============================================
-- 🎯 MIGRACIÓN: TABLA DE LAYOUTS PERSONALIZADOS
-- ============================================
-- Permite a los usuarios personalizar el orden de elementos en la UI
-- (botones, widgets, cards, etc.)
--
-- Ejecutar en Supabase SQL Editor o vía psql

-- 1️⃣ Crear tabla en schema app
CREATE TABLE IF NOT EXISTS app.user_layouts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
  layout_id VARCHAR(100) NOT NULL, -- Identificador único del layout (ej: 'exercise-control-buttons')
  layout_data JSONB NOT NULL,      -- Array con el orden de los elementos
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Constraint: Un usuario solo puede tener un layout por layout_id
  UNIQUE(user_id, layout_id)
);

-- 2️⃣ Índices para optimizar búsquedas
CREATE INDEX idx_user_layouts_user_id ON app.user_layouts(user_id);
CREATE INDEX idx_user_layouts_layout_id ON app.user_layouts(layout_id);
CREATE INDEX idx_user_layouts_updated_at ON app.user_layouts(updated_at);

-- 3️⃣ Comentarios para documentación
COMMENT ON TABLE app.user_layouts IS 'Almacena layouts personalizados de UI por usuario';
COMMENT ON COLUMN app.user_layouts.layout_id IS 'ID único del layout (ej: exercise-control-buttons, nutrition-cards, profile-widgets)';
COMMENT ON COLUMN app.user_layouts.layout_data IS 'Array JSON con el orden de elementos, ej: ["btn-1", "btn-2", "btn-3"]';

-- 4️⃣ Ejemplo de datos
-- INSERT INTO app.user_layouts (user_id, layout_id, layout_data)
-- VALUES (1, 'exercise-control-buttons', '["btn-skip", "btn-reset", "btn-play-pause", "btn-cancel"]');

-- ============================================
-- ✅ MIGRACIÓN COMPLETADA
-- ============================================
-- Para verificar que funciona:
-- SELECT * FROM app.user_layouts;
