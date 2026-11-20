import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import swaggerUi from 'swagger-ui-express';
import { healthRouter } from './routes/health';
import { configRouter } from './routes/config';
import { categoriesRouter } from './routes/categories';
import { itemsRouter } from './routes/items';
import { campusesRouter } from './routes/campuses';
import { authRouter } from './routes/auth';
import { ordersRouter } from './routes/orders';
import { reviewsRouter } from './routes/reviews';
import { payoutsRouter } from './routes/payouts';
import { reportsRouter } from './routes/reports';
import { offersRouter } from './routes/offers';
import { adminRouter } from './routes/admin';
import { openApiSpec } from './docs/openapi';

export function createApp(): Express {
  const app = express();

  // Middleware
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN || '*',
      credentials: true,
    })
  );
  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ limit: '25mb', extended: true }));

  // Swagger API Documentation
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));

  // Routes
  app.use('/api/health', healthRouter);
  app.use('/api/config', configRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/categories', categoriesRouter);
  app.use('/api/items', itemsRouter);
  app.use('/api/campuses', campusesRouter);
  app.use('/api/orders', ordersRouter);
  app.use('/api/reviews', reviewsRouter);
  app.use('/api/payouts', payoutsRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api/offers', offersRouter);
  app.use('/api/admin', adminRouter);

  // API root info
  app.get('/api', (_req: Request, res: Response) => {
    res.json({
      name: 'Ocho API',
      status: 'online',
      description: 'Marketplace Mahasiswa Unpad - REST API Engine',
      docs: '/api/docs',
      health: '/api/health',
    });
  });

  // In standalone production (non-Vercel), serve the client's built static files
  if (process.env.NODE_ENV === 'production' && !process.env.VERCEL) {
    const clientDistPath = path.resolve(__dirname, '../../client/dist');
    if (fs.existsSync(clientDistPath)) {
      app.use(express.static(clientDistPath));

      // For any non-API route, serve index.html (SPA hash-based routing)
      app.get('*', (_req: Request, res: Response) => {
        res.sendFile(path.join(clientDistPath, 'index.html'));
      });
    }
  } else if (!process.env.VERCEL) {
    // Root welcome (dev only — Vite proxy handles client in dev)
    app.get('/', (_req: Request, res: Response) => {
      res.json({
        name: 'Ocho API',
        description: 'Marketplace Mahasiswa Unpad - REST API Engine',
        docs: '/api/docs',
        health: '/api/health',
      });
    });

    // 404 Not Found (dev only)
    app.use((_req: Request, res: Response) => {
      res.status(404).json({
        error: 'Not Found',
        message: 'Endpoint tidak ditemukan.',
      });
    });
  }

  // Global Error Handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[Server Error]', err);
    res.status(500).json({
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'production' ? 'Terjadi kesalahan pada server.' : err.message,
    });
  });

  return app;
}
