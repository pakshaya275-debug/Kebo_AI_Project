import type { AgentActionType, Activity, KeboState } from '../types/kebo';
import { lonelinessOf } from './keboEngine';
import { eventTopic, pendingFollowUps, type KeboMemory } from './memory';
import type { AutonomyLevel, KeboSettings } from './settings';
import { timeScaleOf } from './settings';

/**
 * Kebo's controlled agent loop:  OBSERVE -> REMEMBER -> EVALUATE -> DECIDE -> ACT.
 *
 * It scores every possible action from vitals, personality, loneliness and
 * memories, then picks one. Messages (the only actions that can disturb the
 * user) pass through strict gates: autonomy setting, cool-down, "user asked for
 * quiet", unanswered-message cap and Kebo's own mood (an annoyed Kebo sulks
 * instead of pestering). Everything is deterministic given its inputs, so it is
 * unit-testable.
 */

export interface AgentContext {
  state: KeboState;
  memories: KeboMemory[];
  settings: KeboSettings;
  now: number;
  /** Epoch ms of the last Kebo-initiated *message*. */
  lastAutonomousMessageAt: number;
  /** Epoch ms of the last non-message autonomous action. */
  lastAutonomousActionAt: number;
  /** Kebo-initiated messages the user has not answered yet. */
  unansweredAutonomous: number;
  /** User asked for quiet until this time. */
  quietUntil: number;
}

export interface AgentDecision {
  action: AgentActionType;
  reason: string;
  memory?: KeboMemory;
  scores: Record<AgentActionType, number>;
  loneliness: number;
}

export const MESSAGE_ACTIONS: AgentActionType[] = ['SEND_MESSAGE', 'ASK_QUESTION', 'REQUEST_ATTENTION', 'REFERENCE_MEMORY'];

interface AutonomyProfile {
  /** Minimum (scaled) minutes between Kebo-initiated messages. */
  messageGapMin: number;
  /** Max unanswered Kebo messages before Kebo waits for the user. */
  maxUnanswered: number;
  /** Minimum (scaled) minutes between ambient (non-message) actions. */
  ambientGapMin: number;
  /** Loneliness needed before Kebo reaches out. */
  lonelyThreshold: number;
}

export const AUTONOMY_PROFILES: Record<Exclude<AutonomyLevel, 'off'>, AutonomyProfile> = {
  low:    { messageGapMin: 240, maxUnanswered: 1, ambientGapMin: 60, lonelyThreshold: 70 },
  normal: { messageGapMin: 120, maxUnanswered: 2, ambientGapMin: 30, lonelyThreshold: 55 },
  high:   { messageGapMin: 60,  maxUnanswered: 3, ambientGapMin: 20, lonelyThreshold: 40 },
};

const ZERO_SCORES: Record<AgentActionType, number> = {
  WAIT: 0, SEND_MESSAGE: 0, ASK_QUESTION: 0, REQUEST_ATTENTION: 0, PLAY: 0,
  EXPLORE: 0, REST: 0, REFERENCE_MEMORY: 0, CHANGE_ACTIVITY: 0,
};

export function activityForAction(action: AgentActionType): Activity | null {
  switch (action) {
    case 'PLAY': return 'playing';
    case 'EXPLORE': return 'exploring';
    case 'REST': return 'resting';
    case 'CHANGE_ACTIVITY': return 'idle';
    default: return null;
  }
}

