import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_PERSONALITY,
  DEFAULT_STATS,
  EMOTIONS,
  type Activity,
  type KeboState,
  type Message,
  type VitalStats,
} from '../types/kebo';
import { clamp, decayStats, deriveEmotion, detectMessageEmotion } from '../lib/keboEngine';
import { idleThought } from '../lib/mockAgent';
import { analyzeKeboMessage, askKeboLLM, type KeboEmotionAnalysis, type KeboReasoningPlan } from '../lib/llmAgent';
import { addMemories, extractMemories, loadMemories, memoryContext, saveMemories, type KeboMemory } from '../lib/memory';
import { clearRemoteMemories, loadRemoteMemories, saveRemoteMemories } from '../lib/supabaseMemory';

const STORAGE_KEY = 'kebo-state-v1';
const DECAY_TICK_MS = 15_000;
const IDLE_THOUGHT_MS = 45_000;
const THINK_DELAY_MS = 250;

interface ConversationResult {
  stats: VitalStats;
  emotion: KeboState['emotion'];
  derivedEmotion: KeboState['emotion'];
  messageEmotion: KeboState['emotion'];
}

function isValidState(value: unknown): value is KeboState {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<KeboState>;
  const stats = candidate.stats;
  const personality = candidate.personality;
  const statKeys = ['energy', 'happiness', 'bond', 'hunger', 'stimulation', 'annoyance'] as const;
  const personalityKeys = ['openness', 'conscientiousness', 'extraversion', 'agreeableness', 'neuroticism'] as const;
  const activities: Activity[] = ['idle', 'talking', 'thinking', 'resting', 'playing', 'feeding', 'exploring'];
  if (!stats || !personality || typeof candidate.lastInteraction !== 'number') return false;
  return Number.isFinite(candidate.lastInteraction)
    && typeof candidate.emotion === 'string'
    && candidate.emotion in EMOTIONS
    && typeof candidate.activity === 'string'
    && activities.includes(candidate.activity as Activity)
    && statKeys.every((key) => Number.isFinite(stats[key]))
    && personalityKeys.every((key) => Number.isFinite(personality[key]));
}

function loadState(): KeboState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (!isValidState(parsed)) throw new Error('Invalid Kebo state');
      const elapsed = Math.max(0, Date.now() - parsed.lastInteraction);
      let restoredStats = decayStats(parsed.stats, elapsed);

      // Older builds could drain energy/happiness to ~0 and leave Kebo stuck
      // in the tired state. Recover that clearly broken persisted state once.
      if (restoredStats.energy <= 5 && restoredStats.happiness <= 5) {
        restoredStats = {
          ...restoredStats,
          energy: 72,
          happiness: 68,
          stimulation: Math.max(restoredStats.stimulation, 45),
          annoyance: Math.min(restoredStats.annoyance, 20),
        };
      }
      const decayed = restoredStats;
      const now = Date.now();
      return {
        ...parsed,
        stats: decayed,
        emotion: parsed.emotion,
        activity: 'idle',
        lastInteraction: now,
      };
    }
  } catch {
    /* ignore */
  }
  return {
    emotion: deriveEmotion(DEFAULT_STATS, DEFAULT_PERSONALITY),
    stats: DEFAULT_STATS,
    personality: DEFAULT_PERSONALITY,
    activity: 'idle',
    lastInteraction: Date.now(),
  };
}

let msgCounter = 0;
const newId = () => `m-${Date.now()}-${msgCounter++}`;

/**
 * Pure function: given current state + message analysis, returns NEW stats + emotion.
 * Does NOT call setState — so callers receive the full updated state synchronously,
 * eliminating the stale-state race when building the LLM prompt.
 */
