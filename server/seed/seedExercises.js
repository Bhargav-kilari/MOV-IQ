import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'fitness_app',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '1234',
});

const DATASET_URL = 'https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/data/exercises.json';
const LOCAL_JSON_PATH = path.join(__dirname, 'exercises.json');

const capitalizeWords = (str) => {
  if (!str) return '';
  return str
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
};

async function ensureTableSchema(client) {
  console.log('🔧 Verifying and updating exercises table schema in PostgreSQL...');

  await client.query(`
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    CREATE TABLE IF NOT EXISTS exercises (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name VARCHAR(255) NOT NULL
    );

    ALTER TABLE exercises ADD COLUMN IF NOT EXISTS external_id VARCHAR(100);
    ALTER TABLE exercises ADD COLUMN IF NOT EXISTS category VARCHAR(100);
    ALTER TABLE exercises ADD COLUMN IF NOT EXISTS body_part VARCHAR(100);
    ALTER TABLE exercises ADD COLUMN IF NOT EXISTS equipment VARCHAR(100) DEFAULT 'body weight';
    ALTER TABLE exercises ADD COLUMN IF NOT EXISTS target_muscle VARCHAR(100);
    ALTER TABLE exercises ADD COLUMN IF NOT EXISTS secondary_muscles TEXT[] DEFAULT '{}';
    ALTER TABLE exercises ADD COLUMN IF NOT EXISTS instructions TEXT[] DEFAULT '{}';
    ALTER TABLE exercises ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
    ALTER TABLE exercises ADD COLUMN IF NOT EXISTS animation_url TEXT;
    ALTER TABLE exercises ADD COLUMN IF NOT EXISTS media_attribution VARCHAR(255) DEFAULT '© Gym visual — https://gymvisual.com/';
    ALTER TABLE exercises ADD COLUMN IF NOT EXISTS difficulty VARCHAR(50) DEFAULT 'Beginner';
    ALTER TABLE exercises ADD COLUMN IF NOT EXISTS exercise_type VARCHAR(50) DEFAULT 'Weight & Reps';
    ALTER TABLE exercises ADD COLUMN IF NOT EXISTS is_custom BOOLEAN DEFAULT FALSE;
    ALTER TABLE exercises ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
    ALTER TABLE exercises ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
    ALTER TABLE exercises ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
  `);

  // Ensure unique constraint on external_id
  await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'exercises_external_id_key'
      ) THEN
        ALTER TABLE exercises ADD CONSTRAINT exercises_external_id_key UNIQUE (external_id);
      END IF;
    END $$;
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_exercises_name ON exercises(name);
    CREATE INDEX IF NOT EXISTS idx_exercises_category ON exercises(category);
    CREATE INDEX IF NOT EXISTS idx_exercises_body_part ON exercises(body_part);
    CREATE INDEX IF NOT EXISTS idx_exercises_equipment ON exercises(equipment);
    CREATE INDEX IF NOT EXISTS idx_exercises_target_muscle ON exercises(target_muscle);
    CREATE INDEX IF NOT EXISTS idx_exercises_user_id ON exercises(user_id);
    CREATE INDEX IF NOT EXISTS idx_exercises_is_custom ON exercises(is_custom);
    CREATE INDEX IF NOT EXISTS idx_exercises_external_id ON exercises(external_id);
  `);
}

async function loadDataset() {
  if (fs.existsSync(LOCAL_JSON_PATH)) {
    console.log(`📁 Loading dataset from local cache: ${LOCAL_JSON_PATH}`);
    const raw = fs.readFileSync(LOCAL_JSON_PATH, 'utf8');
    return JSON.parse(raw);
  }

  console.log(`🌐 Fetching complete 1,324 exercise dataset from ${DATASET_URL}...`);
  const response = await fetch(DATASET_URL);
  if (!response.ok) {
    throw new Error(`Failed to download dataset: HTTP ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  fs.writeFileSync(LOCAL_JSON_PATH, JSON.stringify(data, null, 2));
  console.log(`💾 Saved ${data.length} records to local cache: ${LOCAL_JSON_PATH}`);
  return data;
}

