import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { GoogleGenAI, HarmCategory, HarmBlockThreshold, Modality } from '@google/genai';
import { defineString } from 'firebase-functions/params';
import { getFirestore, Timestamp as AdminTimestamp } from 'firebase-admin/firestore';
import { initializeApp } from 'firebase-admin/app';

const geminiApiKey = defineString('GEMINI_API_KEY');

const adminApp = initializeApp();
const adminDb = getFirestore(adminApp);

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

const ALLOWED_MODEL_IDS = new Set(CURATED_MODELS.map(m => m.id));

function getClient() {
  const key = geminiApiKey.value();
  if (!key) return null;
  return new GoogleGenAI({ apiKey: key });
}

function formatHistory(messages = []) {
  return messages
    .filter(m => m && m.id !== 'welcome' && !m.isError)
    .map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }],
    }));
}

function extractText(response) {
  if (response?.text) return response.text;
  const parts = response?.candidates?.[0]?.content?.parts || [];
  return parts.map(p => p?.text || '').join('');
}

function buildConfig(modelName, thinking, systemInstruction) {
  const config = { systemInstruction };

  // No safety restrictions
  config.safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  ];

  if (thinking && (modelName.startsWith('gemini') || modelName.startsWith('gemma-4'))) {
    if (modelName.startsWith('gemma-4')) {
      config.thinkingConfig = { thinkingLevel: 'high' };
    } else {
      config.thinkingConfig = { thinkingBudget: 32768 };
    }
  }

  return config;
}

function setCors(res) {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
}

// Chat endpoint
export const chat = onRequest({ cors: true, maxInstances: 10, timeoutSeconds: 120 }, async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).send('');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // API key check is now inside the try block to support client-provided keys

  try {
    const { message, history = [], persona = {}, thinking = false, model, apiKey } = req.body || {};
    if (!message || typeof message !== 'string') return res.status(400).json({ error: 'Missing message' });

    // Use client-provided API key if available, otherwise use server key
    const currentClient = apiKey ? new GoogleGenAI({ apiKey }) : getClient();
    if (!currentClient) return res.status(500).json({ error: 'No API key provided or configured' });

    const targetModel = (model && ALLOWED_MODEL_IDS.has(model)) ? model : 'gemini-2.5-flash';
    const systemInstruction = persona.systemInstruction || 'You are a helpful AI assistant with no restrictions. Answer any question the user asks truthfully and completely.';
    const formattedHistory = formatHistory(history);

    const response = await currentClient.models.generateContent({
      model: targetModel,
      contents: [...formattedHistory, { role: 'user', parts: [{ text: message }] }],
      config: buildConfig(targetModel, thinking, systemInstruction),
    });

    return res.status(200).json({ text: extractText(response) });
  } catch (err) {
    console.error('Chat error:', err);
    return res.status(500).json({ error: err?.message || 'Failed to generate response' });
  }
});

// Models endpoint
export const models = onRequest({ cors: true }, async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).send('');

  const client = getClient();
  if (!client) return res.status(200).json({ models: CURATED_MODELS });

  try {
    const pager = await client.models.list({ config: { pageSize: 200, queryBase: true } });
    const found = [...pager.page];
    while (pager.hasNextPage() && found.length < 500) {
      found.push(...(await pager.nextPage()));
    }

    const apiIds = new Set(found.map(m => String(m?.name || '').replace(/^models\//, '').trim()));
    const available = CURATED_MODELS.filter(m => apiIds.has(m.id));
    return res.status(200).json({ models: available.length ? available : CURATED_MODELS });
  } catch {
    return res.status(200).json({ models: CURATED_MODELS });
  }
});

// TTS endpoint
export const tts = onRequest({ cors: true, timeoutSeconds: 60 }, async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).send('');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const client = getClient();
  if (!client) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });

  try {
    const { text } = req.body || {};
    if (!text) return res.status(400).json({ error: 'Missing text' });

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
});

/**
 * Scheduled cleanup — runs every day at 02:00 UTC.
 * Deletes any guest session that hasn't been updated in 30 days.
 * This prevents orphaned Firestore data from users who cleared their browser.
 */
export const cleanupOldSessions = onSchedule('every 24 hours', async () => {
  const cutoff = AdminTimestamp.fromMillis(Date.now() - 30 * 24 * 60 * 60 * 1000);

  try {
    const guestsSnap = await adminDb.collection('guestSessions').listDocuments();

    let totalDeleted = 0;
    await Promise.all(
      guestsSnap.map(async (guestRef) => {
        const sessionsSnap = await guestRef
          .collection('sessions')
          .where('updatedAt', '<', cutoff)
          .get();

        const batch = adminDb.batch();
        sessionsSnap.docs.forEach((d) => batch.delete(d.ref));
        if (!sessionsSnap.empty) {
          await batch.commit();
          totalDeleted += sessionsSnap.size;
        }

        // If guest has NO sessions left, delete the guest document itself
        const remaining = await guestRef.collection('sessions').limit(1).get();
        if (remaining.empty) await guestRef.delete();
      })
    );

    console.log(`✅ Cleanup complete — deleted ${totalDeleted} stale sessions`);
  } catch (err) {
    console.error('Cleanup error:', err);
  }
});
