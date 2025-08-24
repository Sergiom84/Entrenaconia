-- Script SQL para implementar tablas faltantes y mejorar composición corporal
-- Fecha: 2025-08-23
-- Descripción: Implementa medical_documents, technique y mejora el sistema de composición corporal

-- =============================================
-- 1. TABLA MEDICAL_DOCUMENTS
-- =============================================
CREATE TABLE app.medical_documents (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    document_name VARCHAR(255) NOT NULL,
    document_type VARCHAR(50) NOT NULL, -- 'pdf', 'image', 'text'
    file_path VARCHAR(500), -- ruta del archivo físico
    content TEXT, -- contenido extraído del documento
    analysis_result JSONB, -- resultado del análisis IA
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'analyzed', 'error'
    upload_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    analyzed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT fk_medical_docs_user_id 
        FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE CASCADE,
    CONSTRAINT chk_medical_doc_type 
        CHECK (document_type IN ('pdf', 'image', 'text')),
    CONSTRAINT chk_medical_status 
        CHECK (status IN ('pending', 'analyzed', 'error'))
);

-- Índices para medical_documents
CREATE INDEX idx_medical_docs_user_id ON app.medical_documents(user_id);
CREATE INDEX idx_medical_docs_status ON app.medical_documents(status);
CREATE INDEX idx_medical_docs_type ON app.medical_documents(document_type);
CREATE INDEX idx_medical_docs_upload_date ON app.medical_documents(upload_date);

-- Comentarios
COMMENT ON TABLE app.medical_documents IS 'Documentos médicos de los usuarios con análisis IA';
COMMENT ON COLUMN app.medical_documents.analysis_result IS 'Resultado JSON del análisis IA del documento médico';

-- =============================================
-- 2. TABLAS PARA SISTEMA DE TÉCNICAS
-- =============================================

-- Catálogo de ejercicios
CREATE TABLE app.exercises_catalog (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    key VARCHAR(50) UNIQUE NOT NULL, -- identificador único
    category VARCHAR(50) NOT NULL, -- 'strength', 'cardio', 'flexibility', etc.
    muscle_groups TEXT[], -- grupos musculares trabajados
    equipment_required VARCHAR(50), -- equipamiento necesario
    difficulty_level VARCHAR(20) DEFAULT 'beginner', -- 'beginner', 'intermediate', 'advanced'
    description TEXT,
    instructions TEXT,
    video_url VARCHAR(255),
    gif_url VARCHAR(255),
    safety_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Constraints
    CONSTRAINT chk_exercises_difficulty 
        CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')),
    CONSTRAINT chk_exercises_category 
        CHECK (category IN ('strength', 'cardio', 'flexibility', 'mobility', 'balance', 'functional'))
);

-- Análisis de técnica por usuario
CREATE TABLE app.technique_analysis (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    exercise_key VARCHAR(50) NOT NULL,
    video_url VARCHAR(500), -- URL del video subido por el usuario
    analysis_result JSONB NOT NULL, -- resultado del análisis IA
    score INTEGER, -- puntuación general de técnica (0-100)
    feedback TEXT, -- retroalimentación detallada
    corrections TEXT[], -- correcciones sugeridas
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'analyzed', 'reviewed'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    analyzed_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT fk_technique_user_id 
        FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE CASCADE,
    CONSTRAINT fk_technique_exercise 
        FOREIGN KEY (exercise_key) REFERENCES app.exercises_catalog(key) ON DELETE CASCADE,
    CONSTRAINT chk_technique_status 
        CHECK (status IN ('pending', 'analyzed', 'reviewed')),
    CONSTRAINT chk_technique_score 
        CHECK (score IS NULL OR (score >= 0 AND score <= 100))
);

-- Índices para sistema de técnicas
CREATE INDEX idx_exercises_key ON app.exercises_catalog(key);
CREATE INDEX idx_exercises_category ON app.exercises_catalog(category);
CREATE INDEX idx_exercises_difficulty ON app.exercises_catalog(difficulty_level);
CREATE INDEX idx_technique_user_id ON app.technique_analysis(user_id);
CREATE INDEX idx_technique_exercise ON app.technique_analysis(exercise_key);
CREATE INDEX idx_technique_status ON app.technique_analysis(status);

-- Comentarios
COMMENT ON TABLE app.exercises_catalog IS 'Catálogo de ejercicios con información técnica';
COMMENT ON TABLE app.technique_analysis IS 'Análisis de técnica de ejercicios por IA';

-- =============================================
-- 3. MEJORAS EN COMPOSICIÓN CORPORAL
-- =============================================

-- Historial de composición corporal
CREATE TABLE app.body_composition_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    measurement_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    peso NUMERIC(5,2),
    grasa_corporal NUMERIC(5,2), -- porcentaje
    masa_muscular NUMERIC(5,2), -- kg
    agua_corporal NUMERIC(5,2), -- porcentaje
    metabolismo_basal INTEGER, -- kcal
    imc NUMERIC(4,2), -- índice de masa corporal
    -- Medidas utilizadas para el cálculo
    cintura NUMERIC(5,2),
    cuello NUMERIC(5,2),
    cadera NUMERIC(5,2), -- para cálculos más precisos en mujeres
    calculation_method VARCHAR(50) DEFAULT 'us_navy', -- método de cálculo utilizado
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT fk_body_comp_user_id 
        FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE CASCADE,
    CONSTRAINT chk_body_comp_grasa 
        CHECK (grasa_corporal IS NULL OR (grasa_corporal >= 1 AND grasa_corporal <= 50)),
    CONSTRAINT chk_body_comp_agua 
        CHECK (agua_corporal IS NULL OR (agua_corporal >= 40 AND agua_corporal <= 80)),
    CONSTRAINT chk_body_comp_method 
        CHECK (calculation_method IN ('us_navy', 'dexa', 'bioimpedance', 'manual'))
);

