-- Script para crear tabla de planes de metodología manual
-- Fecha: 2025-08-24
-- Descripción: Almacenar planes generados por selección manual de metodología

-- Crear tabla para planes de metodología
CREATE TABLE IF NOT EXISTS app.methodology_plans (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
    methodology_type VARCHAR(50) NOT NULL, -- 'Heavy Duty', 'Powerlifting', etc.
    plan_data JSONB NOT NULL, -- Datos completos del plan generado
    generation_mode VARCHAR(20) DEFAULT 'manual', -- 'manual' o 'auto'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_methodology_plans_user_id ON app.methodology_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_methodology_plans_methodology_type ON app.methodology_plans(methodology_type);
CREATE INDEX IF NOT EXISTS idx_methodology_plans_created_at ON app.methodology_plans(created_at);

-- Agregar comentarios para documentación
COMMENT ON TABLE app.methodology_plans IS 'Almacena planes de entrenamiento generados por metodologías específicas';
COMMENT ON COLUMN app.methodology_plans.methodology_type IS 'Tipo de metodología: Heavy Duty, Powerlifting, Hipertrofia, etc.';
COMMENT ON COLUMN app.methodology_plans.plan_data IS 'Datos JSON completos del plan generado por IA';
COMMENT ON COLUMN app.methodology_plans.generation_mode IS 'Modo de generación: manual (usuario elige) o auto (IA elige)';
