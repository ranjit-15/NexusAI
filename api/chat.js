import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY;
const client = apiKey ? new GoogleGenAI({ apiKey }) : null;

function formatHistory(messages = []) {
  return messages
    .filter((m) => m && m.id !== 'welcome' && !m.isError)
    .map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }],
    }));
}

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!client) {
      return res.status(500).json({ error: 'Server missing GEMINI_API_KEY' });
    }

    const { message, history = [], persona = {}, thinking = false } = req.body || {};
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Missing message' });
    }

    const systemInstruction = persona.systemInstruction || 'You are a helpful AI assistant.';
    const targetModel = thinking ? 'gemini-3-pro-preview' : 'gemini-2.5-flash';

    const chat = client.chats.create({
      model: targetModel,
      config: {
        systemInstruction,
        ...(thinking ? { thinkingConfig: { thinkingBudget: 32768 } } : {}),
      },
      history: formatHistory(history),
    });

    const result = await chat.sendMessageStream({ message });

    let text = '';
    for await (const chunk of result) {
      text += chunk.text || '';
    }

    return res.status(200).json({ text });
  } catch (err) {
    console.error('Chat error', err);
    return res.status(500).json({ error: 'Failed to generate response' });
  }
}
