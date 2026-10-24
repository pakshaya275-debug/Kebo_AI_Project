import { describe, expect, it } from 'vitest';
import { decideAction, MESSAGE_ACTIONS, type AgentContext } from '../agent';
import { addMemories, extractMemories } from '../memory';
import { DEFAULT_PERSONALITY, DEFAULT_STATS, createRelationship, type KeboState } from '../../types/kebo';
import { DEFAULT_SETTINGS } from '../settings';

const NOW = 1_800_000_000_000;
const HOUR = 3_600_000;
const state = (over: Partial<KeboState> = {}): KeboState => ({
  emotion: 'calm', emotionUntil: 0, stats: { ...DEFAULT_STATS }, personality: { ...DEFAULT_PERSONALITY },
  activity: 'idle', lastInteraction: NOW, lastUserMessageAt: NOW - 6 * HOUR, relationship: createRelationship(NOW), ...over,
});
const ctx = (over: Partial<AgentContext> = {}): AgentContext => ({
  state: state(), memories: [], settings: DEFAULT_SETTINGS, now: NOW,
  lastAutonomousMessageAt: NOW - 24 * HOUR, lastAutonomousActionAt: NOW - 24 * HOUR, unansweredAutonomous: 0, quietUntil: 0, ...over,
});

describe('agent: when Kebo reaches out', () => {
  it('a lonely Kebo that has been ignored for hours initiates', () => {
    expect(MESSAGE_ACTIONS).toContain(decideAction(ctx()).action);
  });
  it('does not interrupt right after a conversation', () => {
    const d = decideAction(ctx({ state: state({ lastUserMessageAt: NOW - 30_000 }) }));
    expect(MESSAGE_ACTIONS).not.toContain(d.action);
  });
  it('autonomy OFF never sends a message', () => {
    const d = decideAction(ctx({ settings: { ...DEFAULT_SETTINGS, autonomy: 'off' } }));
    expect(MESSAGE_ACTIONS).not.toContain(d.action);
  });
  it('respects "be quiet" requests', () => {
    const d = decideAction(ctx({ quietUntil: NOW + HOUR }));
    expect(MESSAGE_ACTIONS).not.toContain(d.action);
    expect(d.scores.SEND_MESSAGE).toBe(0);
  });
  it('anti-spam: cool-down and unanswered cap', () => {
    expect(MESSAGE_ACTIONS).not.toContain(decideAction(ctx({ lastAutonomousMessageAt: NOW - 10 * 60_000 })).action);
    expect(MESSAGE_ACTIONS).not.toContain(decideAction(ctx({ unansweredAutonomous: 2 })).action);
  });
  it('an annoyed Kebo does not pester the user', () => {
    const d = decideAction(ctx({ state: state({ stats: { ...DEFAULT_STATS, annoyance: 80 } }) }));
    expect(MESSAGE_ACTIONS).not.toContain(d.action);
  });
  it('a exhausted Kebo rests', () => {
    const d = decideAction(ctx({ state: state({ stats: { ...DEFAULT_STATS, energy: 12 }, lastUserMessageAt: NOW - 60_000 }) }));
    expect(d.action).toBe('REST');
  });
  it('never acts mid-conversation', () => {
    expect(decideAction(ctx({ state: state({ activity: 'thinking' }) })).action).toBe('WAIT');
  });
  it('demo speed makes the same absence trigger sooner', () => {
    const c = ctx({ state: state({ lastUserMessageAt: NOW - 10 * 60_000 }) });
    expect(MESSAGE_ACTIONS).not.toContain(decideAction(c).action);
    expect(MESSAGE_ACTIONS).toContain(decideAction({ ...c, settings: { ...DEFAULT_SETTINGS, demoSpeed: true, autonomy: 'high' } }).action);
  });
});

describe('episodic memory + follow-up (the "how did your exam go?" story)', () => {
  it('extracts an upcoming event and the agent follows up on it later', () => {
    const [text] = extractMemories('I have an exam tomorrow');
    expect(text).toMatch(/^Upcoming exam \(tomorrow\)/);
    const memories = addMemories([], [text]);
    expect(memories[0].type).toBe('event');
    expect(memories[0].topic).toBe('exam');
    const aged = memories.map((m) => ({ ...m, createdAt: NOW - 3 * HOUR }));
    const d = decideAction(ctx({ memories: aged }));
    expect(d.action).toBe('REFERENCE_MEMORY');
    expect(d.memory?.topic).toBe('exam');
  });
  it('does not follow up twice', () => {
    const [text] = extractMemories('my interview is tomorrow');
    const aged = addMemories([], [text]).map((m) => ({ ...m, createdAt: NOW - 3 * HOUR, followedUpAt: NOW - HOUR }));
    expect(decideAction(ctx({ memories: aged })).action).not.toBe('REFERENCE_MEMORY');
  });
});
