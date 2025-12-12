import { Message, Role } from '../types';

export class GeminiService {
  private chatSession: Chat | null = null;
  private currentModel: string | null = null;
  private currentSystemInstruction: string | null = null;
  
  // Helper to format history for the API
  private formatHistory(messages: Message[]): Content[] {
    return messages
      .filter(msg => msg.id !== 'welcome' && !msg.isError)
      .map(msg => ({
        role: msg.role === Role.USER ? 'user' : 'model',
        parts: [{ text: msg.text } as Part]
      }));
  }

  public async *sendMessageStream(
    message: string, 
    isThinkingMode: boolean, 
    previousMessages: Message[],
    customSystemInstruction?: string
  ): AsyncGenerator<string, void, unknown> {
    const history = this.formatHistory(previousMessages);
    const body = {
      message,
      history,
      persona: { systemInstruction: customSystemInstruction },
      thinking: isThinkingMode,
    };

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to generate response');
    }

    const data = await response.json();
    const text: string = data.text || '';
    if (text) {
      yield text;
    }
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
    if (!data.audio) {
      throw new Error('No audio data received');
    }
    return data.audio;
  }

  public startNewSession() {
    this.chatSession = null;
    this.currentModel = null;
    this.currentSystemInstruction = null;
  }
}

export const geminiService = new GeminiService();