export async function seedExercises() {
  console.log('🚀 Starting Master Exercise Library Import & Seed...');

  const client = await pool.connect();

  let stats = {
    totalRecords: 0,
    imported: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
  };

  try {
    await ensureTableSchema(client);
    const rawExercises = await loadDataset();
    stats.totalRecords = rawExercises.length;
    console.log(`📊 Processing ${rawExercises.length} raw exercises...`);

    const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main';

    for (const item of rawExercises) {
      try {
        if (!item || !item.id) {
          stats.skipped++;
          continue;
        }

        const externalId = String(item.id);

        // Normalize English Name
        let name = '';
        if (item.name && typeof item.name === 'object') {
          name = item.name.en || item.name.es || Object.values(item.name)[0] || '';
        } else if (typeof item.name === 'string') {
          name = item.name;
        }

        if (!name || name.trim() === '') {
          stats.skipped++;
          continue;
        }
        name = capitalizeWords(name.trim());

        const bodyPart = item.body_part ? item.body_part.toLowerCase().trim() : 'other';
        const equipment = item.equipment ? item.equipment.toLowerCase().trim() : 'body weight';
        const targetMuscle = item.target ? item.target.toLowerCase().trim() : bodyPart;
        const category = item.category ? item.category.toLowerCase().trim() : bodyPart;

        // Secondary muscles array
        let secondaryMuscles = [];
        if (Array.isArray(item.secondary_muscles)) {
          secondaryMuscles = item.secondary_muscles.map((m) => m.toLowerCase().trim()).filter(Boolean);
        }

        // Instructions steps (English)
        let instructions = [];
        if (item.instruction_steps && item.instruction_steps.en && Array.isArray(item.instruction_steps.en)) {
          instructions = item.instruction_steps.en;
        } else if (item.instructions && item.instructions.en) {
          instructions = [item.instructions.en];
        } else if (Array.isArray(item.instructions)) {
          instructions = item.instructions;
        }

        // Media URLs (Preserving Gym Visual attribution)
        let thumbnailUrl = null;
        if (item.image) {
          const cleanImg = item.image.replace(/^\/+/, '');
          thumbnailUrl = cleanImg.startsWith('http')
            ? cleanImg
            : `${GITHUB_RAW_BASE}/${cleanImg}`;
        }

        let animationUrl = null;
        if (item.gif_url) {
          const cleanGif = item.gif_url.replace(/^\/+/, '');
          animationUrl = cleanGif.startsWith('http')
            ? cleanGif
            : `${GITHUB_RAW_BASE}/${cleanGif}`;
        }

        const attribution = item.attribution || '© Gym visual — https://gymvisual.com/';

        // Difficulty heuristic based on equipment
        let difficulty = 'Beginner';
        if (['barbell', 'olympic barbell', 'leverage machine', 'smith machine'].includes(equipment)) {
          difficulty = 'Intermediate';
        }
        if (
          name.toLowerCase().includes('clean and jerk') ||
          name.toLowerCase().includes('snatch') ||
          name.toLowerCase().includes('deadlift')
        ) {
          difficulty = 'Advanced';
        }

        // Execute Idempotent Upsert
        const res = await client.query(
          `INSERT INTO exercises (
            external_id, name, category, body_part, equipment,
            target_muscle, secondary_muscles, instructions,
            thumbnail_url, animation_url, media_attribution,
            difficulty, exercise_type, is_custom, user_id, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NULL, CURRENT_TIMESTAMP
          )
          ON CONFLICT (external_id) DO UPDATE SET
            name = EXCLUDED.name,
            category = EXCLUDED.category,
            body_part = EXCLUDED.body_part,
            equipment = EXCLUDED.equipment,
            target_muscle = EXCLUDED.target_muscle,
            secondary_muscles = EXCLUDED.secondary_muscles,
            instructions = EXCLUDED.instructions,
            thumbnail_url = EXCLUDED.thumbnail_url,
            animation_url = EXCLUDED.animation_url,
            media_attribution = EXCLUDED.media_attribution,
            difficulty = EXCLUDED.difficulty,
            updated_at = CURRENT_TIMESTAMP
          RETURNING (xmax = 0) AS is_inserted;`,
          [
            externalId,
            name,
            category,
            bodyPart,
            equipment,
            targetMuscle,
            secondaryMuscles,
            instructions,
            thumbnailUrl,
            animationUrl,
            attribution,
            difficulty,
            'Weight & Reps',
            false,
          ]
        );

        if (res.rows[0].is_inserted) {
          stats.imported++;
        } else {
          stats.updated++;
        }
      } catch (err) {
        console.error(`❌ Error importing exercise ${item?.id || 'unknown'}:`, err.message);
        stats.failed++;
      }
    }

    // Verify database total
    const countRes = await client.query('SELECT COUNT(*)::int as total FROM exercises;');
    const globalCountRes = await client.query('SELECT COUNT(*)::int as globals FROM exercises WHERE is_custom = false;');
    const customCountRes = await client.query('SELECT COUNT(*)::int as customs FROM exercises WHERE is_custom = true;');

    console.log('\n========================================');
    console.log('🎉 MASTER EXERCISE IMPORT REPORT:');
    console.log('========================================');
    console.log(`📥 Total Source Records Processed: ${stats.totalRecords}`);
    console.log(`✅ Newly Inserted:              ${stats.imported}`);
    console.log(`🔄 Updated / Re-verified:         ${stats.updated}`);
    console.log(`⏭️ Skipped (invalid):             ${stats.skipped}`);
    console.log(`❌ Failed:                         ${stats.failed}`);
    console.log('----------------------------------------');
    console.log(`🏋️ Total Global Catalog Exercises: ${globalCountRes.rows[0].globals}`);
    console.log(`👤 Total Custom User Exercises:    ${customCountRes.rows[0].customs}`);
    console.log(`📚 Total Database Exercise Count:  ${countRes.rows[0].total}`);
    console.log('========================================\n');
  } catch (err) {
    console.error('Fatal error during exercise seeding:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seedExercises();
}