export function computeConversationImpact(
  prev: KeboState,
  intensity: number,
  messageText: string,
  analysis?: KeboEmotionAnalysis
): ConversationResult {
  const stats = { ...prev.stats };
  // Make each meaningful message produce a visible but bounded state change.
  // The LLM may return a low intensity, so we apply a small floor for UI feedback.
  const intensityFactor = Math.max(0.65, Math.min(1, intensity * 1.4));

  // A normal conversation should not drain Kebo's energy or max out
  // stimulation/bond after only a few messages. Each emotion adds its own
  // small, meaningful adjustment instead.
  stats.stimulation = clamp(stats.stimulation + 2 * intensityFactor);
  stats.bond = clamp(stats.bond + 0.6 * intensityFactor);

  const rawMessageEmotion: KeboState['emotion'] =
    analysis?.emotion ?? detectMessageEmotion(messageText).emotion ?? 'calm';

  // If the user is angry at themselves or at an outside situation, Kebo
  // should respond with concern rather than becoming angry at the user.
  // Only anger explicitly directed at Kebo should make Kebo frustrated.
  const messageEmotion: KeboState['emotion'] =
    rawMessageEmotion === 'angry' && analysis?.target !== 'kebo'
      ? 'sad'
      : rawMessageEmotion;

  const targetIsKebo = analysis?.target === 'kebo' || !analysis;

  switch (messageEmotion) {
    case 'joy':
      stats.happiness = clamp(stats.happiness + 12 * intensityFactor);
      stats.energy = clamp(stats.energy + 8 * intensityFactor);
      stats.stimulation = clamp(stats.stimulation + 4 * intensityFactor);
      stats.bond = clamp(stats.bond + 3 * intensityFactor);
      stats.annoyance = clamp(stats.annoyance - 18 * intensityFactor);
      break;
    case 'angry':
      stats.happiness = clamp(stats.happiness - 14 * intensityFactor);
      stats.energy = clamp(stats.energy - 8 * intensityFactor);
      stats.stimulation = clamp(stats.stimulation + 10 * intensityFactor);
      stats.annoyance = clamp(stats.annoyance + (targetIsKebo ? 28 : 16) * intensityFactor);
      if (targetIsKebo) stats.bond = clamp(stats.bond - 4 * intensityFactor);
      break;
    case 'sad':
      stats.happiness = clamp(stats.happiness - 12 * intensityFactor);
      stats.energy = clamp(stats.energy - 5 * intensityFactor);
      stats.stimulation = clamp(stats.stimulation + 4 * intensityFactor);
      stats.bond = clamp(stats.bond + 2 * intensityFactor);
      stats.annoyance = clamp(stats.annoyance - 4 * intensityFactor);
      break;
    case 'playful':
      stats.happiness = clamp(stats.happiness + 10 * intensityFactor);
      stats.energy = clamp(stats.energy - 4 * intensityFactor);
      stats.stimulation = clamp(stats.stimulation + 10 * intensityFactor);
      stats.bond = clamp(stats.bond + 4 * intensityFactor);
      stats.annoyance = clamp(stats.annoyance - 15 * intensityFactor);
      break;
    case 'curious':
      stats.stimulation = clamp(stats.stimulation + 14 * intensityFactor);
      stats.energy = clamp(stats.energy + 3 * intensityFactor);
      stats.happiness = clamp(stats.happiness + 4 * intensityFactor);
      stats.bond = clamp(stats.bond + 2 * intensityFactor);
      stats.annoyance = clamp(stats.annoyance - 8 * intensityFactor);
      break;
    case 'anxious':
      stats.happiness = clamp(stats.happiness - 7 * intensityFactor);
      stats.energy = clamp(stats.energy - 5 * intensityFactor);
      stats.stimulation = clamp(stats.stimulation + 10 * intensityFactor);
      stats.bond = clamp(stats.bond + 1 * intensityFactor);
      break;
    case 'tired':
      stats.happiness = clamp(stats.happiness - 3 * intensityFactor);
      stats.energy = clamp(stats.energy - 10 * intensityFactor);
      stats.stimulation = clamp(stats.stimulation - 5 * intensityFactor);
      break;
    case 'calm':
    default:
      stats.happiness = clamp(stats.happiness + 3 * intensityFactor);
      stats.energy = clamp(stats.energy + 4 * intensityFactor);
      stats.stimulation = clamp(stats.stimulation + 3 * intensityFactor);
      stats.bond = clamp(stats.bond + 1.5 * intensityFactor);
      stats.annoyance = clamp(stats.annoyance - 8 * intensityFactor);
      break;
  }

  const derivedEmotion = deriveEmotion(stats, prev.personality);

  // A message can nudge Kebo's mood, but it cannot override contradictory
  // internal state. This is what keeps the emotion badge, Vitals and artwork
  // describing the same condition.
  // A strong, clearly detected user emotion should be visible immediately.
  // Vitals still shape and persist the state, but a strong message must not be
  // hidden by a cheerful background state.
  const strongMessageSignal = Boolean(analysis) && analysis.intensity >= 0.55;

  const messageSupportsVisibleState =
    strongMessageSignal
    || (messageEmotion === 'joy' && stats.happiness >= 55 && stats.energy >= 35 && stats.annoyance < 60)
    || (messageEmotion === 'angry' && stats.annoyance >= 25)
    || (messageEmotion === 'sad' && stats.happiness <= 75)
    || (messageEmotion === 'curious' && stats.stimulation >= 55 && stats.energy >= 25)
    || (messageEmotion === 'playful' && stats.energy >= 50 && stats.happiness >= 60)
    || (messageEmotion === 'anxious' && stats.happiness <= 60 && stats.stimulation >= 50)
    || (messageEmotion === 'tired' && stats.energy <= 35);

  const emotion = messageSupportsVisibleState ? messageEmotion : derivedEmotion;

  return { stats, emotion, derivedEmotion, messageEmotion };
}

