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
  curiosity: number;    // 0..1  explores, asks questions, investigates
  playfulness: number;  // 0..1  suggests games, energetic behaviour
  sensitivity: number;  // 0..1  reacts strongly to emotional events
  patience: number;     // 0..1  loneliness / annoyance build more slowly
  sociability: number;  // 0..1  initiates interaction more often
  courage: number;      // 0..1  less anxious, bolder exploration
  affection: number;    // 0..1  bonds faster, warmer tone
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
  /** True when Kebo started this message on its own (agent), not as a reply. */
  autonomous?: boolean;
}

export interface Milestone {
  id: string;
  label: string;
  at: number;
}

export interface RelationshipState {
  firstMetAt: number;
  totalMessages: number;
  positiveInteractions: number;
  negativeInteractions: number;
  comfortCount: number;
  careCount: number;
  streakDays: number;
  lastActiveDay: string; // YYYY-MM-DD (local)
  milestones: Milestone[];
}

export interface KeboState {
  emotion: EmotionKey;
  /** Epoch ms until which the conversational emotion pulse is held; afterwards emotion follows vitals. */
  emotionUntil: number;
  stats: VitalStats;
  personality: Personality;
  activity: Activity;
  lastInteraction: number;
  /** Last time the user actually spoke (lastInteraction is also bumped by passive ticks). */
  lastUserMessageAt: number;
  relationship: RelationshipState;
}

export type AgentActionType =
  | 'WAIT'
  | 'SEND_MESSAGE'
  | 'ASK_QUESTION'
  | 'REQUEST_ATTENTION'
  | 'PLAY'
  | 'EXPLORE'
  | 'REST'
  | 'REFERENCE_MEMORY'
  | 'CHANGE_ACTIVITY';

export interface ActivityEntry {
  id: string;
  at: number;
  kind: 'autonomous' | 'care' | 'emotion' | 'memory' | 'system';
  action?: AgentActionType;
  text: string;
  reason?: string;
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
  curiosity: 0.82,
  playfulness: 0.75,
  sensitivity: 0.68,
  patience: 0.42,
  sociability: 0.61,
  courage: 0.57,
  affection: 0.8,
};

export const PERSONALITY_TRAITS: { key: keyof Personality; label: string; hint: string }[] = [
  { key: 'curiosity', label: 'Curiosity', hint: 'Explores, asks questions, starts conversations' },
  { key: 'playfulness', label: 'Playfulness', hint: 'Suggests games and acts energetic' },
  { key: 'sensitivity', label: 'Sensitivity', hint: 'Reacts more strongly to emotional moments' },
  { key: 'patience', label: 'Patience', hint: 'Loneliness and annoyance build more slowly' },
  { key: 'sociability', label: 'Sociability', hint: 'Reaches out to you more often' },
  { key: 'courage', label: 'Courage', hint: 'Less anxious, bolder when exploring' },
  { key: 'affection', label: 'Affection', hint: 'Bonds faster and sounds warmer' },
];

export function createRelationship(now = Date.now()): RelationshipState {
  return {
    firstMetAt: now,
    totalMessages: 0,
    positiveInteractions: 0,
    negativeInteractions: 0,
    comfortCount: 0,
    careCount: 0,
    streakDays: 0,
    lastActiveDay: '',
    milestones: [],
  };
}

export const DEFAULT_STATS: VitalStats = {
  energy: 78,
  happiness: 70,
  bond: 20,
  hunger: 65,
  stimulation: 55,
  annoyance: 0,
};
