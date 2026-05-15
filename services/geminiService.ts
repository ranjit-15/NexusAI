import { Message, ModelOption, Role } from '../types';

// Ordered: Gemma first (default), then Gemini newest to oldest
const FALLBACK_MODELS: ModelOption[] = [
  // ── Gemma 4 (Open Models — DEFAULT) ──
  { id: 'gemma-4-31b-it', name: 'Gemma 4 31B', description: 'Open model, flagship dense architecture ✦ Default', capabilities: ['text', 'thinking', 'image'] },
  { id: 'gemma-4-26b-a4b-it', name: 'Gemma 4 26B MoE', description: 'Open model, efficient mixture-of-experts', capabilities: ['text', 'thinking', 'image'] },
  // ── Gemini 3.1 (Latest) ──
  { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', description: 'Most advanced — complex reasoning & agentic tasks', capabilities: ['text', 'thinking'] },
  { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', description: 'Frontier performance at fraction of cost', capabilities: ['text', 'thinking'] },
  { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite', description: 'Ultra fast, budget-friendly 3.1 model', capabilities: ['text', 'thinking'] },
  // ── Gemini 2.5 (Stable) ──
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Deep reasoning and coding capabilities', capabilities: ['text', 'thinking'] },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Best price-performance with reasoning', capabilities: ['text', 'thinking'] },
  { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', description: 'Fastest and most budget-friendly 2.5 model', capabilities: ['text', 'thinking'] },
  // ── Gemini 2.0 (Legacy) ──
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Previous gen workhorse, 1M context', capabilities: ['text'] },
  // ── Image Generation ──
  { id: 'image-generator', name: 'Image Generator (Pico)', description: 'Generate high quality images from text', capabilities: ['image'] },
];

export class GeminiService {
  private formatHistory(messages: Message[]) {
    return messages
      .filter(msg => msg.id !== 'welcome' && !msg.isError)
      .map(msg => ({
        role: msg.role === Role.USER ? 'user' : 'model',
        text: msg.text
      }));
  }

  public async *sendMessageStream(
    message: string,
    isThinkingMode: boolean,
    previousMessages: Message[],
    model: string,
    customSystemInstruction?: string,
    signal?: AbortSignal,
    userApiKey?: string,
    imageUrl?: string | null
  ): AsyncGenerator<string, void, unknown> {
    const history = this.formatHistory(previousMessages);

    const isImageReq = model === 'image-generator' || 
                       message.toLowerCase().startsWith('/image') || 
                       message.toLowerCase().startsWith('generate an image');

    if (isImageReq) {
      const res = await fetch('/api/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: message.replace('/image', '').trim() }),
        signal
      });
      const data = await res.json();
      if (res.ok && data.imageUrl) {
        yield `![Generated Image](${data.imageUrl})\n\n_Generated based on: "${message}"_`;
        return;
      } else {
        throw new Error(data.error || 'Image Generation Failed');
      }
    }

    const body = {
      message,
      history,
      persona: { systemInstruction: customSystemInstruction },
      thinking: isThinkingMode,
      model,
      apiKey: userApiKey,
      image: imageUrl,
    };

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const errorMsg = err.error || err.message || '';
      
      // Fallback to Pico LLM API if Gemini fails (e.g., missing/invalid API key)
      if (!userApiKey || errorMsg.includes('API key') || response.status === 400 || response.status === 401 || response.status === 403) {
        try {
          const fallbackRes = await fetch('/api/fallback-llm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: message }),
            signal
          });
          const fallbackData = await fallbackRes.json();
          if (fallbackRes.ok && fallbackData.text) {
            yield fallbackData.text;
            return;
          }
        } catch (e) {
          // Ignore fallback error and throw original error
        }
      }

      throw new Error(errorMsg || 'Failed to generate response');
    }

    if (!response.body) throw new Error('No response body');

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || ''; // keep the last incomplete chunk in buffer

        for (let line of lines) {
          line = line.trim();
          if (!line) continue;
          if (line.startsWith('data:')) {
            let dataStr = line.replace(/^data:\s*/, '').trim();
            if (dataStr === '[DONE]') return;
            
            // Defensively strip duplicate data: prefixes if Vercel mangled the stream
            while (dataStr.startsWith('data:')) {
              dataStr = dataStr.replace(/^data:\s*/, '').trim();
            }
            
            try {
              const data = JSON.parse(dataStr);
              if (data.error) throw new Error(data.error);
              if (data.text) yield data.text;
            } catch (e) {
              if (e instanceof SyntaxError) {
                console.warn("Skipping malformed SSE chunk:", dataStr);
              } else {
                throw e;
              }
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  public async generateSpeech(text: string, userApiKey?: string): Promise<string> {
    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, apiKey: userApiKey }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to generate speech');
    }

    const data = await response.json();
    if (!data.audio) throw new Error('No audio data received');
    return data.audio;
  }

  public async fetchAvailableModels(): Promise<ModelOption[]> {
    try {
      const response = await fetch('/api/models');
      if (!response.ok) return FALLBACK_MODELS;
      const data = await response.json();
      const models = Array.isArray(data.models) ? data.models : [];
      if (!models.length) return FALLBACK_MODELS;
      
      const parsed = models.map((m: any) => ({
        id: m.id,
        name: m.name || m.id,
        description: m.description,
        capabilities: Array.isArray(m.capabilities) ? m.capabilities : ['text'],
      }));

      // Ensure Image Generator is always available
      if (!parsed.some((m: ModelOption) => m.id === 'image-generator')) {
        parsed.push({
          id: 'image-generator', 
          name: 'Image Generator (Pico)', 
          description: 'Generate high quality images from text', 
          capabilities: ['image']
        });
      }
      return parsed;
    } catch {
      return FALLBACK_MODELS;
    }
  }

  public startNewSession() {}
}

export const geminiService = new GeminiService();