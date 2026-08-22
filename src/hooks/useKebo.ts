import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_PERSONALITY,
  DEFAULT_STATS,
  EMOTIONS,
  type Activity,
  type KeboState,
  type Message,
} from '../types/kebo';
import { clamp, decayStats, deriveEmotion } from '../lib/keboEngine';
import { mockAgentRespond, idleThought } from '../lib/mockAgent';
import { askKeboLLM } from '../lib/llmAgent';

const STORAGE_KEY = 'kebo-state-v1';
const DECAY_TICK_MS = 15_000;       // simulate decay periodically
const IDLE_THOUGHT_MS = 45_000;     // Kebo may voice a thought when idle
const THINK_DELAY_MS = 900;         // "thinking" pause before replying

function isValidState(value: unknown): value is KeboState {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<KeboState>;
  const stats = candidate.stats;
  const personality = candidate.personality;
  const statKeys = ['energy', 'happiness', 'bond', 'hunger', 'stimulation'] as const;
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
      const decayed = decayStats(parsed.stats, elapsed);
      const now = Date.now();
      return {
        ...parsed,
        stats: decayed,
        emotion: deriveEmotion(decayed, parsed.personality),
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

export function useKebo() {
  const [state, setState] = useState<KeboState>(loadState);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const thinkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestId = useRef(0);
  const abortController = useRef<AbortController | null>(null);
  const stateRef = useRef(state);
  const messagesRef = useRef(messages);

  useEffect(() => {
    stateRef.current = state;
    messagesRef.current = messages;
  }, [state, messages]);

  // persist
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state]);

  // living decay tick
  useEffect(() => {
    const tick = () => {
      setState((prev) => {
        const now = Date.now();
        const elapsed = now - prev.lastInteraction;
        const stats = decayStats(prev.stats, elapsed);
        const emotion = deriveEmotion(stats, prev.personality);
        return {
          ...prev,
          stats,
          emotion,
          lastInteraction: now,
          activity: prev.activity === 'talking' || prev.activity === 'thinking' ? prev.activity : 'idle',
        };
      });
    };
    const interval = setInterval(tick, DECAY_TICK_MS);
    return () => clearInterval(interval);
  }, []);

  // idle thoughts
  useEffect(() => {
    const interval = setInterval(() => {
      setState((prev) => {
        const idle = prev.activity === 'idle';
        const quiet = Date.now() - prev.lastInteraction > IDLE_THOUGHT_MS;
        if (idle && quiet && prev.stats.energy > 15) {
          const thought = idleThought(prev);
          setMessages((msgs) => [
            ...msgs,
            { id: newId(), sender: 'kebo', text: thought.text, emotion: thought.emotion, createdAt: Date.now() },
          ]);
        }
        return prev;
      });
    }, IDLE_THOUGHT_MS);
    return () => clearInterval(interval);
  }, []);

  const applyInteraction = useCallback(
    (kind: 'message' | 'play' | 'feed' | 'rest', intensity = 1) => {
      setState((prev) => {
        const now = Date.now();
        const stats = { ...prev.stats };
        if (kind === 'message') {
          stats.energy = clamp(stats.energy - 2 * intensity);
          stats.happiness = clamp(stats.happiness + 3 * intensity);
          stats.stimulation = clamp(stats.stimulation + 8 * intensity);
          stats.bond = clamp(stats.bond + 2.5 * intensity);
        } else if (kind === 'play') {
          stats.energy = clamp(stats.energy - 10 * intensity);
          stats.happiness = clamp(stats.happiness + 8 * intensity);
          stats.stimulation = clamp(stats.stimulation + 15 * intensity);
          stats.bond = clamp(stats.bond + 4 * intensity);
        } else if (kind === 'feed') {
          stats.hunger = clamp(stats.hunger + 35 * intensity);
          stats.happiness = clamp(stats.happiness + 5 * intensity);
          stats.energy = clamp(stats.energy + 8 * intensity);
        } else if (kind === 'rest') {
          stats.energy = clamp(stats.energy + 30 * intensity);
          stats.happiness = clamp(stats.happiness + 2 * intensity);
        }
        const emotion = deriveEmotion(stats, prev.personality);
        return { ...prev, stats, emotion, lastInteraction: now };
      });
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

      setState((prev) => ({ ...prev, activity: 'thinking' }));
      setIsThinking(true);
      applyInteraction('message');

      if (thinkTimer.current) clearTimeout(thinkTimer.current);
      if (activityTimer.current) clearTimeout(activityTimer.current);
      const currentRequestId = ++requestId.current;
      abortController.current?.abort();
      const controller = new AbortController();
      abortController.current = controller;
      thinkTimer.current = setTimeout(() => {
        void (async () => {
          const currentState = stateRef.current;
          let reply: { text: string; emotion: typeof currentState.emotion };
          try {
            const text = await askKeboLLM({
              message: trimmed,
              keboState: currentState,
              emotion: currentState.emotion,
              recentConversation: messagesRef.current,
              signal: controller.signal,
            });
            reply = { text, emotion: currentState.emotion };
          } catch (error) {
            if (currentRequestId !== requestId.current) return;
            console.warn('Using Kebo mock fallback:', error);
            const fallback = mockAgentRespond(currentState, trimmed);
            reply = fallback;
          }

          if (currentRequestId !== requestId.current) return;
          setState((cur) => ({ ...cur, activity: 'talking', emotion: reply.emotion }));
          setMessages((msgs) => [
            ...msgs,
            { id: newId(), sender: 'kebo', text: reply.text, emotion: reply.emotion, createdAt: Date.now() },
          ]);
          setIsThinking(false);
          activityTimer.current = setTimeout(() => {
            setState((p) => ({ ...p, activity: 'idle' }));
          }, 2500);
        })();
      }, THINK_DELAY_MS);
    },
    [applyInteraction, isThinking]
  );

  const doActivity = useCallback(
    (activity: Activity) => {
      requestId.current += 1;
      abortController.current?.abort();
      if (thinkTimer.current) clearTimeout(thinkTimer.current);
      setIsThinking(false);
      if (activityTimer.current) clearTimeout(activityTimer.current);
      if (activity === 'playing') {
        applyInteraction('play');
        setState((p) => ({ ...p, activity: 'playing' }));
        setMessages((msgs) => [
          ...msgs,
          { id: newId(), sender: 'kebo', text: 'Wheee! That was fun. 🎉', emotion: 'playful', createdAt: Date.now() },
        ]);
        activityTimer.current = setTimeout(() => setState((p) => ({ ...p, activity: 'idle' })), 3000);
      } else if (activity === 'feeding') {
        applyInteraction('feed');
        setState((p) => ({ ...p, activity: 'feeding' }));
        setMessages((msgs) => [
          ...msgs,
          { id: newId(), sender: 'kebo', text: 'Mmm, thank you. That hit the spot.', emotion: 'joy', createdAt: Date.now() },
        ]);
        activityTimer.current = setTimeout(() => setState((p) => ({ ...p, activity: 'idle' })), 1500);
      } else if (activity === 'resting') {
        applyInteraction('rest');
        setState((p) => ({ ...p, activity: 'resting' }));
        setMessages((msgs) => [
          ...msgs,
          { id: newId(), sender: 'kebo', text: 'Resting now... I feel myself recharging.', emotion: 'tired', createdAt: Date.now() },
        ]);
        activityTimer.current = setTimeout(() => setState((p) => ({ ...p, activity: 'idle' })), 4000);
      }
    },
    [applyInteraction]
  );

  useEffect(() => {
    return () => {
      requestId.current += 1;
      abortController.current?.abort();
      if (thinkTimer.current) clearTimeout(thinkTimer.current);
      if (activityTimer.current) clearTimeout(activityTimer.current);
    };
  }, []);

  return { state, messages, isThinking, sendMessage, doActivity };
}
