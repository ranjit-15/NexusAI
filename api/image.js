const PICO_KEYS = [
  'v1-Z0FBQUFBQnB6U2NaWjM1dlRuc3hJT2NibGNBMGRfS1A5MVBGRmdEMFJKcWRwNzByZHlDdk91YnJhSi1zdVc2ZVJVcUoyRGNPZ01ZTWp6WE9pQ3Q5bTR4NjFObmRJeW9DcWc9PQ==',
  'v1-Z0FBQUFBQnB6UWJfTEphUko1UU9IV2trZk1yMlQ2cEhEekw2YUdDeEs5ajJmU2JQNnBzTFd3Sm1oM0VpaEc1Tk1jMHZiU2pfNG1qR3lYZEpyYVZEUmZuUzZ5Wk9iLW9vWGc9PQ==',
  'v1-Z0FBQUFBQnBZRzl4bEl1b3d3Q1R5bWJoTE1Gamx0Qy00am0zT1ZCdzR3NElwUFVaLVlUUEJIbmpVMDhPMkRsRnM0YWN3NmRKRDBlZkhiQTVWcGEzVGJ6REh0YmJyTlZzMGc9PQ=='
];

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
