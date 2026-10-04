export type EmotionKey =
  | 'joy'
  | 'calm'
  | 'curious'
  | 'sad'
  | 'angry'
  | 'anxious'
  | 'tired'
  | 'playful';

export type EmotionVisualKey =
  | EmotionKey
  | 'surprised'
  | 'low_energy'
  | 'happy';

export interface Emotion {
  key: EmotionKey;
  label: string;
  emoji: string;
  color: string;       // primary accent for this mood
  colorSoft: string;   // soft background tint
  artKey: EmotionVisualKey;
}

export interface Personality {
  openness: number;        // 0..1  curiosity / novelty seeking
  conscientiousness: number; // 0..1  focus / orderliness
  extraversion: number;    // 0..1  sociability / energy from interaction
  agreeableness: number;   // 0..1  warmth / cooperation
  neuroticism: number;     // 0..1  emotional reactivity / sensitivity
}

export interface VitalStats {
  energy: number;      // 0..100  stamina / fatigue
  happiness: number;   // 0..100  mood baseline
  bond: number;        // 0..100  connection with the user
  hunger: number;      // 0..100  fullness (high = full, low = hungry)
  stimulation: number; // 0..100  mental engagement / boredom (low = bored)
  annoyance: number;    // 0..100  irritation caused by hurtful interactions
}

export type Sender = 'kebo' | 'user';

export interface Message {
  id: string;
  sender: Sender;
  text: string;
  emotion: EmotionKey;
  createdAt: number;
}

export interface KeboState {
  emotion: EmotionKey;
  stats: VitalStats;
  personality: Personality;
  activity: Activity;
  lastInteraction: number;
}

export type Activity =
  | 'idle'
  | 'talking'
  | 'thinking'
  | 'resting'
  | 'playing'
  | 'feeding'
  | 'exploring';

export const EMOTIONS: Record<EmotionKey, Emotion> = {
  joy:      { key: 'joy',      label: 'Joyful',     emoji: '😊', color: '#f59e0b', colorSoft: '#fef3c7', artKey: 'happy' },
  calm:     { key: 'calm',     label: 'Calm',        emoji: '😌', color: '#14b8a6', colorSoft: '#ccfbf1', artKey: 'calm' },
  curious:  { key: 'curious',  label: 'Curious',     emoji: '🤔', color: '#3b82f6', colorSoft: '#dbeafe', artKey: 'curious' },
  sad:      { key: 'sad',      label: 'Sad',         emoji: '😢', color: '#64748b', colorSoft: '#e2e8f0', artKey: 'sad' },
  angry:    { key: 'angry',    label: 'Frustrated',  emoji: '😤', color: '#ef4444', colorSoft: '#fee2e2', artKey: 'angry' },
  anxious:  { key: 'anxious',  label: 'Anxious',     emoji: '😟', color: '#a855f7', colorSoft: '#f3e8ff', artKey: 'surprised' },
  tired:    { key: 'tired',    label: 'Tired',       emoji: '😴', color: '#10b981', colorSoft: '#d1fae5', artKey: 'low_energy' },
  playful:  { key: 'playful',  label: 'Playful',     emoji: '😆', color: '#ec4899', colorSoft: '#fce7f3', artKey: 'happy' },
};

export const DEFAULT_PERSONALITY: Personality = {
  openness: 0.72,
  conscientiousness: 0.55,
  extraversion: 0.6,
  agreeableness: 0.8,
  neuroticism: 0.35,
};

export const DEFAULT_STATS: VitalStats = {
  energy: 78,
  happiness: 70,
  bond: 20,
  hunger: 65,
  stimulation: 55,
  annoyance: 0,
};
