import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI, Modality } from '@google/genai';

dotenv.config();

const PORT = process.env.PORT || 8788;
const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.warn('Warning: GEMINI_API_KEY is not set. Requests will fail until it is configured.');
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const client = apiKey ? new GoogleGenAI({ apiKey }) : null;

function formatHistory(messages = []) {
  return messages
    .filter((m) => m && m.id !== 'welcome' && !m.isError)
    .map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }],
    }));
}

app.post('/api/chat', async (req, res) => {
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

    return res.json({ text });
  } catch (err) {
    console.error('Chat error', err);
    return res.status(500).json({ error: 'Failed to generate response' });
  }
});

app.post('/api/tts', async (req, res) => {
  try {
    if (!client) {
      return res.status(500).json({ error: 'Server missing GEMINI_API_KEY' });
    }

    const { text } = req.body || {};
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Missing text' });
    }

    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash-preview-tts',
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      return res.status(500).json({ error: 'No audio returned' });
    }

    return res.json({ audio: base64Audio });
  } catch (err) {
    console.error('TTS error', err);
    return res.status(500).json({ error: 'Failed to generate speech' });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
