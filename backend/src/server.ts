import { app } from './app';
import { env } from './config/env';
import { sequelize } from './models/index';
import { migrator } from './db/migrator';

const PORT = env.port;

// Database connection and server start
const startServer = async () => {
  try {
    // Test the database connection
    await sequelize.authenticate();
    console.log('Database connection has been established successfully.');

    // Le schema est pilote par les migrations (src/migrations), jamais par
    // sequelize.sync() : sync() ne sait pas faire evoluer une base contenant
    // deja des inscriptions reelles.
    const executed = await migrator.up();
    console.log(
      executed.length > 0
        ? `Applied ${executed.length} migration(s): ${executed.map((m) => m.name).join(', ')}`
        : 'Database schema is up to date.'
    );

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Unable to connect to the database:', error);
    process.exit(1);
  }
};

startServer();

export default app;