export function decideAction(ctx: AgentContext): AgentDecision {
  const { state, memories, settings, now } = ctx;
  const { stats, personality: p } = state;
  const scale = timeScaleOf(settings);
  const scores = { ...ZERO_SCORES };
  const loneliness = lonelinessOf(state, now, scale);
  const wait = (reason: string): AgentDecision => ({ action: 'WAIT', reason, scores, loneliness });

  if (state.activity === 'talking' || state.activity === 'thinking') return wait('Kebo is mid-conversation.');

  const idleMin = ((now - state.lastUserMessageAt) / 60_000) * scale;
  const sinceMessageMin = ((now - ctx.lastAutonomousMessageAt) / 60_000) * scale;
  const sinceAmbientMin = ((now - ctx.lastAutonomousActionAt) / 60_000) * scale;

  // ── Ambient (non-disturbing) actions ──
  scores.REST = stats.energy < 45 ? (100 - stats.energy) * 1.15 : 0;
  scores.PLAY = stats.energy > 35
    ? p.playfulness * 40 + stats.energy * 0.3 + (stats.stimulation < 45 ? 15 : 0) - stats.annoyance * 0.6
    : 0;
  scores.EXPLORE = stats.energy > 30
    ? p.curiosity * 42 + p.courage * 14 + stats.energy * 0.2 + (stats.stimulation < 50 ? 8 : 0) - stats.annoyance * 0.5
    : 0;
  scores.CHANGE_ACTIVITY = 22;
  scores.WAIT = 38 + stats.annoyance * 0.3 + (idleMin < 3 ? 40 : 0);

  // ── Message actions (gated) ──
  let messagesAllowed = settings.autonomy !== 'off';
  let gateReason = '';
  if (settings.autonomy === 'off') gateReason = 'Autonomy is off.';
  else {
    const profile = AUTONOMY_PROFILES[settings.autonomy];
    if (now < ctx.quietUntil) { messagesAllowed = false; gateReason = 'You asked Kebo for quiet.'; }
    else if (sinceMessageMin < profile.messageGapMin) { messagesAllowed = false; gateReason = 'Kebo spoke recently; cooling down.'; }
    else if (ctx.unansweredAutonomous >= profile.maxUnanswered) { messagesAllowed = false; gateReason = 'Waiting for you to reply first.'; }
    else if (stats.annoyance >= 60) { messagesAllowed = false; gateReason = 'Kebo is upset and keeping to itself.'; }
    else if (loneliness < profile.lonelyThreshold) { messagesAllowed = false; gateReason = 'Kebo is not lonely enough to interrupt.'; }
  }

  let memory: KeboMemory | undefined;
  if (messagesAllowed) {
    // An upcoming event becomes "due" for a follow-up an hour later (40 seconds in demo speed).
    const followUpAfterMs = scale > 1 ? 40_000 : 60 * 60_000;
    const dueFollowUp = pendingFollowUps(memories).find((m) => now - m.createdAt > followUpAfterMs);
    // Generic "I was thinking about what you told me" references use lasting facts only;
    // dated events are handled by the follow-up path above.
    const facts = memories.filter((m) => m.type !== 'event' && m.type !== 'emotion');
    const anyMemory = facts.length > 0 ? facts[Math.floor((now / 60_000) % facts.length)] : undefined;

    scores.SEND_MESSAGE = loneliness * 0.6 + p.sociability * 22 + p.affection * 8;
    scores.ASK_QUESTION = p.curiosity * 48 + (stats.stimulation < 40 ? 20 : 0) + loneliness * 0.25;
    scores.REQUEST_ATTENTION = loneliness > 75 && stats.bond > 35 ? loneliness * 0.85 + p.affection * 10 : 0;
    if (dueFollowUp) { memory = dueFollowUp; scores.REFERENCE_MEMORY = 95 + loneliness * 0.1; }
    else if (anyMemory) { memory = anyMemory; scores.REFERENCE_MEMORY = loneliness * 0.5 + p.sociability * 18; }
  } else {
    for (const action of MESSAGE_ACTIONS) scores[action] = 0;
  }

  // Ambient actions are rate-limited by their own gap so the activity log is not spammed.
  const ambientGap = AUTONOMY_PROFILES[settings.autonomy === 'off' ? 'low' : settings.autonomy].ambientGapMin;
  const ambientAllowed = sinceAmbientMin >= ambientGap;
  if (!ambientAllowed) { scores.PLAY = 0; scores.EXPLORE = 0; scores.REST = 0; scores.CHANGE_ACTIVITY = 0; }
  // With autonomy off Kebo may still nap when exhausted, but never wanders about on its own.
  if (settings.autonomy === 'off') { scores.PLAY = 0; scores.EXPLORE = 0; scores.CHANGE_ACTIVITY = 0; }

  const ranked = (Object.entries(scores) as [AgentActionType, number][]).sort(([, a], [, b]) => b - a);
  const [action, top] = ranked[0];

  if (action === 'WAIT' || top <= 0) return wait(gateReason || 'Nothing worth doing right now.');
  return { action, reason: reasonFor(action, state, loneliness, memory), memory, scores, loneliness };
}

