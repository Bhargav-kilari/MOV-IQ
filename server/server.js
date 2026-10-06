import app from './app.js';
import pool from './config/db.js';

const PORT = process.env.PORT || 5000;

// Test DB Connection before starting listening
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Failed to connect to PostgreSQL database:', err.message);
    process.exit(1);
  }
  
  console.log('✅ PostgreSQL connected successfully at:', res.rows[0].now);

  const server = app.listen(PORT, () => {
    console.log(`🚀 Fitness App API Server running on port ${PORT}`);
    console.log(`📡 Health check available at: http://localhost:${PORT}/api/health`);
  });

  // Graceful shutdown handling
  const shutdown = async () => {
    console.log('Shutting down server gracefully...');
    server.close(async () => {
      console.log('HTTP server closed.');
      await pool.end();
      console.log('PostgreSQL pool closed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
});
