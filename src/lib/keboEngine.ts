import {
  EMOTIONS,
  type EmotionKey,
  type KeboState,
  type VitalStats,
} from '../types/kebo';

/**
 * Clamp a number between min and max.
 */
export function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Decays all vital stats toward their natural drift as time passes.
 * Called periodically to simulate "living" state.
 */
export function decayStats(
  stats: VitalStats,
  elapsedMs: number
): VitalStats {
  const hours = elapsedMs / 1000 / 60 / 60;
  const driftPerHour = {
    energy: -4,      // gets tired
    happiness: -2,   // slowly less happy without interaction
    hunger: -5,      // gets hungry
    stimulation: -6, // gets bored
    bond: -1,        // bond slowly fades without contact
    annoyance: -12,  // irritation settles over time
  };
  return {
    energy: clamp(stats.energy + driftPerHour.energy * hours),
    happiness: clamp(stats.happiness + driftPerHour.happiness * hours),
    hunger: clamp(stats.hunger + driftPerHour.hunger * hours),
    stimulation: clamp(stats.stimulation + driftPerHour.stimulation * hours),
    bond: clamp(stats.bond + driftPerHour.bond * hours),
    annoyance: clamp(stats.annoyance + driftPerHour.annoyance * hours),
  };
}

interface EmotionScore {
  key: EmotionKey;
  score: number;
}

const MESSAGE_EMOTION_KEYWORDS: Record<EmotionKey, string[]> = {
  joy: ['amazing', 'awesome', 'excellent', 'great', 'good', 'happy', 'love', 'proud', 'brilliant', 'wonderful', 'fantastic', 'beautiful', 'excited', 'thanks', 'thank you', 'sorry', 'apologize', 'apology', 'forgive', 'hey', 'hello', 'hi'],
  sad: ['sad', 'unhappy', 'hurt', 'lonely', 'cry', 'crying', 'upset', 'heartbroken', 'bad day', 'disappointed', 'not good', 'terrible day'],
  angry: ['hate', 'angry', 'mad', 'annoying', 'stupid', 'useless', 'shut up', 'idiot', 'ugly', 'worst', "don't like", 'dont like', 'do not like'],
  curious: ['why', 'how', 'what', 'interesting', 'curious', 'tell me', 'explain', 'learn'],
  calm: [],
  playful: ['goof', 'goofy', 'funny', 'lol', 'haha', 'chuckle'],
  tired: [],
  anxious: [],
};

const NEGATION_WORDS = new Set(['not', 'no', "don't", 'dont', 'do not', "isn't", 'isnt', 'never', 'hardly']);

function isNegated(text: string, matchIndex: number): boolean {
  const before = text.slice(Math.max(0, matchIndex - 24), matchIndex);
  return before.split(/\s+/).some((word) => NEGATION_WORDS.has(word.replace(/[.,!?]/g, '')));
}

/** Scores emotional signals in a message before the LLM is called. */
export function detectMessageEmotion(text: string): { emotion: EmotionKey | null; scores: Record<EmotionKey, number> } {
  const lower = text.toLowerCase().trim();
  const scores = Object.fromEntries(Object.keys(EMOTIONS).map((key) => [key, 0])) as Record<EmotionKey, number>;

  for (const [emotion, keywords] of Object.entries(MESSAGE_EMOTION_KEYWORDS) as [EmotionKey, string[]][]) {
    for (const keyword of keywords) {
      const pattern = keyword.includes(' ') ? keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : `\\b${keyword}\\b`;
      const match = new RegExp(pattern, 'i').exec(lower);
      const isExplicitSentimentPhrase = keyword.includes(' ') && (
        keyword.startsWith("don't ")
        || keyword.startsWith('dont ')
        || keyword.startsWith('do not ')
        || keyword.startsWith('not ')
        || keyword.includes(' day')
      );
      if (match && (isExplicitSentimentPhrase || !isNegated(lower, match.index))) {
        scores[emotion] += keyword.includes(' ') ? 2 : 1;
      }
    }
  }

  const [emotion, score] = (Object.entries(scores) as [EmotionKey, number][])
    .sort(([, left], [, right]) => right - left)[0];
  return { emotion: score > 0 ? emotion : null, scores };
}

