import type { EmotionKey, KeboState, Message } from '../types/kebo';

export interface KeboEmotionAnalysis {
  emotion: EmotionKey;
  intensity: number;
  target: 'kebo' | 'outside' | 'self' | 'unclear';
  reason: string;
}

export interface KeboReasoningPlan {
  intent: 'greeting' | 'question' | 'emotional_support' | 'information_request' | 'memory' | 'general_chat';
  userGoal: string;
  userEmotion: EmotionKey;
  memoryToUse: string[];
  responseStrategy: 'greet' | 'answer_briefly' | 'support' | 'acknowledge_limits' | 'recall_memory' | 'clarify';
  keboStateChange: string;
}

interface AskKeboArgs {
  message: string;
  keboState: KeboState;
  emotion: EmotionKey;
  recentConversation: Message[];
  relevantMemories: string[];
  /** Plain-English description of what the appraisal engine understood about this message. */
  situation?: string;
  signal?: AbortSignal;
}

const API_BASE_URL = (import.meta.env.VITE_KEBO_API_BASE_URL || 'https://kebo-ai-project.onrender.com').replace(/\/$/, '');
const configuredChatUrl = import.meta.env.VITE_KEBO_API_URL;
const configuredAnalyzeUrl = import.meta.env.VITE_KEBO_ANALYZE_URL;

async function readJsonResponse(response: Response): Promise<Record<string, unknown>> {
  const raw = await response.text();
  if (!raw.trim()) throw new Error(`Kebo backend returned an empty response (HTTP ${response.status}).`);
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error(`Kebo backend returned invalid JSON (HTTP ${response.status}).`);
  }
}

function resolveApiUrl(configured: string | undefined, path: string): string {
  if (!configured) return API_BASE_URL + path;
  const value = configured.replace(/\/$/, '');
  if (value === API_BASE_URL) return value + path;
  if (value.startsWith('/api/')) return API_BASE_URL + value;
  return value;
}

const API_URL = resolveApiUrl(configuredChatUrl, '/api/kebo-chat');
const ANALYZE_URL = resolveApiUrl(configuredAnalyzeUrl, '/api/kebo-analyze');


export async function analyzeKeboMessage(message: string, currentEmotion: EmotionKey, signal?: AbortSignal): Promise<KeboEmotionAnalysis> {
  const response = await fetch(ANALYZE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, currentEmotion }),
    signal,
  });
  const data = await readJsonResponse(response) as Partial<KeboEmotionAnalysis> & { error?: string };
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
  situation,
  signal,
}: AskKeboArgs): Promise<{ text: string; extractedMemories: string[] }> {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      keboState,
      emotion,
      recentConversation: recentConversation.slice(-10),
      relevantMemories,
      situation,
    }),
    signal,
  });

  const data = await readJsonResponse(response) as { reply?: string; extractedMemories?: string[]; error?: string };
  if (!response.ok || typeof data.reply !== 'string' || !data.reply.trim()) {
    throw new Error(data.error || 'Kebo backend failed.');
  }

  return { text: data.reply.trim(), extractedMemories: Array.isArray(data.extractedMemories) ? data.extractedMemories.filter((item): item is string => typeof item === 'string') : [] };
}

const INITIATE_URL = resolveApiUrl(undefined, '/api/kebo-initiate');
const HEALTH_URL = resolveApiUrl(undefined, '/api/health');

export interface KeboInitiateArgs {
  action: string;
  reason: string;
  keboState: KeboState;
  recentConversation: Message[];
  memory?: string;
  signal?: AbortSignal;
}

/** Asks the LLM to write a Kebo-initiated message for an action the agent already chose. */
export async function composeInitiatedMessage({ action, reason, keboState, recentConversation, memory, signal }: KeboInitiateArgs): Promise<string> {
  const response = await fetch(INITIATE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, reason, keboState, memory, recentConversation: recentConversation.slice(-6) }),
    signal,
  });
  const data = await readJsonResponse(response) as { reply?: string; error?: string };
  if (!response.ok || typeof data.reply !== 'string' || !data.reply.trim()) throw new Error(data.error || 'Initiation failed.');
  return data.reply.trim();
}

export type BackendStatus = 'checking' | 'online' | 'offline' | 'unconfigured';

export async function checkBackend(signal?: AbortSignal): Promise<BackendStatus> {
  try {
    const response = await fetch(HEALTH_URL, { signal });
    if (!response.ok) return 'offline';
    const data = await response.json() as { ok?: boolean; configured?: boolean };
    return data.ok ? (data.configured === false ? 'unconfigured' : 'online') : 'offline';
  } catch {
    return 'offline';
  }
}
