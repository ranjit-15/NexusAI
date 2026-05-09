import { GoogleGenAI } from '@google/genai';

function extractText(r) {
  if (r?.text) return r.text;
  return (r?.candidates?.[0]?.content?.parts || []).map(p => p?.text || '').join('');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prompt } = req.body || {};
  if (typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(200).json({ title: 'New Chat' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(200).json({ title: prompt.slice(0, 30) });

  try {
    const client = new GoogleGenAI({ apiKey });
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: [{ role: 'user', parts: [{ text: `Summarize this in 3-4 words for a chat title: "${prompt}"` }] }],
      config: { systemInstruction: 'Respond ONLY with a short title, no quotes or punctuation.' },
    });
    return res.status(200).json({ title: extractText(response).trim() || prompt.slice(0, 30) });
  } catch {
    return res.status(200).json({ title: prompt.slice(0, 30) + '...' });
  }
}
