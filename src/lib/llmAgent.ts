import type { EmotionKey, KeboState, Message } from '../types/kebo';

export interface KeboEmotionAnalysis {
  emotion: EmotionKey;
  intensity: number;
  target: 'kebo' | 'outside' | 'self' | 'unclear';
  reason: string;
}

interface AskKeboArgs {
  message: string;
  keboState: KeboState;
  emotion: EmotionKey;
  recentConversation: Message[];
  relevantMemories: string[];
  signal?: AbortSignal;
}

const API_URL = import.meta.env.VITE_KEBO_API_URL || '/api/kebo-chat';
const ANALYZE_URL = import.meta.env.VITE_KEBO_ANALYZE_URL || '/api/kebo-analyze';

export async function analyzeKeboMessage(message: string, currentEmotion: EmotionKey, signal?: AbortSignal): Promise<KeboEmotionAnalysis> {
  const response = await fetch(ANALYZE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, currentEmotion }),
    signal,
  });
  const data = (await response.json()) as Partial<KeboEmotionAnalysis> & { error?: string };
  if (!response.ok || typeof data.emotion !== 'string') throw new Error(data.error || 'Emotion analysis failed.');
  return {
    emotion: data.emotion as EmotionKey,
    intensity: Math.min(1, Math.max(0, data.intensity || 0)),
    target: data.target || 'unclear',
    reason: data.reason || '',
  };
}

export async function askKeboLLM({
  message,
  keboState,
  emotion,
  recentConversation,
  relevantMemories,
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
      relevantMemories,
    }),
    signal,
  });

  const data = (await response.json()) as { reply?: string; error?: string };
  if (!response.ok || typeof data.reply !== 'string' || !data.reply.trim()) {
    throw new Error(data.error || 'Kebo backend failed.');
  }

  return data.reply.trim();
}
