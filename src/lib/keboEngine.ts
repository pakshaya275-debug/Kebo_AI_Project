import {
  EMOTIONS,
  type EmotionKey,
  type KeboState,
  type VitalStats,
} from '@/types/kebo';

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
  };
  return {
    energy: clamp(stats.energy + driftPerHour.energy * hours),
    happiness: clamp(stats.happiness + driftPerHour.happiness * hours),
    hunger: clamp(stats.hunger + driftPerHour.hunger * hours),
    stimulation: clamp(stats.stimulation + driftPerHour.stimulation * hours),
    bond: clamp(stats.bond + driftPerHour.bond * hours),
  };
}

interface EmotionScore {
  key: EmotionKey;
  score: number;
}

/**
 * Derives the dominant emotion from vital stats and personality.
 * Each emotion has a weighted pull based on stats.
 */
export function deriveEmotion(
  stats: VitalStats,
  personality: KeboState['personality']
): EmotionKey {
  const scores: EmotionScore[] = [
    { key: 'joy',      score: stats.happiness * 0.7 + stats.bond * 0.3 },
    { key: 'calm',     score: (stats.energy > 40 ? 45 : 10) + (100 - personality.neuroticism * 100) * 0.3 },
    { key: 'curious',  score: stats.stimulation * 0.6 + personality.openness * 40 },
    { key: 'playful',  score: stats.energy * 0.4 + stats.happiness * 0.3 + personality.extraversion * 30 },
    { key: 'tired',    score: (100 - stats.energy) * 1.2 },
    { key: 'sad',      score: (100 - stats.happiness) * 0.6 + (100 - stats.bond) * 0.2 },
    { key: 'anxious',  score: (100 - stats.stimulation) * 0.3 + personality.neuroticism * 35 },
    { key: 'angry',    score: (100 - stats.happiness) * 0.3 + personality.neuroticism * 20 - personality.agreeableness * 30 },
  ];

  scores.sort((a, b) => b.score - a.score);
  return scores[0].key;
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
