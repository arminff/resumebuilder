import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { authMiddleware } from './utils/auth.js';
import { resumeRouter } from './routes/resume.js';
import { scrapeRouter } from './routes/scrape.js';

const app = express();

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') ?? '*', credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
app.use('/api/', limiter);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

// Auth-protected routes
app.use('/api', authMiddleware);
app.use('/api/resume', resumeRouter);
app.use('/api/scrape', scrapeRouter);

const port = Number(process.env.PORT || 4000);

const server = app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on port ${port}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    // eslint-disable-next-line no-console
    console.error(`❌ Port ${port} is already in use.`);
    // eslint-disable-next-line no-console
    console.error(`💡 Try: kill -9 $(lsof -ti :${port})`);
    process.exit(1);
  } else {
    // eslint-disable-next-line no-console
    console.error('❌ Server error:', err);
    process.exit(1);
  }
});


