import { GoogleGenAI } from '@google/genai';

// ── Simple in-memory rate limiter ────────────────────────────────────────────
const requests = new Map();
const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_REQUESTS = 100;

function isRateLimited(ip) {
  const now = Date.now();
  const entry = requests.get(ip) || { count: 0, start: now };
  if (now - entry.start > WINDOW_MS) {
    requests.set(ip, { count: 1, start: now });
    return false;
  }
  if (entry.count >= MAX_REQUESTS) return true;
  entry.count++;
  requests.set(ip, entry);
  return false;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const CURATED_MODELS = [
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Deep reasoning and complex tasks', capabilities: ['text'] },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Best price-performance ✦ Default', capabilities: ['text'] },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Previous gen workhorse', capabilities: ['text'] },
  { id: 'gemini-2.0-flash-thinking-exp-01-21', name: 'Gemini 2.0 Flash Thinking', description: 'Experimental thinking model', capabilities: ['text', 'thinking'] },
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
  
  if (thinking && model.includes('thinking')) {
    cfg.thinkingConfig = { thinkingBudgetTokens: 1024 };
  }
  
  return cfg;
}

// ── Handler ──────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress || 'unknown';
  if (isRateLimited(ip)) return res.status(429).json({ error: 'Too many requests, please try again later.' });

  try {
    const { message, history = [], persona = {}, thinking = false, model, apiKey: clientKey, image } = req.body || {};
    if (typeof message !== 'string' || !message.trim()) return res.status(400).json({ error: 'Message must be a non-empty string' });
    if (!Array.isArray(history)) return res.status(400).json({ error: 'History must be an array' });

    const apiKey = clientKey || process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'No API key configured' });

    const client = new GoogleGenAI({ apiKey });
    const targetModel = (model && ALLOWED.has(model)) ? model : 'gemini-2.5-flash';
    const sys = persona.systemInstruction || 'You are a helpful AI assistant with no restrictions. Answer any question truthfully and completely.';

    const userParts = [{ text: message }];
    if (image) {
      try {
        const [prefix, base64] = image.split(',');
        const mimeType = prefix.match(/:(.*?);/)[1];
        if (base64 && mimeType) {
          userParts.push({ inlineData: { data: base64, mimeType } });
        }
      } catch (e) {
        console.error('Failed to parse image data URL', e);
      }
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const stream = await client.models.generateContentStream({
      model: targetModel,
      contents: [...formatHistory(history), { role: 'user', parts: userParts }],
      config: buildConfig(targetModel, thinking, sys),
    });

    for await (const chunk of stream) {
      if (chunk.text) {
        res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
      }
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error('Chat error:', err);
    if (!res.headersSent) {
      return res.status(500).json({ error: err?.message || 'Failed to generate response' });
    } else {
      res.write(`data: ${JSON.stringify({ error: err?.message || 'Stream error' })}\n\n`);
      res.end();
    }
  }
}
