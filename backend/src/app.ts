import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import userRoutes from './routes/userRoutes';
import groupRoutes from './routes/groupRoutes';
import eventRoutes from './routes/eventRoutes';
import authRoutes from './routes/authRoutes';
import reportRoutes from './routes/reportRoutes';
import notificationRoutes from './routes/notificationRoutes';
import adminRoutes from './routes/adminRoutes';
import { authLimiter } from './middleware/rateLimit';

/**
 * L'application Express, sans ecoute reseau ni connexion base.
 *
 * Ce decoupage existe pour les tests : supertest a besoin de l'app seule, or
 * importer server.ts declencherait migrations et app.listen().
 */
export const app: Express = express();

// Middleware
app.use(helmet());
app.use(cors());
if (env.nodeEnv !== 'test') {
  app.use(morgan('dev'));
}
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
// S-05 : la limite de debit se pose AVANT le routeur, pour couvrir login,
// register et refresh d'un seul tenant.
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req: Request, res: Response, next: NextFunction) => {
  res.status(404).json({ message: 'Route not found' });
});

// Error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  // Silencieux en test pour ne pas noyer la sortie de jest, sauf demande
  // explicite : LOG_ERRORS=1 npx jest
  if (env.nodeEnv !== 'test' || process.env.LOG_ERRORS) {
    console.error(err.stack);
  }
  res.status(500).json({ message: 'Something went wrong!' });
});

export default app;
