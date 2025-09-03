-- Simple schema update for abandonment tracking
-- Solo las columnas esenciales

-- 1. Agregar columnas para tracking de abandono
ALTER TABLE app.home_training_sessions 
ADD COLUMN IF NOT EXISTS abandoned_at TIMESTAMP NULL,
ADD COLUMN IF NOT EXISTS abandon_reason VARCHAR(50) NULL;