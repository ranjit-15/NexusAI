// Pico LLM key loaded from environment — never hardcoded
const PICO_KEY = process.env.PICO_LLM_KEY || '';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prompt } = req.body || {};
  if (typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ error: 'Valid prompt required' });
  }

  if (!PICO_KEY) {
    return res.status(503).json({ error: 'Fallback LLM not configured' });
  }

  try {
    const response = await fetch(`https://backend.buildpicoapps.com/aero/run/llm-api?pk=${PICO_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    const data = await response.json();
    if (data.status === 'success' && data.text) {
      return res.status(200).json({ text: data.text });
    }
    throw new Error('Fallback LLM returned no result');
  } catch (err) {
    return res.status(500).json({ error: 'Fallback LLM failed' });
  }
}
