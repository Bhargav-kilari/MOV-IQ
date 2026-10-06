import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '1234',
  database: process.env.DB_NAME || 'fitness_app',
});

async function inspect() {
  const users = await pool.query('SELECT id, name, email FROM users');
  console.log('--- USERS IN DB ---');
  console.table(users.rows);

  for (const user of users.rows) {
    console.log(`\n=== USER: ${user.name} (${user.email} - ${user.id}) ===`);
    
    const workouts = await pool.query(
      `SELECT id, name, started_at, completed_at, duration,
              EXTRACT(EPOCH FROM (completed_at - started_at)) as calculated_diff_sec
       FROM workouts
       WHERE user_id = $1
       ORDER BY started_at ASC`,
      [user.id]
    );
    console.log('Workouts:');
    console.table(workouts.rows);

    const stats = await pool.query(
      `SELECT 
         COUNT(DISTINCT w.id)::int as total_workouts,
         COALESCE(SUM(w.duration), 0)::int as total_seconds,
         COALESCE(SUM(ws.weight * ws.reps), 0)::numeric(12,2) as total_volume,
         COUNT(ws.id)::int as total_completed_sets
       FROM workouts w
       LEFT JOIN workout_exercises we ON w.id = we.workout_id
       LEFT JOIN workout_sets ws ON we.id = ws.workout_exercise_id AND ws.completed = true
       WHERE w.user_id = $1 AND w.completed_at IS NOT NULL`,
      [user.id]
    );
    console.log('Aggregated Stats:');
    console.table(stats.rows);

    const weekly = await pool.query(
      `SELECT 
         to_char(w.completed_at, 'YYYY-IW') as week_key,
         DATE_TRUNC('week', w.completed_at)::date as week_start,
         COUNT(DISTINCT w.id)::int as workout_count,
         COALESCE(SUM(ws.weight * ws.reps), 0)::numeric(10,2) as weekly_volume
       FROM workouts w
       LEFT JOIN workout_exercises we ON w.id = we.workout_id
       LEFT JOIN workout_sets ws ON we.id = ws.workout_exercise_id AND ws.completed = true
       WHERE w.user_id = $1 AND w.completed_at >= NOW() - INTERVAL '8 weeks'
       GROUP BY week_key, week_start
       ORDER BY week_start ASC`,
      [user.id]
    );
    console.log('Weekly Activity (COUNT DISTINCT):');
    console.table(weekly.rows);
  }

  await pool.end();
}

inspect().catch(err => {
  console.error('Error inspecting DB:', err);
  process.exit(1);
});
