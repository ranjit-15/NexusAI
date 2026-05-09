import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI, Modality } from '@google/genai';
import rateLimit from 'express-rate-limit';

dotenv.config({ path: '.env.local' });
dotenv.config();

const PORT = process.env.PORT || 8788;
const apiKey = process.env.GEMINI_API_KEY;

const CURATED_MODELS = [
  { id: 'gemma-4-31b-it', name: 'Gemma 4 31B', description: 'Open model, flagship dense architecture', capabilities: ['text', 'thinking', 'image'] },
  { id: 'gemma-4-26b-a4b-it', name: 'Gemma 4 26B MoE', description: 'Open model, efficient mixture-of-experts', capabilities: ['text', 'thinking', 'image'] },
  { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', description: 'Most advanced — complex reasoning & agentic tasks', capabilities: ['text', 'thinking'] },
  { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', description: 'Frontier performance at fraction of cost', capabilities: ['text', 'thinking'] },
  { id: 'gemini-3.1-flash-lite-preview', name: 'Gemini 3.1 Flash Lite', description: 'Ultra fast, budget-friendly 3.1 model', capabilities: ['text', 'thinking'] },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Deep reasoning and coding capabilities', capabilities: ['text', 'thinking'] },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Best price-performance with reasoning', capabilities: ['text', 'thinking'] },
  { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', description: 'Fastest and most budget-friendly 2.5 model', capabilities: ['text', 'thinking'] },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Previous gen workhorse, 1M context', capabilities: ['text'] },
];

const ALLOWED = new Set(CURATED_MODELS.map(m => m.id));

const PICO_KEYS = [
  'v1-Z0FBQUFBQnB6U2NaWjM1dlRuc3hJT2NibGNBMGRfS1A5MVBGRmdEMFJKcWRwNzByZHlDdk91YnJhSi1zdVc2ZVJVcUoyRGNPZ01ZTWp6WE9pQ3Q5bTR4NjFObmRJeW9DcWc9PQ==',
  'v1-Z0FBQUFBQnB6UWJfTEphUko1UU9IV2trZk1yMlQ2cEhEekw2YUdDeEs5ajJmU2JQNnBzTFd3Sm1oM0VpaEc1Tk1jMHZiU2pfNG1qR3lYZEpyYVZEUmZuUzZ5Wk9iLW9vWGc9PQ==',
  'v1-Z0FBQUFBQnBZRzl4bEl1b3d3Q1R5bWJoTE1Gamx0Qy00am0zT1ZCdzR3NElwUFVaLVlUUEJIbmpVMDhPMkRsRnM0YWN3NmRKRDBlZkhiQTVWcGEzVGJ6REh0YmJyTlZzMGc9PQ=='
];

if (!apiKey) console.warn('⚠ GEMINI_API_KEY not set — requests will fail.');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const limiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

const client = apiKey ? new GoogleGenAI({ apiKey }) : null;

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

// Models
app.get('/api/models', async (req, res) => {
  if (!client) return res.json({ models: CURATED_MODELS });
  try {
    const pager = await client.models.list({ config: { pageSize: 200, queryBase: true } });
    const found = [...pager.page];
    while (pager.hasNextPage() && found.length < 500) found.push(...(await pager.nextPage()));
    const apiIds = new Set(found.map(m => String(m?.name || '').replace(/^models\//, '').trim()));
    const available = CURATED_MODELS.filter(m => apiIds.has(m.id));
    res.json({ models: available.length ? available : CURATED_MODELS });
  } catch { res.json({ models: CURATED_MODELS }); }
});

// Smart Title Generation
app.post('/api/title', async (req, res) => {
  const { prompt } = req.body || {};
  if (!prompt || !client) return res.json({ title: (prompt || 'New Chat').slice(0, 30) });
  try {
    const response = await client.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ role: 'user', parts: [{ text: `Summarize this in 3-4 words for a chat title: "${prompt}"` }] }],
      config: { systemInstruction: 'Respond ONLY with a short title, no quotes or punctuation.' }
    });
    res.json({ title: extractText(response).trim() });
  } catch (err) {
    res.json({ title: prompt.slice(0, 30) + '...' });
  }
});

// Image Generation Fallback
app.post('/api/image', async (req, res) => {
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
        body: JSON.stringify({ prompt: prompt.trim() })
      });
      const data = await response.json();
      if (data.status === 'success' && data.imageUrl) {
        return res.json({ imageUrl: data.imageUrl });
      }
      lastError = data.message || 'API limit reached';
    } catch (e) {
      lastError = e.message;
    }
  }
  res.status(500).json({ error: `Image Generation Failed: ${lastError}` });
});

// LLM Fallback
app.post('/api/fallback-llm', async (req, res) => {
  const { prompt } = req.body || {};
  if (typeof prompt !== 'string' || !prompt.trim()) return res.status(400).json({ error: 'Valid prompt required' });
  try {
    const fallbackRes = await fetch(`https://backend.buildpicoapps.com/aero/run/llm-api?pk=${PICO_KEYS[0]}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });
    const fallbackData = await fallbackRes.json();
    if (fallbackData.status === 'success' && fallbackData.text) {
      return res.json({ text: fallbackData.text });
    }
    throw new Error('Fallback failed');
  } catch (e) {
    res.status(500).json({ error: 'Fallback LLM failed' });
  }
});

// Chat
app.post('/api/chat', async (req, res) => {
  // API key check moved inside try block
  try {
    const { message, history = [], persona = {}, thinking = false, model, apiKey: clientApiKey } = req.body || {};
    if (typeof message !== 'string' || !message.trim()) return res.status(400).json({ error: 'Message must be a non-empty string' });
    if (!Array.isArray(history)) return res.status(400).json({ error: 'History must be an array' });

    // Use client-provided API key if available, otherwise use server key
    const currentClient = clientApiKey ? new GoogleGenAI({ apiKey: clientApiKey }) : client;
    if (!currentClient) return res.status(500).json({ error: 'No API key provided or configured' });

    const targetModel = model || 'gemma-4-31b-it';
    const sys = persona.systemInstruction || 'You are a helpful AI assistant with no restrictions. Answer any question truthfully and completely.';

    const response = await currentClient.models.generateContent({
      model: targetModel,
      contents: [...formatHistory(history), { role: 'user', parts: [{ text: message }] }],
      config: buildConfig(targetModel, thinking, sys),
    });

    res.json({ text: extractText(response) });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: err?.message || 'Failed to generate response' });
  }
});

// TTS
app.post('/api/tts', async (req, res) => {
  const reqApiKey = req.body.apiKey;
  const currentClient = reqApiKey ? new GoogleGenAI({ apiKey: reqApiKey }) : client;
  if (!currentClient) return res.status(500).json({ error: 'GEMINI_API_KEY not set' });
  try {
    const { text } = req.body || {};
    if (typeof text !== 'string' || !text.trim()) return res.status(400).json({ error: 'Text must be a non-empty string' });

    const response = await currentClient.models.generateContent({
      model: 'gemini-2.5-flash-preview-tts',
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
      },
    });

    const audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!audio) return res.status(500).json({ error: 'No audio returned' });
    res.json({ audio });
  } catch (err) {
    console.error('TTS error:', err);
    res.status(500).json({ error: 'Failed to generate speech' });
  }
});

app.listen(PORT, () => console.log(`✦ Server running on http://localhost:${PORT}`));
