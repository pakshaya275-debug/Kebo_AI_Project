import {
  EMOTIONS,
  type EmotionKey,
  type KeboState,
  type Personality,
  type RelationshipState,
  type VitalStats,
} from '../types/kebo';
import type { Appraisal, CareKind } from './appraisal';

export function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

/* ─────────────────────────── Time-based state ─────────────────────────── */

/**
 * Vitals drift as time passes. `timeScale` lets the final-review "demo speed"
 * make an hour pass in ~2 minutes so the audience can SEE Kebo get lonely,
 * hungry or sleepy. Drift is toward sensible baselines, never into a dead 0.
 */
export function decayStats(stats: VitalStats, elapsedMs: number, timeScale = 1, resting = false): VitalStats {
  const hours = (elapsedMs / 3_600_000) * timeScale;
  const hungry = stats.hunger < 15;
  return {
    energy: clamp(stats.energy + (resting ? 12 : -2.5) * hours, 0, 100),
    happiness: clamp(stats.happiness + ((50 - stats.happiness) * 0.06 - (hungry ? 3 : 0)) * hours),
    hunger: clamp(stats.hunger - 3.5 * hours),
    stimulation: clamp(stats.stimulation - 5 * hours),
    bond: clamp(stats.bond - (hours > 24 ? 0.4 : 0.1) * hours, 3, 100),
    annoyance: clamp(stats.annoyance - 14 * hours),
  };
}

/** Loneliness is derived from how long the user has been away, shaped by personality. 0..100. */
export function lonelinessOf(state: KeboState, now = Date.now(), timeScale = 1): number {
  const idleMinutes = ((now - state.lastUserMessageAt) / 60_000) * timeScale;
  const patience = state.personality.patience;
  const fullAt = 150 * (0.5 + patience); // minutes until fully lonely
  const social = 0.7 + state.personality.sociability * 0.6;
  const bondPull = 0.8 + (state.stats.bond / 100) * 0.4;
  return Math.round(clamp((idleMinutes / fullAt) * 100 * social * bondPull));
}

/* ───────────────────────────── Emotion ───────────────────────────── */

interface EmotionScore { key: EmotionKey; score: number }

/**
 * Dominant emotion from vitals + personality (the "background mood").
 * Scores are compared, so moods shift gradually instead of binary jumps.
 */
export function deriveEmotion(stats: VitalStats, personality: Personality): EmotionKey {
  const { curiosity, playfulness, sensitivity, patience, sociability, courage, affection } = personality;

  const scores: EmotionScore[] = [
    { key: 'tired', score: (100 - stats.energy) * 1.35 + (stats.hunger < 20 ? 10 : 0) - stats.stimulation * 0.18 },
    { key: 'angry', score: stats.annoyance * 1.3 + (100 - stats.happiness) * 0.15 - patience * 14 - affection * 6 },
    { key: 'sad', score: (100 - stats.happiness) * 0.95 + (100 - stats.bond) * 0.1 + (stats.hunger < 20 ? 10 : 0) + sensitivity * 8 },
    { key: 'anxious', score: stats.stimulation * 0.3 + (100 - stats.happiness) * 0.4 + sensitivity * 10 - courage * 12 - stats.annoyance * 0.1 },
    { key: 'curious', score: stats.stimulation * 0.62 + stats.energy * 0.14 + curiosity * 18 - stats.annoyance * 0.3 },
    { key: 'playful', score: stats.happiness * 0.45 + stats.energy * 0.5 + stats.stimulation * 0.25 + playfulness * 14 + sociability * 4 - stats.annoyance * 0.5 },
    { key: 'joy', score: stats.happiness * 0.8 + stats.bond * 0.2 + stats.energy * 0.15 + affection * 8 - stats.annoyance * 0.6 },
    { key: 'calm', score: 58 + (100 - stats.annoyance) * 0.18 + stats.happiness * 0.12 + stats.bond * 0.08 + (100 - stats.stimulation) * 0.12 + patience * 8 - sensitivity * 4 },
  ];
  scores.sort((a, b) => b.score - a.score);
  const [top, second] = scores;

  // Hard boundaries: a cheerful face must not survive genuine exhaustion/anger/misery.
  if (stats.energy <= 15) return 'tired';
  if (stats.annoyance >= 75) return 'angry';
  if (stats.happiness <= 20) return 'sad';

  if (top.score - second.score < 4) {
    if (top.key === 'joy' && second.key === 'playful') return stats.energy >= 55 ? 'playful' : 'joy';
    if (top.key === 'curious' && second.key === 'calm') return stats.stimulation >= 62 ? 'curious' : 'calm';
    if (top.key === 'angry' && second.key === 'sad') return stats.annoyance >= 45 ? 'angry' : 'sad';
  }
  return top.key;
}

export function emotionIntensity(stats: VitalStats, key: EmotionKey): number {
  void EMOTIONS[key];
  const energyFactor = stats.energy / 100;
  const reactivity = 0.5 + (100 - stats.energy) / 200;
  return clamp(0.3 + energyFactor * 0.5 * reactivity, 0, 1);
}

