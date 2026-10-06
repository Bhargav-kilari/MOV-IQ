import pool from '../server/config/db.js';

async function test() {
  for (const term of ['fly', 'row', 'pec', 'curl']) {
    const res = await pool.query(
      'SELECT name FROM exercises WHERE name ILIKE $1 ORDER BY LENGTH(name) ASC LIMIT 8',
      [`%${term}%`]
    );
    console.log(`=== ${term} ===`, res.rows.map(r => r.name));
  }
  await pool.end();
}

test();
