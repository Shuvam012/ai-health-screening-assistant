import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import callRoutes from './routes/call.routes';
import reportRoutes from './routes/report.routes';
import { errorHandler } from './middleware/error.middleware';

const app = express();

// ─── Middleware ──────────────────────────────────────────────────────────────

app.use(cors({
  origin: env.CORS_ORIGIN,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Health Check ────────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'ai-health-screening-server',
  });
});

// ─── Routes ──────────────────────────────────────────────────────────────────

app.use('/api/calls', callRoutes);
app.use('/api/calls', reportRoutes);

// ─── Error Handling ──────────────────────────────────────────────────────────

app.use(errorHandler);

export default app;