function reasonFor(action: AgentActionType, state: KeboState, loneliness: number, memory?: KeboMemory): string {
  const { stats } = state;
  switch (action) {
    case 'REST': return `Energy is ${Math.round(stats.energy)}%, so Kebo chose to rest.`;
    case 'PLAY': return `Playfulness is high and energy is ${Math.round(stats.energy)}%.`;
    case 'EXPLORE': return `Curiosity is high${stats.stimulation < 50 ? ' and Kebo is a little bored' : ''}.`;
    case 'CHANGE_ACTIVITY': return 'Kebo shifted to something new.';
    case 'REFERENCE_MEMORY': return memory?.type === 'event' && memory.topic
      ? `Kebo remembers your ${memory.topic} and wants to follow up.`
      : 'Kebo thought of something you told it earlier.';
    case 'ASK_QUESTION': return 'Kebo is curious about you.';
    case 'REQUEST_ATTENTION': return `Loneliness is ${loneliness}% and the bond is strong.`;
    case 'SEND_MESSAGE': return `Loneliness is ${loneliness}%.`;
    default: return '';
  }
}

/* ────────────────────────── Offline message text ────────────────────────── */

const pick = <T,>(items: T[], seed: number): T => items[Math.abs(Math.floor(seed)) % items.length];

export function followUpText(memory: KeboMemory): string {
  const topic = memory.topic || eventTopic(memory.text) || 'thing';
  return `Hey... how did your ${topic} go? I've been thinking about it. 🌱`;
}

/** Template fallback used when the LLM is unreachable (or LLM initiations are disabled). */
export function composeAutonomousText(decision: AgentDecision, state: KeboState, memories: KeboMemory[], now = Date.now()): { text: string; emotion: KeboState['emotion'] } {
  const seed = now / 1000;
  const name = memories.find((m) => /name is|called/.test(m.text))?.text.match(/(?:is|called) ([^.]+)\./)?.[1];
  const hi = name ? `, ${name}` : '';
  const { personality: p } = state;

  switch (decision.action) {
    case 'REFERENCE_MEMORY': {
      const m = decision.memory;
      if (m?.type === 'event' && m.topic) return { text: followUpText(m), emotion: 'curious' };
      const fact = m?.text.replace(/^The user /i, '').replace(/\.$/, '');
      return { text: fact ? `I was thinking about what you told me earlier — you ${fact.replace(/^is /, 'are ').replace(/^likes/, 'like')}. Tell me more?` : `I keep thinking about our last chat${hi}.`, emotion: 'curious' };
    }
    case 'ASK_QUESTION':
      return {
        text: pick([
          `Question${hi}: what's one small thing that made you smile today?`,
          'I\'ve been wondering — what are you working on right now?',
          'Okay, random thought: if you could be any plant, which would you be?',
        ], seed),
        emotion: 'curious',
      };
    case 'REQUEST_ATTENTION':
      return {
        text: p.affection > 0.6
          ? pick([`Psst${hi}... I miss you. Got a minute? 🌱`, `It's been so quiet. Come say hi${hi}?`], seed)
          : pick([`Hello? Anyone there${hi}?`, 'I\'m getting a little lonely over here.'], seed),
        emotion: 'sad',
      };
    default:
      return {
        text: pick([
          `Hey${hi}, just checking in. How's your day going?`,
          'Thinking of you. Hope today is being kind to you. 🌱',
          `Hi${hi}! I'm here whenever you want to talk.`,
        ], seed),
        emotion: state.stats.happiness > 55 ? 'joy' : 'calm',
      };
  }
}

export function ambientText(action: AgentActionType, state: KeboState, now = Date.now()): string {
  const seed = now / 1000;
  switch (action) {
    case 'PLAY': return pick(['Kebo is bouncing around happily.', 'Kebo is playing with a fallen leaf.', 'Kebo started a little dance.'], seed);
    case 'EXPLORE': return pick(['Kebo is exploring a quiet corner of the garden.', 'Kebo is inspecting something interesting.', 'Kebo wandered off to look at the light.'], seed);
    case 'REST': return state.stats.energy < 25 ? 'Kebo curled up for a rest.' : 'Kebo is taking a short nap.';
    default: return pick(['Kebo is swaying gently.', 'Kebo shifted to a sunnier spot.', 'Kebo is watching the clouds.'], seed);
  }
}
