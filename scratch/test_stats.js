import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '1234',
  database: process.env.DB_NAME || 'fitness_app',
});

async function testCalculations() {
  console.log('--- TESTING NEW SQL QUERIES ---');

  const users = await pool.query('SELECT id, name, email FROM users LIMIT 5');
  if (users.rowCount === 0) {
    console.log('No users found.');
    await pool.end();
    return;
  }

  for (const user of users.rows) {
    console.log(`\nTesting user: ${user.name} (${user.id})`);

    // 1. Overall Summary
    const summaryRes = await pool.query(
      `SELECT 
         COUNT(*)::int AS total_workouts,
         COALESCE(SUM(COALESCE(NULLIF(duration, 0), EXTRACT(EPOCH FROM (completed_at - started_at))::int, 0)), 0)::int AS total_seconds
       FROM workouts
       WHERE user_id = $1 AND completed_at IS NOT NULL;`,
      [user.id]
    );

    const volumeRes = await pool.query(
      `SELECT 
         COALESCE(SUM(ws.weight * ws.reps), 0)::numeric(12, 2) AS total_volume_kg,
         COUNT(ws.id)::int AS total_completed_sets,
         COALESCE(SUM(ws.reps), 0)::int AS total_reps
       FROM workouts w
       JOIN workout_exercises we ON w.id = we.workout_id
       JOIN workout_sets ws ON we.id = ws.workout_exercise_id
       WHERE w.user_id = $1 AND w.completed_at IS NOT NULL AND ws.completed = true;`,
      [user.id]
    );

    const totalWorkouts = summaryRes.rows[0]?.total_workouts || 0;
    const totalSeconds = summaryRes.rows[0]?.total_seconds || 0;
    const totalMinutes = Math.round(totalSeconds / 60);
    const totalVolumeKg = parseFloat(volumeRes.rows[0]?.total_volume_kg || 0);
    const totalCompletedSets = volumeRes.rows[0]?.total_completed_sets || 0;

    console.log('Summary:', {
      totalWorkouts,
      totalSeconds,
      totalMinutes,
      totalVolumeKg,
      totalCompletedSets,
    });

    // 2. Exactly 8 Weekly Buckets
    const weeklyRes = await pool.query(
      `WITH weeks AS (
         SELECT generate_series(
           DATE_TRUNC('week', CURRENT_DATE - INTERVAL '7 weeks'),
           DATE_TRUNC('week', CURRENT_DATE),
           INTERVAL '1 week'
         )::date AS week_start
       ),
       user_workouts AS (
         SELECT 
           DATE_TRUNC('week', w.completed_at)::date AS week_start,
           w.id AS workout_id,
           COALESCE(SUM(ws.weight * ws.reps), 0) AS workout_volume
         FROM workouts w
         LEFT JOIN workout_exercises we ON w.id = we.workout_id
         LEFT JOIN workout_sets ws ON we.id = ws.workout_exercise_id AND ws.completed = true
         WHERE w.user_id = $1 AND w.completed_at IS NOT NULL
           AND w.completed_at >= DATE_TRUNC('week', CURRENT_DATE - INTERVAL '7 weeks')
         GROUP BY week_start, w.id
       )
       SELECT 
         w.week_start,
         to_char(w.week_start, 'YYYY-"W"IW') AS week_key,
         to_char(w.week_start, 'Mon DD') AS label,
         COUNT(uw.workout_id)::int AS workout_count,
         COALESCE(SUM(uw.workout_volume), 0)::numeric(12,2) AS weekly_volume
       FROM weeks w
       LEFT JOIN user_workouts uw ON w.week_start = uw.week_start
       GROUP BY w.week_start
       ORDER BY w.week_start ASC;`,
      [user.id]
    );

    console.log(`Weekly Buckets count: ${weeklyRes.rows.length} (Expected: 8)`);
    console.table(weeklyRes.rows);

    const sumWeeklyWorkouts = weeklyRes.rows.reduce((acc, row) => acc + row.workout_count, 0);
    console.log(`Sum of weekly workouts in 8-week chart: ${sumWeeklyWorkouts}`);
    
    // 3. Workouts List
    const workoutsListRes = await pool.query(
      `SELECT w.id, w.name, w.started_at, w.completed_at,
              COALESCE(NULLIF(w.duration, 0), EXTRACT(EPOCH FROM (w.completed_at - w.started_at))::int, 0)::int AS duration,
              COUNT(DISTINCT we.id)::int AS exercise_count,
              COALESCE(SUM(ws.weight * ws.reps), 0)::numeric(12,2) AS total_volume,
              COUNT(ws.id)::int AS completed_sets
       FROM workouts w
       LEFT JOIN workout_exercises we ON w.id = we.workout_id
       LEFT JOIN workout_sets ws ON we.id = ws.workout_exercise_id AND ws.completed = true
       WHERE w.user_id = $1 AND w.completed_at IS NOT NULL
       GROUP BY w.id
       ORDER BY w.completed_at DESC;`,
      [user.id]
    );
    console.log('Workouts in History:');
    console.table(workoutsListRes.rows);
  }

  await pool.end();
}

testCalculations().catch(err => {
  console.error(err);
  process.exit(1);
});
