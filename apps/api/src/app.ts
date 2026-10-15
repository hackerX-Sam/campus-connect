import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';

import { errorHandler } from './middleware/errorHandler';
import { notFoundHandler } from './middleware/notFoundHandler';
import { openApiDocument } from './openapi';
import { authRouter } from './routes/auth.routes';
import { usersRouter } from './routes/users.routes';
import { communitiesRouter } from './routes/communities.routes';
import { eventsRouter } from './routes/events.routes';
import { projectsRouter } from './routes/projects.routes';
import { discussionsRouter } from './routes/discussions.routes';
import { notificationsRouter } from './routes/notifications.routes';
import { adminRouter } from './routes/admin.routes';

const app = express();
const allowedOrigins = (process.env.CORS_ORIGINS ?? process.env.NEXTAUTH_URL ?? 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

// ─── Security ────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) callback(null, true);
      else callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ─── Body parsing ────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());
app.use(compression());

// ─── Logging ─────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

app.use(
  '/api',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  })
);

// ─── Health ───────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.get('/openapi.json', (_req, res) => res.json(openApiDocument));
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/communities', communitiesRouter);
app.use('/api/events', eventsRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/discussions', discussionsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/admin', adminRouter);

// ─── Error handling ──────────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
