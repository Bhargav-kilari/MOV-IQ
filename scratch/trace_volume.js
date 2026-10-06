import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '1234',
  database: process.env.DB_NAME || 'fitness_app',
});

async function traceVolume() {
  console.log('=== TRACING 2,400 KG VOLUME IN POSTGRESQL ===\n');

  const userRes = await pool.query(
    `SELECT id, name, email FROM users WHERE email = 'kilaribhargavkrish123@gmail.com' OR name = 'k bhargav'`
  );
  if (userRes.rowCount === 0) {
    console.log('User not found by email, listing all users:');
    const allUsers = await pool.query('SELECT id, name, email FROM users');
    console.table(allUsers.rows);
    await pool.end();
    return;
  }

  const user = userRes.rows[0];
  console.log(`User Found: ${user.name} (${user.id})\n`);

  // Query all workouts and their individual sets
  const workoutsRes = await pool.query(
    `SELECT w.id, w.name, w.started_at, w.completed_at, w.duration
     FROM workouts w
     WHERE w.user_id = $1
     ORDER BY w.completed_at ASC`,
    [user.id]
  );

  console.log(`Total workouts found for user: ${workoutsRes.rows.length}\n`);

  let grandTotalVolume = 0;
  let totalSetsCount = 0;
  let completedSetsCount = 0;

  for (let i = 0; i < workoutsRes.rows.length; i++) {
    const w = workoutsRes.rows[i];
    console.log(`-------------------------------------------------------------------`);
    console.log(`Workout #${i + 1}: "${w.name}" (ID: ${w.id})`);
    console.log(`Started: ${w.started_at} | Completed: ${w.completed_at} | Duration: ${w.duration}s`);

    const exercisesRes = await pool.query(
      `SELECT we.id as workout_exercise_id, we.order_index,
              e.id as exercise_id, e.name as exercise_name, e.category, e.body_part, e.equipment, e.target_muscle, e.exercise_type
       FROM workout_exercises we
       JOIN exercises e ON we.exercise_id = e.id
       WHERE we.workout_id = $1
       ORDER BY we.order_index ASC`,
      [w.id]
    );

    let workoutVolume = 0;

    for (const ex of exercisesRes.rows) {
      console.log(`  Exercise: "${ex.exercise_name}" | Equipment: ${ex.equipment} | Body Part: ${ex.body_part} | Target: ${ex.target_muscle} | Type: ${ex.exercise_type}`);

      const setsRes = await pool.query(
        `SELECT id, set_number, weight, reps, duration, completed, rpe
         FROM workout_sets
         WHERE workout_exercise_id = $1
         ORDER BY set_number ASC`,
        [ex.workout_exercise_id]
      );

      for (const set of setsRes.rows) {
        totalSetsCount++;
        const setVol = set.completed ? Number(set.weight) * Number(set.reps) : 0;
        if (set.completed) {
          completedSetsCount++;
          workoutVolume += setVol;
          grandTotalVolume += setVol;
        }
        console.log(`    Set #${set.set_number}: weight=${set.weight} kg, reps=${set.reps}, completed=${set.completed} => set_volume=${setVol} kg`);
      }
    }
    console.log(`  >> Workout #${i + 1} Calculated Total Volume: ${workoutVolume} kg\n`);
  }

  console.log(`===================================================================`);
  console.log(`GRAND TOTALS FROM DETAILED SETS:`);
  console.log(`Total Completed Sets: ${completedSetsCount} / ${totalSetsCount}`);
  console.log(`Grand Total Volume: ${grandTotalVolume} kg`);

  await pool.end();
}

traceVolume().catch(console.error);
