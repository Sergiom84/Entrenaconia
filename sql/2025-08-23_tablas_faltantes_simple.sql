-- =============================================
-- SCRIPT INCREMENTAL PARA TABLAS FALTANTES
-- Fecha: 2025-08-23
-- =============================================

-- 1. TABLA MEDICAL_DOCUMENTS
CREATE TABLE IF NOT EXISTS app.medical_documents (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    document_name VARCHAR(255) NOT NULL,
    document_type VARCHAR(50) NOT NULL,
    file_path VARCHAR(500),
    content TEXT,
    analysis_result JSONB,
    status VARCHAR(20) DEFAULT 'pending',
    upload_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    analyzed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT fk_medical_docs_user_id 
        FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE CASCADE,
    CONSTRAINT chk_medical_doc_type 
        CHECK (document_type IN ('pdf', 'image', 'text')),
    CONSTRAINT chk_medical_status 
        CHECK (status IN ('pending', 'analyzed', 'error'))
);

-- 2. CATÁLOGO DE EJERCICIOS
CREATE TABLE IF NOT EXISTS app.exercises_catalog (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    key VARCHAR(50) UNIQUE NOT NULL,
    category VARCHAR(50) NOT NULL,
    muscle_groups TEXT[],
    equipment_required VARCHAR(50),
    difficulty_level VARCHAR(20) DEFAULT 'beginner',
    description TEXT,
    instructions TEXT,
    video_url VARCHAR(255),
    gif_url VARCHAR(255),
    safety_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    
    CONSTRAINT chk_exercises_difficulty 
        CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')),
    CONSTRAINT chk_exercises_category 
        CHECK (category IN ('strength', 'cardio', 'flexibility', 'mobility', 'balance', 'functional'))
);

-- 3. ANÁLISIS DE TÉCNICA
CREATE TABLE IF NOT EXISTS app.technique_analysis (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    exercise_key VARCHAR(50) NOT NULL,
    video_url VARCHAR(500),
    analysis_result JSONB NOT NULL,
    score INTEGER,
    feedback TEXT,
    corrections TEXT[],
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    analyzed_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT fk_technique_user_id 
        FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE CASCADE,
    CONSTRAINT chk_technique_status 
        CHECK (status IN ('pending', 'analyzed', 'reviewed')),
    CONSTRAINT chk_technique_score 
        CHECK (score IS NULL OR (score >= 0 AND score <= 100))
);

-- 4. HISTORIAL DE COMPOSICIÓN CORPORAL
CREATE TABLE IF NOT EXISTS app.body_composition_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    measurement_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    peso NUMERIC(5,2),
    grasa_corporal NUMERIC(5,2),
    masa_muscular NUMERIC(5,2),
    agua_corporal NUMERIC(5,2),
    metabolismo_basal INTEGER,
    imc NUMERIC(4,2),
    cintura NUMERIC(5,2),
    cuello NUMERIC(5,2),
    cadera NUMERIC(5,2),
    calculation_method VARCHAR(50) DEFAULT 'us_navy',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT fk_body_comp_user_id 
        FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE CASCADE,
    CONSTRAINT chk_body_comp_grasa 
        CHECK (grasa_corporal IS NULL OR (grasa_corporal >= 1 AND grasa_corporal <= 50)),
    CONSTRAINT chk_body_comp_agua 
        CHECK (agua_corporal IS NULL OR (agua_corporal >= 40 AND agua_corporal <= 80)),
    CONSTRAINT chk_body_comp_method 
        CHECK (calculation_method IN ('us_navy', 'dexa', 'bioimpedance', 'manual'))
);

-- 5. ÍNDICES
CREATE INDEX IF NOT EXISTS idx_medical_docs_user_id ON app.medical_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_exercises_key ON app.exercises_catalog(key);
CREATE INDEX IF NOT EXISTS idx_technique_user_id ON app.technique_analysis(user_id);
CREATE INDEX IF NOT EXISTS idx_body_comp_user_id ON app.body_composition_history(user_id);
CREATE INDEX IF NOT EXISTS idx_body_comp_date ON app.body_composition_history(measurement_date);

