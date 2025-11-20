# Implementación Fase de Adaptación Hipertrofia V2 (Principiantes)

Este documento resume los cambios realizados para implementar la lógica de generación de rutinas de adaptación para principiantes, siguiendo las especificaciones del documento `Estructura Hipetrofia Principiantes.txt`.

## 1. Estructura Modular (Backend)

Se ha refactorizado la lógica de generación para que sea modular y escalable, separando la lógica de "Full Body" y "Half Body" en servicios independientes.

### Nuevos Archivos

- **`backend/services/hipertrofiaV2/adaptation/fullBodyGenerator.js`**
  - **Objetivo:** Generar rutinas para "Novato Absoluto".
  - **Lógica:**
    - Selecciona 8 ejercicios clave (Pecho, Espalda, Piernas x2, Hombro, Bíceps, Tríceps, Core).
    - Configura intensidad al 65-70% y RIR 3-4.
    - Estructura de Circuito.
    - **Calendario:** 3 días (L-X-V) o 4 días (L-M-J-V), excluyendo fines de semana.

- **`backend/services/hipertrofiaV2/adaptation/halfBodyGenerator.js`**
  - **Objetivo:** Generar rutinas para principiantes con experiencia previa.
  - **Lógica:**
    - Divide en Sesión A (Empuje + Extensión) y Sesión B (Tirón + Flexión).
    - Configura intensidad al 75-80% y RIR 2-3.
    - **Calendario:** 5 días (Lunes a Viernes), rotando A/B/A/B/A.
    - Excluye fines de semana.

### Archivos Modificados

- **`backend/routes/adaptationBlock.js`**
  - Se eliminó la lógica _hardcoded_ anterior.
  - Ahora actúa como orquestador: recibe la petición, decide qué generador usar (`fullBody` o `halfBody`) y guarda los resultados.
  - **Mejora en Calendario:** Se implementó una lógica estricta para alinear las sesiones con la semana actual (Lunes-Viernes), garantizando que no se programen entrenamientos en sábado o domingo.

## 2. Base de Datos (Supabase)

Se ha creado un esquema SQL completo para soportar el seguimiento detallado de esta fase.

### Archivo SQL

- **`backend/schema_adaptation.sql`** (Ejecutar en Supabase)

### Tablas Creadas

1.  **`app.adaptation_blocks`**: Registra el bloque actual (tipo, duración, estado).
2.  **`app.adaptation_criteria_tracking`**: Tabla crítica para la evaluación semanal. Guarda:
    - Adherencia (Sesiones completadas vs planeadas).
    - RIR Medio (Esfuerzo).
    - Flags de Técnica.
    - Progreso de Cargas.
3.  **`app.adaptation_technique_flags`**: Registro de incidencias técnicas.
4.  **`app.adaptation_progress_summary` (Vista)**: Vista simplificada para que el Frontend consulte el estado actual y si el usuario está listo para transicionar.
5.  **`app.transition_to_hypertrophy` (Función)**: Lógica encapsulada para cerrar el bloque de adaptación.

## 3. Flujo de Usuario

1.  **Evaluación:** El usuario es detectado como "Principiante" en `HipertrofiaV2ManualCard`.
2.  **Selección:** Elige (o se le asigna) Full Body o Half Body.
3.  **Generación:** El backend genera las sesiones y las agenda en `workout_schedule` (L-V).
4.  **Entrenamiento:** El usuario entrena y registra sus logs (`hypertrophy_set_logs`).
5.  **Evaluación Semanal:**
    - El sistema evalúa cada semana (`/api/adaptation/evaluate-week`).
    - Verifica: Adherencia >80%, RIR <4, Técnica OK.
6.  **Transición:**
    - Si completa las semanas requeridas y cumple criterios -> Modal de Transición.
    - El usuario avanza al plan D1-D5 "normal".

## 4. Notas Técnicas Adicionales

- **Exclusión de Fines de Semana:** La lógica de fechas calcula el "Lunes de la semana actual" y suma días (0 para Lunes, 4 para Viernes). Nunca asigna sábado (5) o domingo (6).
- **Tests:** Se creó un script de prueba (`test-adaptation-generation.js`) para verificar la generación correcta de ejercicios y parámetros, aunque la validación final se hizo manualmente por temas de entorno.
