-- PostgreSQL Database Schema for Fitness App

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    profile_picture TEXT DEFAULT NULL,
    fitness_goal VARCHAR(100) DEFAULT 'General Fitness',
    experience_level VARCHAR(50) DEFAULT 'Beginner', -- Beginner, Intermediate, Advanced
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. EXERCISES TABLE (Master 1,324+ Library & Custom User Exercises)
CREATE TABLE IF NOT EXISTS exercises (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_id VARCHAR(100) UNIQUE,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    body_part VARCHAR(100),
    equipment VARCHAR(100) NOT NULL DEFAULT 'body weight',
    target_muscle VARCHAR(100),
    secondary_muscles TEXT[] NOT NULL DEFAULT '{}',
    instructions TEXT[] DEFAULT '{}',
    thumbnail_url TEXT DEFAULT NULL,
    animation_url TEXT DEFAULT NULL,
    media_attribution VARCHAR(255) DEFAULT '© Gym visual — https://gymvisual.com/',
    difficulty VARCHAR(50) NOT NULL DEFAULT 'Beginner',
    exercise_type VARCHAR(50) NOT NULL DEFAULT 'Weight & Reps',
    is_custom BOOLEAN DEFAULT FALSE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. ROUTINES TABLE
CREATE TABLE IF NOT EXISTS routines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 4. ROUTINE_EXERCISES TABLE
CREATE TABLE IF NOT EXISTS routine_exercises (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    routine_id UUID NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
    exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE RESTRICT,
    order_index INT NOT NULL DEFAULT 0,
    target_sets INT NOT NULL DEFAULT 3,
    target_reps INT NOT NULL DEFAULT 10,
    target_weight NUMERIC(6, 2) DEFAULT 0.00,
    rest_seconds INT NOT NULL DEFAULT 90,
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 5. WORKOUTS TABLE
CREATE TABLE IF NOT EXISTS workouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    routine_id UUID REFERENCES routines(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ DEFAULT NULL,
    duration INT DEFAULT 0, -- Duration in seconds
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 6. WORKOUT_EXERCISES TABLE
CREATE TABLE IF NOT EXISTS workout_exercises (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workout_id UUID NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
    exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE RESTRICT,
    order_index INT NOT NULL DEFAULT 0,
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 7. WORKOUT_SETS TABLE
CREATE TABLE IF NOT EXISTS workout_sets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workout_exercise_id UUID NOT NULL REFERENCES workout_exercises(id) ON DELETE CASCADE,
    set_number INT NOT NULL,
    weight NUMERIC(6, 2) DEFAULT 0.00,
    reps INT DEFAULT 0,
    duration INT DEFAULT 0, -- In seconds for timed exercises
    completed BOOLEAN DEFAULT FALSE,
    rpe NUMERIC(3, 1) DEFAULT NULL, -- Rating of Perceived Exertion (1.0 to 10.0)
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 8. FUTURE_AI_ANALYSIS TABLE (Architectural space for future AI analysis)
CREATE TABLE IF NOT EXISTS future_ai_analysis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    exercise_id UUID REFERENCES exercises(id) ON DELETE SET NULL,
    workout_id UUID REFERENCES workouts(id) ON DELETE SET NULL,
    analysis_type VARCHAR(100) NOT NULL, -- e.g. 'pose_tracking', 'rep_count', 'form_critique'
    reps INT DEFAULT 0,
    form_score NUMERIC(5, 2) DEFAULT NULL, -- Score out of 100
    mistakes TEXT[] DEFAULT '{}',
    feedback TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for high-performance querying
CREATE INDEX IF NOT EXISTS idx_exercises_name ON exercises(name);
CREATE INDEX IF NOT EXISTS idx_exercises_category ON exercises(category);
CREATE INDEX IF NOT EXISTS idx_exercises_body_part ON exercises(body_part);
CREATE INDEX IF NOT EXISTS idx_exercises_equipment ON exercises(equipment);
CREATE INDEX IF NOT EXISTS idx_exercises_target_muscle ON exercises(target_muscle);
CREATE INDEX IF NOT EXISTS idx_exercises_user_id ON exercises(user_id);
CREATE INDEX IF NOT EXISTS idx_exercises_is_custom ON exercises(is_custom);
CREATE INDEX IF NOT EXISTS idx_exercises_external_id ON exercises(external_id);

CREATE INDEX IF NOT EXISTS idx_routines_user_id ON routines(user_id);
CREATE INDEX IF NOT EXISTS idx_routine_exercises_routine_id ON routine_exercises(routine_id);
CREATE INDEX IF NOT EXISTS idx_workouts_user_id ON workouts(user_id);
CREATE INDEX IF NOT EXISTS idx_workouts_completed_at ON workouts(completed_at);
CREATE INDEX IF NOT EXISTS idx_workout_exercises_workout_id ON workout_exercises(workout_id);
CREATE INDEX IF NOT EXISTS idx_workout_sets_exercise_id ON workout_sets(workout_exercise_id);
