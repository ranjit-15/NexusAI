import { GoogleGenAI, Modality } from '@google/genai';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { text, apiKey: clientKey } = req.body || {};
    if (typeof text !== 'string' || !text.trim()) return res.status(400).json({ error: 'Text must be a non-empty string' });

    const apiKey = clientKey || process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'No API key configured' });

    const client = new GoogleGenAI({ apiKey });
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash-preview-tts',
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
      },
    });

    const audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!audio) return res.status(500).json({ error: 'No audio returned' });
    return res.status(200).json({ audio });
  } catch (err) {
    console.error('TTS error:', err);
    return res.status(500).json({ error: 'Failed to generate speech' });
  }
}
