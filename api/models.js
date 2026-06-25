import { GoogleGenAI } from '@google/genai';

const CURATED_MODELS = [
  { id: 'gemma-4-31b-it', name: 'Gemma 4 31B', description: 'Open model, flagship dense architecture ✦ Default', capabilities: ['text', 'thinking', 'image'] },
  { id: 'gemma-4-26b-a4b-it', name: 'Gemma 4 26B MoE', description: 'Open model, efficient mixture-of-experts', capabilities: ['text', 'thinking', 'image'] },
  { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', description: 'Most advanced — complex reasoning & agentic tasks', capabilities: ['text', 'thinking'] },
  { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', description: 'Frontier performance at fraction of cost', capabilities: ['text', 'thinking'] },
  { id: 'gemini-3.1-flash-lite-preview', name: 'Gemini 3.1 Flash Lite', description: 'Ultra fast, budget-friendly 3.1 model', capabilities: ['text', 'thinking'] },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Deep reasoning and coding capabilities', capabilities: ['text', 'thinking'] },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Best price-performance with reasoning', capabilities: ['text', 'thinking'] },
  { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', description: 'Fastest and most budget-friendly 2.5 model', capabilities: ['text', 'thinking'] },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Previous gen workhorse, 1M context', capabilities: ['text'] },
  { id: 'image-generator', name: 'Image Generator (Pico)', description: 'Generate high quality images from text', capabilities: ['image'] },
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(200).json({ models: CURATED_MODELS });

  try {
    const client = new GoogleGenAI({ apiKey });
    const result = await client.models.list({ config: { pageSize: 200 } });

    // The SDK may return an async iterable or an object with a .page array.
    // Handle both patterns defensively.
    const found = [];
    if (result && Symbol.asyncIterator in Object(result)) {
      for await (const m of result) {
        found.push(m);
        if (found.length >= 500) break;
      }
    } else if (result && Array.isArray(result.page)) {
      found.push(...result.page);
    } else if (Array.isArray(result)) {
      found.push(...result);
    }

    const apiIds = new Set(found.map(m => String(m?.name || '').replace(/^models\//, '').trim()));
    const available = CURATED_MODELS.filter(m => m.id === 'image-generator' || apiIds.has(m.id));
    return res.status(200).json({ models: available.length ? available : CURATED_MODELS });
  } catch {
    return res.status(200).json({ models: CURATED_MODELS });
  }
}
