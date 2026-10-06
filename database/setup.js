import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from root or current dir
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { Client } = pg;

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '1234',
};

const targetDbName = process.env.DB_NAME || 'fitness_app';

async function setupDatabase() {
  console.log('🔄 Starting PostgreSQL database setup...');
  
  // 1. Connect to default 'postgres' database to check/create target database
  const adminClient = new Client({
    ...dbConfig,
    database: 'postgres',
  });

  try {
    await adminClient.connect();
    console.log('✅ Connected to PostgreSQL admin database.');

    const checkDbRes = await adminClient.query(
      `SELECT 1 FROM pg_database WHERE datname = $1;`,
      [targetDbName]
    );

    if (checkDbRes.rowCount === 0) {
      console.log(`📦 Database "${targetDbName}" does not exist. Creating now...`);
      await adminClient.query(`CREATE DATABASE "${targetDbName}";`);
      console.log(`✅ Database "${targetDbName}" created successfully.`);
    } else {
      console.log(`ℹ️ Database "${targetDbName}" already exists.`);
    }
  } catch (err) {
    console.error('❌ Error during database creation check:', err.message);
    process.exit(1);
  } finally {
    await adminClient.end();
  }

  // 2. Connect to the target database and execute migrations/seeds
  const appClient = new Client({
    ...dbConfig,
    database: targetDbName,
  });

  try {
    await appClient.connect();
    console.log(`✅ Connected to target database "${targetDbName}".`);

    // Run Schema
    const schemaPath = path.join(__dirname, 'schema', '01_init.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    console.log('📜 Applying database schema (01_init.sql)...');
    await appClient.query(schemaSql);
    console.log('✅ Database schema applied successfully.');

    // Run Seeds
    const seedPath = path.join(__dirname, 'seeds', '01_exercises.sql');
    const seedSql = fs.readFileSync(seedPath, 'utf8');
    console.log('🌱 Populating exercise seed data (01_exercises.sql)...');
    await appClient.query(seedSql);
    console.log('✅ Exercise seed data populated successfully.');

    // Verify tables and exercise count
    const tableRes = await appClient.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    console.log('📋 Verified database tables:', tableRes.rows.map(r => r.table_name).join(', '));

    const exerciseCount = await appClient.query('SELECT COUNT(*) FROM exercises;');
    console.log(`🏋️ Total exercises in database: ${exerciseCount.rows[0].count}`);

    console.log('🎉 Database setup completed successfully!');
  } catch (err) {
    console.error('❌ Error applying schema/seeds:', err.message);
    process.exit(1);
  } finally {
    await appClient.end();
  }
}

setupDatabase();
