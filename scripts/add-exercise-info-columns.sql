-- ===============================================================================
-- SCRIPT: Añadir columnas de información IA a tablas de ejercicios
-- ===============================================================================
-- Descripción: Añade columnas para cachear información de IA de cada ejercicio
-- Columnas: ejecucion, consejos, errores_evitar
-- Propósito: Evitar llamadas repetidas a OpenAI (ahorro de tokens y costos)
-- Fecha: 2025-01-13
-- ===============================================================================

-- ===============================================================================
-- 1. EJERCICIOS_BOMBEROS
-- ===============================================================================
ALTER TABLE app."Ejercicios_Bomberos"
  ADD COLUMN IF NOT EXISTS ejecucion TEXT,
  ADD COLUMN IF NOT EXISTS consejos TEXT,
  ADD COLUMN IF NOT EXISTS errores_evitar TEXT;

COMMENT ON COLUMN app."Ejercicios_Bomberos".ejecucion IS 'Explicación paso a paso de cómo ejecutar el ejercicio (generado por IA)';
COMMENT ON COLUMN app."Ejercicios_Bomberos".consejos IS 'Consejos para mejorar técnica y maximizar beneficios (generado por IA)';
COMMENT ON COLUMN app."Ejercicios_Bomberos".errores_evitar IS 'Errores comunes a evitar (generado por IA)';

-- ===============================================================================
-- 2. EJERCICIOS_CALISTENIA
-- ===============================================================================
ALTER TABLE app."Ejercicios_Calistenia"
  ADD COLUMN IF NOT EXISTS ejecucion TEXT,
  ADD COLUMN IF NOT EXISTS consejos TEXT,
  ADD COLUMN IF NOT EXISTS errores_evitar TEXT;

COMMENT ON COLUMN app."Ejercicios_Calistenia".ejecucion IS 'Explicación paso a paso de cómo ejecutar el ejercicio (generado por IA)';
COMMENT ON COLUMN app."Ejercicios_Calistenia".consejos IS 'Consejos para mejorar técnica y maximizar beneficios (generado por IA)';
COMMENT ON COLUMN app."Ejercicios_Calistenia".errores_evitar IS 'Errores comunes a evitar (generado por IA)';

-- ===============================================================================
-- 3. EJERCICIOS_CASA
-- ===============================================================================
ALTER TABLE app."Ejercicios_Casa"
  ADD COLUMN IF NOT EXISTS ejecucion TEXT,
  ADD COLUMN IF NOT EXISTS consejos TEXT,
  ADD COLUMN IF NOT EXISTS errores_evitar TEXT;

COMMENT ON COLUMN app."Ejercicios_Casa".ejecucion IS 'Explicación paso a paso de cómo ejecutar el ejercicio (generado por IA)';
COMMENT ON COLUMN app."Ejercicios_Casa".consejos IS 'Consejos para mejorar técnica y maximizar beneficios (generado por IA)';
COMMENT ON COLUMN app."Ejercicios_Casa".errores_evitar IS 'Errores comunes a evitar (generado por IA)';

-- ===============================================================================
-- 4. EJERCICIOS_CROSSFIT
-- ===============================================================================
ALTER TABLE app."Ejercicios_CrossFit"
  ADD COLUMN IF NOT EXISTS ejecucion TEXT,
  ADD COLUMN IF NOT EXISTS consejos TEXT,
  ADD COLUMN IF NOT EXISTS errores_evitar TEXT;

COMMENT ON COLUMN app."Ejercicios_CrossFit".ejecucion IS 'Explicación paso a paso de cómo ejecutar el ejercicio (generado por IA)';
COMMENT ON COLUMN app."Ejercicios_CrossFit".consejos IS 'Consejos para mejorar técnica y maximizar beneficios (generado por IA)';
COMMENT ON COLUMN app."Ejercicios_CrossFit".errores_evitar IS 'Errores comunes a evitar (generado por IA)';

-- ===============================================================================
-- 5. EJERCICIOS_FUNCIONAL
-- ===============================================================================
ALTER TABLE app."Ejercicios_Funcional"
  ADD COLUMN IF NOT EXISTS ejecucion TEXT,
  ADD COLUMN IF NOT EXISTS consejos TEXT,
  ADD COLUMN IF NOT EXISTS errores_evitar TEXT;

COMMENT ON COLUMN app."Ejercicios_Funcional".ejecucion IS 'Explicación paso a paso de cómo ejecutar el ejercicio (generado por IA)';
COMMENT ON COLUMN app."Ejercicios_Funcional".consejos IS 'Consejos para mejorar técnica y maximizar beneficios (generado por IA)';
COMMENT ON COLUMN app."Ejercicios_Funcional".errores_evitar IS 'Errores comunes a evitar (generado por IA)';

-- ===============================================================================
-- 6. EJERCICIOS_GUARDIA_CIVIL
-- ===============================================================================
ALTER TABLE app."Ejercicios_Guardia_Civil"
  ADD COLUMN IF NOT EXISTS ejecucion TEXT,
  ADD COLUMN IF NOT EXISTS consejos TEXT,
  ADD COLUMN IF NOT EXISTS errores_evitar TEXT;

COMMENT ON COLUMN app."Ejercicios_Guardia_Civil".ejecucion IS 'Explicación paso a paso de cómo ejecutar el ejercicio (generado por IA)';
COMMENT ON COLUMN app."Ejercicios_Guardia_Civil".consejos IS 'Consejos para mejorar técnica y maximizar beneficios (generado por IA)';
COMMENT ON COLUMN app."Ejercicios_Guardia_Civil".errores_evitar IS 'Errores comunes a evitar (generado por IA)';