/**
 * Derives the dominant emotion from vital stats and personality.
 * Emotions are compared by score — no single stat instantly wins.
 * This gives smooth, gradual transitions instead of binary jumps.
 */
export function deriveEmotion(
  stats: VitalStats,
  personality: KeboState['personality']
): EmotionKey {
  // Personality adjusts how strongly Kebo expresses a state, but vitals remain
  // the primary source of the dominant emotion.
  const openness = personality.openness * 12;
  const extraversion = personality.extraversion * 10;
  const neuroticism = personality.neuroticism * 14;
  const agreeableness = personality.agreeableness * 10;

  const scores: EmotionScore[] = [
    {
      key: 'tired',
      score:
        (100 - stats.energy) * 1.35
        + (stats.hunger < 25 ? 12 : 0)
        - stats.stimulation * 0.18,
    },
    {
      key: 'angry',
      score:
        stats.annoyance * 1.25
        + (100 - stats.happiness) * 0.18
        + neuroticism
        - agreeableness * 0.45,
    },
    {
      key: 'sad',
      score:
        (100 - stats.happiness) * 0.9
        + (100 - stats.bond) * 0.12
        + (stats.hunger < 20 ? 12 : 0)
        + neuroticism * 0.45,
    },
    {
      key: 'anxious',
      score:
        stats.stimulation * 0.48
        + (100 - stats.happiness) * 0.45
        + neuroticism * 0.8
        - stats.annoyance * 0.12,
    },
    {
      key: 'curious',
      score:
        stats.stimulation * 0.72
        + stats.energy * 0.16
        + openness
        - stats.annoyance * 0.3,
    },
    {
      key: 'playful',
      score:
        stats.happiness * 0.5
        + stats.energy * 0.55
        + stats.stimulation * 0.3
        + extraversion
        - stats.annoyance * 0.45,
    },
    {
      key: 'joy',
      score:
        stats.happiness * 0.78
        + stats.bond * 0.2
        + stats.energy * 0.2
        + extraversion
        - stats.annoyance * 0.55,
    },
    {
      key: 'calm',
      score:
        58
        + (100 - stats.annoyance) * 0.18
        + stats.happiness * 0.12
        + stats.bond * 0.08
        + (100 - stats.stimulation) * 0.12
        + agreeableness * 0.2
        - neuroticism * 0.25,
    },
  ];

  scores.sort((a, b) => b.score - a.score);
  const [top, second] = scores;

  // Hard state boundaries prevent a cheerful expression from surviving when
  // Kebo is genuinely exhausted, highly annoyed, or very unhappy.
  if (stats.energy <= 18) return 'tired';
  if (stats.annoyance >= 78) return 'angry';
  if (stats.happiness <= 22) return 'sad';

  const tie = top.score - second.score < 4;
  if (tie) {
    if (top.key === 'joy' && second.key === 'playful') return stats.energy >= 55 ? 'playful' : 'joy';
    if (top.key === 'curious' && second.key === 'calm') return stats.stimulation >= 62 ? 'curious' : 'calm';
    if (top.key === 'tired' && (second.key === 'sad' || second.key === 'calm')) return 'tired';
    if (top.key === 'angry' && second.key === 'sad') return stats.annoyance >= 45 ? 'angry' : 'sad';
  }

  return top.key;
}

export function emotionIntensity(
  stats: VitalStats,
  key: EmotionKey
): number {
  // 0..1 how strongly the current emotion is expressed
  const e = EMOTIONS[key];
  void e;
  const energyFactor = stats.energy / 100;
  const reactivity = 0.5 + (100 - stats.energy) / 200; // tired = flatter
  return clamp(0.3 + energyFactor * 0.5 * reactivity, 0, 1);
}
