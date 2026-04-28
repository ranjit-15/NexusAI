import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI, Modality } from '@google/genai';

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

if (!apiKey) console.warn('⚠ GEMINI_API_KEY not set — requests will fail.');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

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

// Chat
app.post('/api/chat', async (req, res) => {
  // API key check moved inside try block
  try {
    const { message, history = [], persona = {}, thinking = false, model, apiKey: clientApiKey } = req.body || {};
    if (!message) return res.status(400).json({ error: 'Missing message' });

    // Use client-provided API key if available, otherwise use server key
    const currentClient = clientApiKey ? new GoogleGenAI({ apiKey: clientApiKey }) : client;
    if (!currentClient) return res.status(500).json({ error: 'No API key provided or configured' });

    const targetModel = model || 'gemini-2.5-flash';
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
    if (!text) return res.status(400).json({ error: 'Missing text' });

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