/* ───────────────────── Conversation → state change ───────────────────── */

export interface StateChange {
  stats: VitalStats;
  emotion: EmotionKey;
  emotionUntil: number;
  derivedEmotion: EmotionKey;
}

type Delta = Partial<Record<keyof VitalStats, number>>;

/** Raw vitals deltas for each situation, before personality scaling. */
function baseDelta(a: Appraisal): Delta {
  switch (a.kind) {
    case 'insult':          return { happiness: -12, annoyance: 22, bond: -3, energy: -3, stimulation: 6 };
    case 'reported_insult': return { happiness: -4, bond: 2.5, stimulation: 4, annoyance: 2 };
    case 'praise':          return { happiness: 10, bond: 3, annoyance: -15, energy: 4, stimulation: 3 };
    case 'apology':         return { annoyance: -25, happiness: 4, bond: 1.5 };
    case 'distress':        return { happiness: -5, bond: 2, stimulation: 4, energy: -2 };
    case 'user_anger':      return { happiness: -3, stimulation: 6, bond: 1 };
    case 'celebration':     return { happiness: 10, energy: 6, bond: 2.5, annoyance: -10, stimulation: 4 };
    case 'playful':         return { happiness: 9, energy: -3, stimulation: 9, bond: 3, annoyance: -12 };
    case 'question':        return { stimulation: 10, happiness: 2, bond: 1, annoyance: -4 };
    case 'greeting':        return { happiness: 3, bond: 1.5, annoyance: -3, stimulation: 2 };
    case 'request_quiet':   return { stimulation: -12, energy: 2, happiness: -2, annoyance: -2 };
    case 'care':            return { happiness: 6, bond: 2, annoyance: -8 };
    case 'tired':           return { energy: -2, stimulation: -3, bond: 1.5 };
    case 'smalltalk':
    default:                return { happiness: 1, stimulation: 2, bond: 0.8, annoyance: -2 };
  }
}

/** Personality changes how strongly each event lands. */
function scaleDelta(delta: Delta, a: Appraisal, p: Personality): Delta {
  const strength = 0.55 + a.intensity * 0.75;
  const out: Delta = {};
  for (const [key, raw] of Object.entries(delta) as [keyof VitalStats, number][]) {
    let value = raw * strength;
    if (key === 'happiness' && raw < 0) value *= 0.7 + p.sensitivity * 0.7;        // sensitive => hurts more
    if (key === 'annoyance' && raw > 0) value *= 1.35 - p.patience * 0.8;           // patient => slower to anger
    if (key === 'bond' && raw > 0) value *= 0.7 + p.affection * 0.7;                // affectionate => bonds faster
    if (key === 'stimulation' && raw > 0) value *= 0.7 + p.curiosity * 0.6;         // curious => more stimulated
    if (key === 'happiness' && raw > 0 && a.kind === 'playful') value *= 0.8 + p.playfulness * 0.5;
    out[key] = value;
  }
  return out;
}

const PULSE_MS = 90_000;

/**
 * The single place conversation turns into state:
 *   appraisal -> scaled vitals deltas -> (gradual) vitals -> emotion.
 * The expressed emotion is the appraisal's emotion for a short pulse when the
 * signal is strong; otherwise (and once the pulse expires) it follows vitals.
 */
export function applyAppraisal(prev: KeboState, a: Appraisal, now = Date.now()): StateChange {
  const delta = scaleDelta(baseDelta(a), a, prev.personality);
  const stats = { ...prev.stats };
  for (const [key, value] of Object.entries(delta) as [keyof VitalStats, number][]) {
    stats[key] = clamp(stats[key] + value);
  }

  const derivedEmotion = deriveEmotion(stats, prev.personality);
  const strongSignal = a.confidence >= 0.6 && (a.intensity >= 0.5 || a.kind === 'insult' || a.kind === 'reported_insult' || a.kind === 'praise');
  let emotion = strongSignal ? a.keboEmotion : derivedEmotion;

  // Vitals can override the pulse when they are extreme (accumulated hurt => anger).
  if (stats.annoyance >= 60 && a.kind === 'insult') emotion = 'angry';
  if (stats.energy <= 15) emotion = 'tired';

  return {
    stats,
    emotion,
    emotionUntil: strongSignal ? now + PULSE_MS : now,
    derivedEmotion,
  };
}

/* ─────────────────────────────── Care ─────────────────────────────── */

export type CareAction = CareKind | 'play' | 'rest';

