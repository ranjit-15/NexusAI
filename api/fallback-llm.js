const PICO_KEY = 'v1-Z0FBQUFBQnB6U2NaWjM1dlRuc3hJT2NibGNBMGRfS1A5MVBGRmdEMFJKcWRwNzByZHlDdk91YnJhSi1zdVc2ZVJVcUoyRGNPZ01ZTWp6WE9pQ3Q5bTR4NjFObmRJeW9DcWc5PQ==';

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
