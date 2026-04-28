import { Message, ModelOption, Role } from '../types';

// Complete list of all free text-generation models available via Google AI Studio API
// Ordered: Gemma first, then Gemini newest to oldest
const FALLBACK_MODELS: ModelOption[] = [
  // ── Gemma 4 (Open Models) ──
  { id: 'gemma-4-31b-it', name: 'Gemma 4 31B', description: 'Open model, flagship dense architecture', capabilities: ['text', 'thinking', 'image'] },
  { id: 'gemma-4-26b-a4b-it', name: 'Gemma 4 26B MoE', description: 'Open model, efficient mixture-of-experts', capabilities: ['text', 'thinking', 'image'] },
  // ── Gemini 3.1 (Latest) ──
  { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', description: 'Most advanced — complex reasoning & agentic tasks', capabilities: ['text', 'thinking'] },
  { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', description: 'Frontier performance at fraction of cost', capabilities: ['text', 'thinking'] },
  { id: 'gemini-3.1-flash-lite-preview', name: 'Gemini 3.1 Flash Lite', description: 'Ultra fast, budget-friendly 3.1 model', capabilities: ['text', 'thinking'] },
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
    customSystemInstruction?: string
  ): AsyncGenerator<string, void, unknown> {
    const history = this.formatHistory(previousMessages);
    
    // Attempt to get user's custom API key
    let apiKey = undefined;
    try {
      const raw = localStorage.getItem('nexus_user_profile');
      if (raw) {
        const profile = JSON.parse(raw);
        if (profile.apiKey) apiKey = profile.apiKey;
      }
    } catch (e) {}

    if (model === 'image-generator') {
      const keys = [
        'v1-Z0FBQUFBQnB6U2NaWjM1dlRuc3hJT2NibGNBMGRfS1A5MVBGRmdEMFJKcWRwNzByZHlDdk91YnJhSi1zdVc2ZVJVcUoyRGNPZ01ZTWp6WE9pQ3Q5bTR4NjFObmRJeW9DcWc9PQ==',
        'v1-Z0FBQUFBQnB6UWJfTEphUko1UU9IV2trZk1yMlQ2cEhEekw2YUdDeEs5ajJmU2JQNnBzTFd3Sm1oM0VpaEc1Tk1jMHZiU2pfNG1qR3lYZEpyYVZEUmZuUzZ5Wk9iLW9vWGc9PQ==',
        'v1-Z0FBQUFBQnBZRzl4bEl1b3d3Q1R5bWJoTE1Gamx0Qy00am0zT1ZCdzR3NElwUFVaLVlUUEJIbmpVMDhPMkRsRnM0YWN3NmRKRDBlZkhiQTVWcGEzVGJ6REh0YmJyTlZzMGc9PQ=='
      ];
      let success = false;
      let lastError = null;

      for (const key of keys) {
        try {
          const res = await fetch(`https://backend.buildpicoapps.com/aero/run/image-generation-api?pk=${key}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: message.replace('/image', '').trim() })
          });
          const data = await res.json();
          if (data.status === 'success' && data.imageUrl) {
            yield `![Generated Image](${data.imageUrl})\n\n_Generated based on: "${message}"_`;
            success = true;
            break;
          } else {
            lastError = data.message || 'API Limit reached or failed';
          }
        } catch (e: any) {
          lastError = e.message;
        }
      }

      if (!success) {
        throw new Error(`Image Generation Failed: ${lastError}`);
      }
      return;
    }

    const body = {
      message,
      history,
      persona: { systemInstruction: customSystemInstruction },
      thinking: isThinkingMode,
      model,
      apiKey,
    };

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const errorMsg = err.error || err.message || '';
      
      // Fallback to Pico LLM API if Gemini fails (e.g., missing/invalid API key)
      if (!apiKey || errorMsg.includes('API key') || response.status === 400 || response.status === 401 || response.status === 403) {
        try {
          // Use one of the provided Pico keys
          const picoKey = 'v1-Z0FBQUFBQnB6U2NaWjM1dlRuc3hJT2NibGNBMGRfS1A5MVBGRmdEMFJKcWRwNzByZHlDdk91YnJhSi1zdVc2ZVJVcUoyRGNPZ01ZTWp6WE9pQ3Q5bTR4NjFObmRJeW9DcWc9PQ==';
          const fallbackRes = await fetch(`https://backend.buildpicoapps.com/aero/run/llm-api?pk=${picoKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: message })
          });
          const fallbackData = await fallbackRes.json();
          if (fallbackData.status === 'success' && fallbackData.text) {
            yield fallbackData.text;
            return;
          }
        } catch (e) {
          // Ignore fallback error and throw original error
        }
      }

      throw new Error(errorMsg || 'Failed to generate response');
    }

    const data = await response.json();
    if (data.text) yield data.text;
  }

  public async generateSpeech(text: string): Promise<string> {
    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
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