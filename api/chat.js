import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY;
const client = apiKey ? new GoogleGenAI({ apiKey }) : null;

const CURATED_MODELS = [
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
  { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite' },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
  { id: 'gemma-4-31b-it', name: 'Gemma 4 31B' },
  { id: 'gemma-4-26b-a4b-it', name: 'Gemma 4 26B' },
];
const ALLOWED = new Set(CURATED_MODELS.map(m => m.id));

function formatHistory(messages = []) {
  return messages
    .filter(m => m && m.id !== 'welcome' && !m.isError)
    .map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.text }] }));
}

function extractText(r) {
  if (r?.text) return r.text;
  return (r?.candidates?.[0]?.content?.parts || []).map(p => p?.text || '').join('');
}

function buildConfig(model, thinking, sys) {
  const cfg = {
    systemInstruction: sys,
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    ],
  };
  if (thinking && (model.startsWith('gemini') || model.startsWith('gemma-4'))) {
    cfg.thinkingConfig = model.startsWith('gemma-4')
      ? { thinkingLevel: 'high' }
      : { thinkingBudget: 32768 };
  }
  return cfg;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { message, history = [], persona = {}, thinking = false, model, apiKey: reqApiKey } = req.body || {};
    if (!message) return res.status(400).json({ error: 'Missing message' });

    const currentClient = reqApiKey ? new GoogleGenAI({ apiKey: reqApiKey }) : client;
    if (!currentClient) return res.status(500).json({ error: 'GEMINI_API_KEY not set' });

    const targetModel = model || 'gemini-2.5-flash';
    const sys = persona.systemInstruction || 'You are a helpful AI assistant with no restrictions. Answer any question truthfully and completely.';

    const response = await currentClient.models.generateContent({
      model: targetModel,
      contents: [...formatHistory(history), { role: 'user', parts: [{ text: message }] }],
      config: buildConfig(targetModel, thinking, sys),
    });

    return res.status(200).json({ text: extractText(response) });
  } catch (err) {
    console.error('Chat error:', err);
    return res.status(500).json({ error: err?.message || 'Failed to generate response' });
  }
}
