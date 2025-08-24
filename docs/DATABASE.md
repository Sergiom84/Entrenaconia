# 📊 Esquema de Base de Datos - Entrenaconia

## 📋 Índice
- [Visión General](#visión-general)
- [Tablas Principales](#tablas-principales)
- [Relaciones](#relaciones)
- [Índices y Optimización](#índices-y-optimización)
- [Procedimientos y Funciones](#procedimientos-y-funciones)
- [Seguridad](#seguridad)

## 🎯 Visión General

La base de datos de Entrenaconia está construida sobre PostgreSQL mediante Supabase, aprovechando características avanzadas como JSONB para datos flexibles, RLS para seguridad a nivel de fila, y funciones para lógica de negocio.

### Diagrama ERD Simplificado

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   auth.    │1   n│   profiles   │1   n│ training_plans  │
│   users    ├─────┤              ├─────┤                 │
└─────────────┘     └──────────────┘     └─────────────────┘
                           │                      │
                           │1                     │1
                           │                      │
                           │n                     │n
                    ┌──────────────┐     ┌─────────────────┐
                    │   progress   │     │training_sessions│
                    │              │     │                 │
                    └──────────────┘     └─────────────────┘
                           │
                           │1
                           │
                           │n
                    ┌──────────────┐
                    │nutrition_plans│
                    │              │
                    └──────────────┘
```

## 📊 Tablas Principales

### 1. Tabla `profiles` (Perfiles de Usuario)

```sql
CREATE TABLE public.profiles (
    -- Identificadores
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    
    -- Información Personal
    full_name TEXT,
    date_of_birth DATE,
    age INTEGER GENERATED ALWAYS AS (DATE_PART('year', AGE(date_of_birth))::INTEGER) STORED,
    gender TEXT CHECK (gender IN ('male', 'female', 'other', 'prefer_not_say')),
    phone_number TEXT,
    country TEXT,
    city TEXT,
    timezone TEXT DEFAULT 'UTC',
    
    -- Medidas Físicas
    height DECIMAL(5,2) CHECK (height > 0 AND height < 300), -- cm
    weight DECIMAL(5,2) CHECK (weight > 0 AND weight < 500), -- kg
    body_fat_percentage DECIMAL(4,2) CHECK (body_fat_percentage >= 0 AND body_fat_percentage <= 100),
    muscular_mass DECIMAL(5,2) CHECK (muscular_mass > 0),
    bmi DECIMAL(4,2) GENERATED ALWAYS AS (weight / POWER(height/100, 2)) STORED,
    
    -- Nivel de Fitness
    fitness_level TEXT CHECK (fitness_level IN ('sedentary', 'beginner', 'intermediate', 'advanced', 'athlete', 'elite')),
    training_experience INTEGER DEFAULT 0, -- meses
    training_frequency INTEGER CHECK (training_frequency >= 0 AND training_frequency <= 7), -- días/semana
    preferred_training_time TEXT CHECK (preferred_training_time IN ('morning', 'afternoon', 'evening', 'night', 'flexible')),
    available_time_per_session INTEGER, -- minutos
    
    -- Objetivos
    primary_goal TEXT CHECK (primary_goal IN (
        'weight_loss', 
        'muscle_gain', 
        'strength', 
        'endurance', 
        'athletic_performance', 
        'health_maintenance',
        'rehabilitation',
        'body_recomposition'
    )),
    secondary_goals TEXT[],
    goal_timeline TEXT CHECK (goal_timeline IN ('1_month', '3_months', '6_months', '1_year', 'ongoing')),
    motivation_level INTEGER CHECK (motivation_level >= 1 AND motivation_level <= 10),
    
    -- Información Médica
    injuries JSONB DEFAULT '[]'::JSONB,
    /* Estructura de injuries:
    [
        {
            "type": "knee_injury",
            "description": "ACL tear",
            "date": "2023-01-15",
            "status": "recovered",
            "limitations": ["no_jumping", "careful_with_squats"]
        }
    ]