-- 6. FUNCIÓN Y TRIGGER PARA COMPOSICIÓN CORPORAL (solo si no existe)
DO $$
BEGIN
    -- Crear función si no existe
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'save_body_composition') THEN
        EXECUTE '
        CREATE FUNCTION app.save_body_composition()
        RETURNS TRIGGER AS $FUNC$
        BEGIN
            IF (OLD.grasa_corporal IS DISTINCT FROM NEW.grasa_corporal) OR 
               (OLD.masa_muscular IS DISTINCT FROM NEW.masa_muscular) OR 
               (OLD.agua_corporal IS DISTINCT FROM NEW.agua_corporal) OR 
               (OLD.metabolismo_basal IS DISTINCT FROM NEW.metabolismo_basal) THEN
                
                INSERT INTO app.body_composition_history (
                    user_id, peso, grasa_corporal, masa_muscular, agua_corporal, 
                    metabolismo_basal, cintura, cuello, calculation_method, notes
                ) VALUES (
                    NEW.id, NEW.peso, NEW.grasa_corporal, NEW.masa_muscular, 
                    NEW.agua_corporal, NEW.metabolismo_basal, NEW.cintura, NEW.cuello,
                    ''us_navy'', ''Actualización automática desde calculadora''
                );
            END IF;
            
            RETURN NEW;
        END;
        $FUNC$ LANGUAGE plpgsql';
    END IF;

    -- Crear trigger si no existe
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_save_body_composition') THEN
        EXECUTE '
        CREATE TRIGGER trg_save_body_composition
            AFTER UPDATE ON app.users
            FOR EACH ROW
            EXECUTE FUNCTION app.save_body_composition()';
    END IF;
END $$;

-- 7. DATOS INICIALES DE EJERCICIOS (solo insertar si la tabla está vacía)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM app.exercises_catalog LIMIT 1) THEN
        INSERT INTO app.exercises_catalog (name, key, category, muscle_groups, equipment_required, difficulty_level, description, instructions, safety_notes) VALUES
        ('Flexiones de Brazos', 'push_ups', 'strength', ARRAY['pecho', 'triceps', 'hombros'], 'peso_corporal', 'beginner', 'Ejercicio básico de empuje para tren superior', 'Mantén el cuerpo recto, baja hasta que el pecho casi toque el suelo', 'No arquees la espalda, mantén el core activado'),
        ('Sentadillas', 'squats', 'strength', ARRAY['cuadriceps', 'gluteos', 'isquiotibiales'], 'peso_corporal', 'beginner', 'Ejercicio fundamental para tren inferior', 'Baja como si te fueras a sentar, mantén las rodillas alineadas', 'No dejes que las rodillas pasen de los dedos de los pies'),
        ('Dominadas', 'pull_ups', 'strength', ARRAY['espalda', 'biceps'], 'barra_dominadas', 'intermediate', 'Ejercicio de tracción para espalda', 'Cuelga de la barra y tira hasta que el mentón pase la barra', 'Controla el descenso, no te dejes caer'),
        ('Burpees', 'burpees', 'cardio', ARRAY['cuerpo_completo'], 'peso_corporal', 'intermediate', 'Ejercicio cardiovascular de cuerpo completo', 'Combina flexión, salto y sentadilla en un movimiento fluido', 'Mantén un ritmo controlado para evitar lesiones'),
        ('Plancha', 'plank', 'strength', ARRAY['core', 'hombros'], 'peso_corporal', 'beginner', 'Ejercicio isométrico para el core', 'Mantén el cuerpo recto como una tabla', 'No hundas las caderas ni las eleves demasiado');
    END IF;
END $$;

-- Verificar que todo se creó correctamente
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
