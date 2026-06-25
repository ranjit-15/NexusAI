/**
 * Local Express dev server for NexusAI API routes.
 * Mirrors the Vercel serverless function interface so the same
 * api/*.js handlers work locally without modification.
 *
 * Usage: node dev-server.js
 */
import 'dotenv/config';
import express from 'express';
import { createRequire } from 'module';

const app = express();
const PORT = process.env.PORT || 8788;

app.use(express.json({ limit: '10mb' }));

// ── Mount API handlers ──────────────────────────────────────────────────────
// Each Vercel serverless function exports a default handler(req, res).
// We dynamically import them and mount at the matching route.

const apiRoutes = ['chat', 'models', 'title', 'image', 'fallback-llm'];

for (const route of apiRoutes) {
  const method = route === 'models' ? 'all' : 'all'; // all methods, handler checks internally
  app[method](`/api/${route}`, async (req, res) => {
    try {
      const mod = await import(`./api/${route}.js`);
      const handler = mod.default || mod;
      await handler(req, res);
    } catch (err) {
      console.error(`[dev-server] Error in /api/${route}:`, err);
      if (!res.headersSent) {
        res.status(500).json({ error: err.message || 'Internal server error' });
      }
    }
  });
}

app.listen(PORT, () => {
  console.log(`[NexusAI] API dev server running at http://localhost:${PORT}`);
});
