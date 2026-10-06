import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '1234',
  database: process.env.DB_NAME || 'fitness_app',
});

async function testStreak() {
  const users = await pool.query('SELECT id, name, email FROM users');

  for (const user of users.rows) {
    // 1. Get distinct workout dates
    const datesRes = await pool.query(
      `SELECT DISTINCT DATE(w.completed_at)::text as workout_date
       FROM workouts w
       WHERE w.user_id = $1 AND w.completed_at IS NOT NULL
       ORDER BY workout_date DESC;`,
      [user.id]
    );

    const dates = datesRes.rows.map((r) => r.workout_date);

    // Calculate streak
    let streak = 0;
    if (dates.length > 0) {
      const today = new Date().toISOString().slice(0, 10);
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

      const mostRecent = dates[0];
      if (mostRecent === today || mostRecent === yesterday) {
        streak = 1;
        let prevDate = new Date(mostRecent);
        for (let i = 1; i < dates.length; i++) {
          prevDate.setDate(prevDate.getDate() - 1);
          const expected = prevDate.toISOString().slice(0, 10);
          if (dates[i] === expected) {
            streak++;
          } else {
            break;
          }
        }
      }
    }

    console.log(`User: ${user.name} (${user.email}) | Workout Dates: [${dates.join(', ')}] | Active Streak: ${streak} day(s)`);
  }

  await pool.end();
}

testStreak().catch(console.error);
