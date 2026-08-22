import type { EmotionKey, KeboState, Message } from '../types/kebo';

interface AskKeboArgs {
  message: string;
  keboState: KeboState;
  emotion: EmotionKey;
  recentConversation: Message[];
  signal?: AbortSignal;
}

const API_URL = import.meta.env.VITE_KEBO_API_URL || '/api/kebo-chat';

export async function askKeboLLM({
  message,
  keboState,
  emotion,
  recentConversation,
  signal,
}: AskKeboArgs): Promise<string> {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      keboState,
      emotion,
      recentConversation: recentConversation.slice(-10),
    }),
    signal,
  });

  const data = (await response.json()) as { reply?: string; error?: string };
  if (!response.ok || typeof data.reply !== 'string' || !data.reply.trim()) {
    throw new Error(data.error || 'Kebo backend failed.');
  }

  return data.reply.trim();
}
