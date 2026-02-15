// OpenAI Client Configuration

import OpenAI from 'openai';

// Allow initialization to be deferred until runtime
let openaiInstance: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiInstance) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }
    openaiInstance = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiInstance;
}

export const openai = new Proxy({} as OpenAI, {
  get(_target, prop) {
    const client = getOpenAIClient();
    const value = client[prop as keyof OpenAI];
    // Bind methods to preserve context
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});