-- Índices para composición corporal
CREATE INDEX idx_body_comp_user_id ON app.body_composition_history(user_id);
CREATE INDEX idx_body_comp_date ON app.body_composition_history(measurement_date);

-- Comentarios
COMMENT ON TABLE app.body_composition_history IS 'Historial de mediciones de composición corporal';
COMMENT ON COLUMN app.body_composition_history.calculation_method IS 'Método utilizado para calcular la composición';

-- =============================================
-- 4. FUNCIÓN PARA GUARDAR COMPOSICIÓN CORPORAL
-- =============================================

-- Función para guardar automáticamente en el historial
CREATE OR REPLACE FUNCTION app.save_body_composition()
RETURNS TRIGGER AS $$
BEGIN
    -- Solo guardar si algún campo de composición corporal cambió
    IF (OLD.grasa_corporal IS DISTINCT FROM NEW.grasa_corporal) OR 
       (OLD.masa_muscular IS DISTINCT FROM NEW.masa_muscular) OR 
       (OLD.agua_corporal IS DISTINCT FROM NEW.agua_corporal) OR 
       (OLD.metabolismo_basal IS DISTINCT FROM NEW.metabolismo_basal) THEN
        
        INSERT INTO app.body_composition_history (
            user_id, 
            peso, 
            grasa_corporal, 
            masa_muscular, 
            agua_corporal, 
            metabolismo_basal,
            cintura,
            cuello,
            calculation_method,
            notes
        ) VALUES (
            NEW.id,
            NEW.peso,
            NEW.grasa_corporal,
            NEW.masa_muscular,
            NEW.agua_corporal,
            NEW.metabolismo_basal,
            NEW.cintura,
            NEW.cuello,
            'us_navy',
            'Actualización automática desde calculadora'
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para guardar automáticamente en el historial
CREATE TRIGGER trg_save_body_composition
    AFTER UPDATE ON app.users
    FOR EACH ROW
    EXECUTE FUNCTION app.save_body_composition();

-- =============================================
-- 5. DATOS INICIALES PARA EJERCICIOS
-- =============================================

-- Insertar algunos ejercicios básicos
INSERT INTO app.exercises_catalog (name, key, category, muscle_groups, equipment_required, difficulty_level, description, instructions, safety_notes) VALUES
('Flexiones de Brazos', 'push_ups', 'strength', ARRAY['pecho', 'triceps', 'hombros'], 'peso_corporal', 'beginner', 'Ejercicio básico de empuje para tren superior', 'Mantén el cuerpo recto, baja hasta que el pecho casi toque el suelo', 'No arquees la espalda, mantén el core activado'),
('Sentadillas', 'squats', 'strength', ARRAY['cuadriceps', 'gluteos', 'isquiotibiales'], 'peso_corporal', 'beginner', 'Ejercicio fundamental para tren inferior', 'Baja como si te fueras a sentar, mantén las rodillas alineadas', 'No dejes que las rodillas pasen de los dedos de los pies'),
('Dominadas', 'pull_ups', 'strength', ARRAY['espalda', 'biceps'], 'barra_dominadas', 'intermediate', 'Ejercicio de tracción para espalda', 'Cuelga de la barra y tira hasta que el mentón pase la barra', 'Controla el descenso, no te dejes caer'),
('Burpees', 'burpees', 'cardio', ARRAY['cuerpo_completo'], 'peso_corporal', 'intermediate', 'Ejercicio cardiovascular de cuerpo completo', 'Combina flexión, salto y sentadilla en un movimiento fluido', 'Mantén un ritmo controlado para evitar lesiones'),
('Plancha', 'plank', 'strength', ARRAY['core', 'hombros'], 'peso_corporal', 'beginner', 'Ejercicio isométrico para el core', 'Mantén el cuerpo recto como una tabla', 'No hundas las caderas ni las eleves demasiado');

-- =============================================
-- 6. PERMISOS Y COMENTARIOS FINALES
-- =============================================

-- Asegurar que todas las tablas pertenecen al usuario postgres
ALTER TABLE app.medical_documents OWNER TO postgres;
ALTER TABLE app.exercises_catalog OWNER TO postgres;
ALTER TABLE app.technique_analysis OWNER TO postgres;
ALTER TABLE app.body_composition_history OWNER TO postgres;

-- Comentarios finales
COMMENT ON SCHEMA app IS 'Schema principal de la aplicación Entrena con IA';

-- Mostrar resumen de tablas creadas
SELECT 
    schemaname, 
    tablename, 
    tableowner 
FROM pg_tables 
WHERE schemaname = 'app' 
    AND tablename IN (
        'medical_documents', 
        'exercises_catalog', 
        'technique_analysis', 
        'body_composition_history'
    )
ORDER BY tablename;

PRINT 'Script completado. Tablas creadas:';
PRINT '- app.medical_documents (gestión de documentos médicos)';
PRINT '- app.exercises_catalog (catálogo de ejercicios)';
PRINT '- app.technique_analysis (análisis de técnica)';
PRINT '- app.body_composition_history (historial de composición corporal)';
PRINT '- Trigger automático para guardar historial de composición corporal';