export function applyCare(prev: KeboState, action: CareAction, now = Date.now()): StateChange {
  const s = { ...prev.stats };
  switch (action) {
    case 'feed':  s.hunger = clamp(s.hunger + 35); s.happiness = clamp(s.happiness + 5); s.energy = clamp(s.energy + 5); s.bond = clamp(s.bond + 1.5); break;
    case 'water': s.hunger = clamp(s.hunger + 20); s.happiness = clamp(s.happiness + 6); s.energy = clamp(s.energy + 4); s.bond = clamp(s.bond + 1.5); break;
    case 'sun':   s.energy = clamp(s.energy + 18); s.happiness = clamp(s.happiness + 8); s.hunger = clamp(s.hunger + 8); s.bond = clamp(s.bond + 1); break;
    case 'play':  s.happiness = clamp(s.happiness + 10); s.stimulation = clamp(s.stimulation + 20); s.energy = clamp(s.energy - 8); s.hunger = clamp(s.hunger - 4); s.bond = clamp(s.bond + 3); s.annoyance = clamp(s.annoyance - 10); break;
    case 'rest':  s.energy = clamp(s.energy + 25); s.stimulation = clamp(s.stimulation - 10); s.annoyance = clamp(s.annoyance - 8); s.bond = clamp(s.bond + 0.5); break;
  }
  const derivedEmotion = deriveEmotion(s, prev.personality);
  const pulse: EmotionKey = action === 'play' ? 'playful' : action === 'rest' ? 'calm' : 'joy';
  return { stats: s, emotion: s.energy <= 15 ? 'tired' : pulse, emotionUntil: now + 45_000, derivedEmotion };
}

/* ──────────────────────────── Relationship ──────────────────────────── */

export function localDay(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const RELATIONSHIP_LEVELS = [
  { min: 0, label: 'Strangers', blurb: 'Kebo is still getting to know you.' },
  { min: 15, label: 'Acquaintances', blurb: 'Kebo recognises you and feels at ease.' },
  { min: 35, label: 'Friends', blurb: 'Kebo looks forward to talking with you.' },
  { min: 60, label: 'Close friends', blurb: 'Kebo trusts you and misses you when you are away.' },
  { min: 82, label: 'Best friends', blurb: 'Kebo feels truly connected to you.' },
] as const;

export function relationshipLevel(bond: number) {
  let level: (typeof RELATIONSHIP_LEVELS)[number] = RELATIONSHIP_LEVELS[0];
  for (const candidate of RELATIONSHIP_LEVELS) if (bond >= candidate.min) level = candidate;
  const idx = RELATIONSHIP_LEVELS.indexOf(level);
  const next = RELATIONSHIP_LEVELS[idx + 1] ?? null;
  return { ...level, index: idx, next };
}

function addMilestone(rel: RelationshipState, id: string, label: string, at: number): RelationshipState {
  if (rel.milestones.some((m) => m.id === id)) return rel;
  return { ...rel, milestones: [...rel.milestones, { id, label, at }] };
}

/** Counters, streak and milestones. Pure: returns a new RelationshipState. */
export function updateRelationship(
  rel: RelationshipState,
  a: Appraisal | null,
  bond: number,
  now = Date.now(),
  opts: { care?: boolean; memoryCount?: number } = {},
): RelationshipState {
  let next: RelationshipState = { ...rel };
  const today = localDay(now);

  if (a) {
    next.totalMessages += 1;
    if (a.valence > 0.2 || a.kind === 'celebration') next.positiveInteractions += 1;
    if (a.kind === 'insult') next.negativeInteractions += 1;
    if (a.kind === 'distress') next.comfortCount += 1;

    if (next.lastActiveDay !== today) {
      const yesterday = localDay(now - 86_400_000);
      next.streakDays = next.lastActiveDay === yesterday ? next.streakDays + 1 : 1;
      next.lastActiveDay = today;
    }
  }
  if (opts.care) next.careCount += 1;

  if (next.totalMessages >= 1) next = addMilestone(next, 'first-chat', 'First conversation', now);
  if (next.totalMessages >= 10) next = addMilestone(next, 'msgs-10', '10 messages shared', now);
  if (next.totalMessages >= 50) next = addMilestone(next, 'msgs-50', '50 messages shared', now);
  if (next.totalMessages >= 100) next = addMilestone(next, 'msgs-100', '100 messages shared', now);
  if (next.comfortCount >= 1) next = addMilestone(next, 'first-comfort', 'Kebo comforted you for the first time', now);
  if (next.careCount >= 1) next = addMilestone(next, 'first-care', 'You took care of Kebo for the first time', now);
  if (next.streakDays >= 3) next = addMilestone(next, 'streak-3', '3-day streak of visiting Kebo', now);
  if (next.streakDays >= 7) next = addMilestone(next, 'streak-7', 'A whole week together', now);
  if (bond >= 35) next = addMilestone(next, 'bond-friends', 'Became friends', now);
  if (bond >= 60) next = addMilestone(next, 'bond-close', 'Became close friends', now);
  if (bond >= 82) next = addMilestone(next, 'bond-best', 'Became best friends', now);
  if ((opts.memoryCount ?? 0) >= 1) next = addMilestone(next, 'first-memory', 'Kebo remembered something about you', now);
  if ((opts.memoryCount ?? 0) >= 10) next = addMilestone(next, 'memory-10', 'Kebo knows 10 things about you', now);
  return next;
}
