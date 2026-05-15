// Pico API keys loaded from environment — never hardcoded
const PICO_KEYS = (process.env.PICO_IMAGE_KEYS || '')
  .split(',')
  .map(k => k.trim())
  .filter(Boolean);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prompt } = req.body || {};
  if (typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ error: 'Valid prompt is required' });
  }

  if (!PICO_KEYS.length) {
    return res.status(503).json({ error: 'Image generation not configured' });
  }

  let lastError = null;
  for (const key of PICO_KEYS) {
    try {
      const response = await fetch(`https://backend.buildpicoapps.com/aero/run/image-generation-api?pk=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });
      const data = await response.json();
      if (data.status === 'success' && data.imageUrl) {
        return res.status(200).json({ imageUrl: data.imageUrl });
      }
      lastError = data.message || 'API limit reached';
    } catch (e) {
      lastError = e.message;
    }
  }
  return res.status(500).json({ error: `Image generation failed: ${lastError}` });
}