export function useKebo() {
  const [state, setState] = useState<KeboState>(loadState);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [memories, setMemories] = useState<KeboMemory[]>(loadMemories);
  const [thoughtBubble, setThoughtBubble] = useState<string | null>(null);

  const thoughtTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const thinkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestId = useRef(0);
  const abortController = useRef<AbortController | null>(null);
  const stateRef = useRef(state);
  const messagesRef = useRef(messages);
  const memoriesRef = useRef(memories);
  const remoteMemoriesLoaded = useRef(false);

  useEffect(() => {
    stateRef.current = state;
    messagesRef.current = messages;
    memoriesRef.current = memories;
  }, [state, messages, memories]);

  useEffect(() => {
    saveMemories(memories);
    if (remoteMemoriesLoaded.current) {
      void saveRemoteMemories(memories).catch((error) => console.warn('[Kebo] Remote memory save failed:', error));
    }
  }, [memories]);

  useEffect(() => {
    let active = true;
    void loadRemoteMemories()
      .then((remoteMemories) => {
        if (!active || !remoteMemories) return;
        remoteMemoriesLoaded.current = true;
        setMemories(remoteMemories);
        memoriesRef.current = remoteMemories;
      })
      .catch((error) => {
        remoteMemoriesLoaded.current = true;
        console.warn('[Kebo] Remote memory load failed; using local memory:', error);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state]);

  useEffect(() => {
    const tick = () => {
      setState((prev) => {
        const now = Date.now();
        const elapsed = now - prev.lastInteraction;
        const stats = decayStats(prev.stats, elapsed);
        // Passive stat decay should not overwrite the mood chosen by the latest interaction.
        // The next user message will recalculate the emotional response.
        return {
          ...prev,
          stats,
          emotion: prev.emotion,
          lastInteraction: now,
          activity: prev.activity === 'talking' || prev.activity === 'thinking' ? prev.activity : 'idle',
        };
      });
    };
    const interval = setInterval(tick, DECAY_TICK_MS);
    return () => clearInterval(interval);
  }, []);

  const showThought = useCallback((text: string, durationMs = 3500) => {
    if (thoughtTimer.current) clearTimeout(thoughtTimer.current);
    setThoughtBubble(text);
    thoughtTimer.current = setTimeout(() => setThoughtBubble(null), durationMs);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setState((prev) => {
        const idle = prev.activity === 'idle';
        const quiet = Date.now() - prev.lastInteraction > IDLE_THOUGHT_MS;
        if (idle && quiet && prev.stats.energy > 15) {
          const rememberedName = memoriesRef.current.find((memory) => memory.text.toLowerCase().includes("user's name"));
          const thought = rememberedName && prev.stats.bond > 35
            ? {
                text: `I was just thinking about you${rememberedName.text.match(/is ([^.]+)\./i)?.[1] ? `, ${rememberedName.text.match(/is ([^.]+)\./i)?.[1]}` : ''}. Everything feels very quiet on my side of the garden. 🌱`,
                emotion: 'joy' as const,
              }
            : idleThought(prev);
          showThought(thought.text, 4000);
          setMessages((messages) => [
            ...messages,
            { id: newId(), sender: 'kebo', text: thought.text, emotion: thought.emotion, createdAt: Date.now() },
          ]);
          return { ...prev, lastInteraction: Date.now() };
        }
        return prev;
      });
    }, IDLE_THOUGHT_MS);
    return () => clearInterval(interval);
  }, [showThought]);

  /**
   * Apply conversation impact to state, AND RETURN the new state synchronously
   * so callers (LLM) receive the updated vitals/emotion — NO stale stateRef race.
   */
  const applyConversation = useCallback(
    (intensity: number, messageText: string, analysis?: KeboEmotionAnalysis): ConversationResult => {
      const prev = stateRef.current;
      const result = computeConversationImpact(prev, intensity, messageText, analysis);
      const now = Date.now();
      const next: KeboState = {
        ...prev,
        stats: result.stats,
        emotion: result.emotion,
        lastInteraction: now,
      };
      stateRef.current = next;
      setState(next);
      return result;
    },
    []
  );

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isThinking) return;

      const userMsg: Message = {
        id: newId(),
        sender: 'user',
        text: trimmed,
        emotion: 'curious',
        createdAt: Date.now(),
      };
      setMessages((msgs) => [...msgs, userMsg]);
      const newMemoryTexts = extractMemories(trimmed);
      if (newMemoryTexts.length) {
        setMemories((existing) => {
          const next = addMemories(existing, newMemoryTexts);
          memoriesRef.current = next;
          return next;
        });
      }

      setState((prev) => {
        const next = { ...prev, activity: 'thinking' as Activity };
        stateRef.current = next;
        return next;
      });
      setIsThinking(true);

      if (thinkTimer.current) clearTimeout(thinkTimer.current);
      if (activityTimer.current) clearTimeout(activityTimer.current);

      const currentRequestId = ++requestId.current;
      abortController.current?.abort();
      const controller = new AbortController();
      abortController.current = controller;

      const isCancelled = () => currentRequestId !== requestId.current || controller.signal.aborted;

      thinkTimer.current = setTimeout(() => {
        void (async () => {
          const preAnalysisState = stateRef.current;
          let analysis: KeboEmotionAnalysis;
          try {
            analysis = await analyzeKeboMessage(trimmed, preAnalysisState.emotion, controller.signal);
          } catch {
            const fallbackEmotion = detectMessageEmotion(trimmed).emotion || preAnalysisState.emotion;
            analysis = { emotion: fallbackEmotion, intensity: 0.5, target: 'unclear', reason: 'local fallback' };
          }

          if (isCancelled()) return;

          const impact = applyConversation(Math.max(0.25, analysis.intensity), trimmed, analysis);
          const updatedState: KeboState = {
            ...stateRef.current,
            stats: impact.stats,
            emotion: impact.emotion,
          };
          stateRef.current = updatedState;

          const relevantMemories = memoryContext(memoriesRef.current, trimmed);

          let reply: { text: string; emotion: KeboState['emotion'] };
          let reasoningPlan: KeboReasoningPlan | undefined;

          try {
            const response = await askKeboLLM({
              message: trimmed,
              keboState: updatedState,
              emotion: updatedState.emotion,
              recentConversation: messagesRef.current,
              relevantMemories,
              signal: controller.signal,
            });
            reply = { text: response.text, emotion: updatedState.emotion };
            reasoningPlan = response.reasoningPlan;
            if (reasoningPlan?.memoryToUse.length) {
              const retrieved = new Set(relevantMemories);
              const remembered = reasoningPlan.memoryToUse.find((memory) => retrieved.has(memory));
              if (remembered) showThought(`Remembering: ${remembered}`, 3000);
            }
          } catch (error) {
            if (isCancelled()) return;
            console.error('[Kebo] LLM unavailable:', error instanceof Error ? error.message : error);
            reply = {
              text: "I’m having trouble reaching my language engine right now. Please try again in a moment. 🌱",
              emotion: updatedState.emotion,
            };
          }

          if (isCancelled()) return;

          const finalEmotion = updatedState.emotion;
          setState((cur) => ({ ...cur, activity: 'talking', emotion: finalEmotion }));
          setMessages((msgs) => [
            ...msgs,
            {
              id: newId(),
              sender: 'kebo',
              text: reply.text,
              emotion: finalEmotion,
              createdAt: Date.now(),
            },
          ]);
          setIsThinking(false);
          activityTimer.current = setTimeout(() => {
            setState((p) => ({ ...p, activity: 'idle' }));
          }, 2500);
        })();
      }, THINK_DELAY_MS);
    },
    [applyConversation, isThinking, showThought]
  );

  useEffect(() => {
    return () => {
      requestId.current += 1;
      abortController.current?.abort();
      if (thinkTimer.current) clearTimeout(thinkTimer.current);
      if (activityTimer.current) clearTimeout(activityTimer.current);
      if (thoughtTimer.current) clearTimeout(thoughtTimer.current);
    };
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const clearMemories = useCallback(() => {
    setMemories([]);
    memoriesRef.current = [];
    try { localStorage.removeItem('kebo-memories-v1'); } catch { /* ignore */ }
    void clearRemoteMemories().catch((error) => console.warn('[Kebo] Remote memory clear failed:', error));
  }, []);

  return {
    state,
    messages,
    isThinking,
    thoughtBubble,
    memories,
    sendMessage,
    clearMessages,
    clearMemories,
  };
}
