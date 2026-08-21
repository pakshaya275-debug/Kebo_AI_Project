import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_PERSONALITY,
  DEFAULT_STATS,
  type Activity,
  type EmotionKey,
  type KeboState,
  type Message,
} from '@/types/kebo';
import { clamp, decayStats, deriveEmotion } from '@/lib/keboEngine';
import { mockAgentRespond, idleThought } from '@/lib/mockAgent';

const STORAGE_KEY = 'kebo-state-v1';
const DECAY_TICK_MS = 15_000;       // simulate decay periodically
const IDLE_THOUGHT_MS = 45_000;     // Kebo may voice a thought when idle
const THINK_DELAY_MS = 900;         // "thinking" pause before replying

function loadState(): KeboState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as KeboState;
      const elapsed = Date.now() - parsed.lastInteraction;
      const decayed = decayStats(parsed.stats, elapsed);
      return {
        ...parsed,
        stats: decayed,
        emotion: deriveEmotion(decayed, parsed.personality),
        activity: 'idle',
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
  const lastInteractionRef = useRef(state.lastInteraction);

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
        const elapsed = Date.now() - prev.lastInteraction;
        const stats = decayStats(prev.stats, elapsed);
        const emotion = deriveEmotion(stats, prev.personality);
        return { ...prev, stats, emotion, activity: prev.activity === 'talking' || prev.activity === 'thinking' ? prev.activity : 'idle' };
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
        let stats = { ...prev.stats };
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
        lastInteractionRef.current = now;
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
      thinkTimer.current = setTimeout(() => {
        setState((cur) => {
          const reply = mockAgentRespond(cur, trimmed);
          setMessages((msgs) => [
            ...msgs,
            { id: newId(), sender: 'kebo', text: reply.text, emotion: reply.emotion, createdAt: Date.now() },
          ]);
          const emotion = reply.emotion;
          return { ...cur, activity: 'talking', emotion };
        });
        setIsThinking(false);
        // return to idle shortly after
        setTimeout(() => {
          setState((p) => ({ ...p, activity: 'idle' }));
        }, 2500);
      }, THINK_DELAY_MS);
    },
    [applyInteraction, isThinking]
  );

  const doActivity = useCallback(
    (activity: Activity) => {
      if (activity === 'playing') {
        applyInteraction('play');
        setState((p) => ({ ...p, activity: 'playing' }));
        setMessages((msgs) => [
          ...msgs,
          { id: newId(), sender: 'kebo', text: 'Wheee! That was fun. 🎉', emotion: 'playful', createdAt: Date.now() },
        ]);
        setTimeout(() => setState((p) => ({ ...p, activity: 'idle' })), 3000);
      } else if (activity === 'feeding') {
        applyInteraction('feed');
        setState((p) => ({ ...p, activity: 'idle' }));
        setMessages((msgs) => [
          ...msgs,
          { id: newId(), sender: 'kebo', text: 'Mmm, thank you. That hit the spot.', emotion: 'joy', createdAt: Date.now() },
        ]);
      } else if (activity === 'resting') {
        applyInteraction('rest');
        setState((p) => ({ ...p, activity: 'resting' }));
        setMessages((msgs) => [
          ...msgs,
          { id: newId(), sender: 'kebo', text: 'Resting now... I feel myself recharging.', emotion: 'tired', createdAt: Date.now() },
        ]);
        setTimeout(() => setState((p) => ({ ...p, activity: 'idle' })), 4000);
      }
    },
    [applyInteraction]
  );

  useEffect(() => {
    return () => {
      if (thinkTimer.current) clearTimeout(thinkTimer.current);
    };
  }, []);

  return { state, messages, isThinking, sendMessage, doActivity };
}