-- ===============================================================================
-- 7. EJERCICIOS_HALTEROFILIA
-- ===============================================================================
ALTER TABLE app."Ejercicios_Halterofilia"
  ADD COLUMN IF NOT EXISTS ejecucion TEXT,
  ADD COLUMN IF NOT EXISTS consejos TEXT,
  ADD COLUMN IF NOT EXISTS errores_evitar TEXT;

COMMENT ON COLUMN app."Ejercicios_Halterofilia".ejecucion IS 'Explicación paso a paso de cómo ejecutar el ejercicio (generado por IA)';
COMMENT ON COLUMN app."Ejercicios_Halterofilia".consejos IS 'Consejos para mejorar técnica y maximizar beneficios (generado por IA)';
COMMENT ON COLUMN app."Ejercicios_Halterofilia".errores_evitar IS 'Errores comunes a evitar (generado por IA)';

-- ===============================================================================
-- 8. EJERCICIOS_HEAVY_DUTY
-- ===============================================================================
ALTER TABLE app."Ejercicios_Heavy_duty"
  ADD COLUMN IF NOT EXISTS ejecucion TEXT,
  ADD COLUMN IF NOT EXISTS consejos TEXT,
  ADD COLUMN IF NOT EXISTS errores_evitar TEXT;

COMMENT ON COLUMN app."Ejercicios_Heavy_duty".ejecucion IS 'Explicación paso a paso de cómo ejecutar el ejercicio (generado por IA)';
COMMENT ON COLUMN app."Ejercicios_Heavy_duty".consejos IS 'Consejos para mejorar técnica y maximizar beneficios (generado por IA)';
COMMENT ON COLUMN app."Ejercicios_Heavy_duty".errores_evitar IS 'Errores comunes a evitar (generado por IA)';

-- ===============================================================================
-- 9. EJERCICIOS_HIPERTROFIA
-- ===============================================================================
ALTER TABLE app."Ejercicios_Hipertrofia"
  ADD COLUMN IF NOT EXISTS ejecucion TEXT,
  ADD COLUMN IF NOT EXISTS consejos TEXT,
  ADD COLUMN IF NOT EXISTS errores_evitar TEXT;

COMMENT ON COLUMN app."Ejercicios_Hipertrofia".ejecucion IS 'Explicación paso a paso de cómo ejecutar el ejercicio (generado por IA)';
COMMENT ON COLUMN app."Ejercicios_Hipertrofia".consejos IS 'Consejos para mejorar técnica y maximizar beneficios (generado por IA)';
COMMENT ON COLUMN app."Ejercicios_Hipertrofia".errores_evitar IS 'Errores comunes a evitar (generado por IA)';

-- ===============================================================================
-- 10. EJERCICIOS_POLICIA_LOCAL
-- ===============================================================================
ALTER TABLE app."Ejercicios_Policia_Local"
  ADD COLUMN IF NOT EXISTS ejecucion TEXT,
  ADD COLUMN IF NOT EXISTS consejos TEXT,
  ADD COLUMN IF NOT EXISTS errores_evitar TEXT;

COMMENT ON COLUMN app."Ejercicios_Policia_Local".ejecucion IS 'Explicación paso a paso de cómo ejecutar el ejercicio (generado por IA)';
COMMENT ON COLUMN app."Ejercicios_Policia_Local".consejos IS 'Consejos para mejorar técnica y maximizar beneficios (generado por IA)';
COMMENT ON COLUMN app."Ejercicios_Policia_Local".errores_evitar IS 'Errores comunes a evitar (generado por IA)';

-- ===============================================================================
-- 11. EJERCICIOS_POWERLIFTING
-- ===============================================================================
ALTER TABLE app."Ejercicios_Powerlifting"
  ADD COLUMN IF NOT EXISTS ejecucion TEXT,
  ADD COLUMN IF NOT EXISTS consejos TEXT,
  ADD COLUMN IF NOT EXISTS errores_evitar TEXT;

COMMENT ON COLUMN app."Ejercicios_Powerlifting".ejecucion IS 'Explicación paso a paso de cómo ejecutar el ejercicio (generado por IA)';
COMMENT ON COLUMN app."Ejercicios_Powerlifting".consejos IS 'Consejos para mejorar técnica y maximizar beneficios (generado por IA)';
COMMENT ON COLUMN app."Ejercicios_Powerlifting".errores_evitar IS 'Errores comunes a evitar (generado por IA)';

-- ===============================================================================
-- VERIFICACIÓN FINAL
-- ===============================================================================

-- Verificar que todas las columnas se añadieron correctamente
DO $$
DECLARE
  table_rec RECORD;
  column_count INT;
BEGIN
  FOR table_rec IN
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'app'
      AND table_name LIKE 'Ejercicios_%'
    ORDER BY table_name
  LOOP
    SELECT COUNT(*) INTO column_count
    FROM information_schema.columns
    WHERE table_schema = 'app'
      AND table_name = table_rec.table_name
      AND column_name IN ('ejecucion', 'consejos', 'errores_evitar');

    IF column_count = 3 THEN
      RAISE NOTICE '✅ %: OK (3/3 columnas)', table_rec.table_name;
    ELSE
      RAISE NOTICE '❌ %: FALLO (%/3 columnas)', table_rec.table_name, column_count;
    END IF;
  END LOOP;
END $$;

-- ===============================================================================
-- FIN DEL SCRIPT
-- ===============================================================================
