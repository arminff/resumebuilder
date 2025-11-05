import { Router } from 'express';
import { scrapeSchema } from '../utils/schemas.js';
import { scrapeStatic, scrapeDynamic } from '../utils/scrape.js';

export const scrapeRouter = Router();

scrapeRouter.post('/static', async (req, res) => {
  const parsed = scrapeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const result = await scrapeStatic(parsed.data.url);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Static scrape failed' });
  }
});

scrapeRouter.post('/dynamic', async (req, res) => {
  const parsed = scrapeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const result = await scrapeDynamic(parsed.data.url);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Dynamic scrape failed' });
  }
});


