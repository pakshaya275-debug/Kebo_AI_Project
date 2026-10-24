import { describe, expect, it } from 'vitest';
import { appraiseMessage } from '../appraisal';
import { applyAppraisal, applyCare, decayStats, deriveEmotion, lonelinessOf, relationshipLevel, updateRelationship } from '../keboEngine';
import { DEFAULT_PERSONALITY, DEFAULT_STATS, createRelationship, type KeboState } from '../../types/kebo';

const NOW = 1_800_000_000_000;
const fresh = (over: Partial<KeboState> = {}): KeboState => ({
  emotion: 'calm', emotionUntil: 0, stats: { ...DEFAULT_STATS }, personality: { ...DEFAULT_PERSONALITY },
  activity: 'idle', lastInteraction: NOW, lastUserMessageAt: NOW, relationship: createRelationship(NOW), ...over,
});

describe('emotion is state, not a label', () => {
  it('one insult hurts but is not an instant meltdown; repeated insults accumulate into anger', () => {
    let state = fresh();
    const first = applyAppraisal(state, appraiseMessage('ur ugly'), NOW);
    expect(first.emotion).toBe('sad');
    expect(first.stats.annoyance).toBeGreaterThan(10);
    state = { ...state, stats: first.stats };
    for (let i = 0; i < 3; i += 1) {
      const next = applyAppraisal(state, appraiseMessage('you are so stupid'), NOW + i);
      state = { ...state, stats: next.stats, emotion: next.emotion };
    }
    expect(state.stats.annoyance).toBeGreaterThan(60);
    expect(state.emotion).toBe('angry');
  });

  it('relayed insult raises bond (the user confided) instead of lowering it', () => {
    const before = fresh();
    const after = applyAppraisal(before, appraiseMessage('my brother said you are ugly'), NOW);
    expect(after.stats.bond).toBeGreaterThan(before.stats.bond);
    expect(after.stats.annoyance).toBeLessThan(10);
  });

  it('praise cools annoyance and raises happiness + bond', () => {
    const before = fresh({ stats: { ...DEFAULT_STATS, annoyance: 40, happiness: 40 } });
    const after = applyAppraisal(before, appraiseMessage('you are amazing'), NOW);
    expect(after.stats.annoyance).toBeLessThan(40);
    expect(after.stats.happiness).toBeGreaterThan(40);
    expect(after.stats.bond).toBeGreaterThan(before.stats.bond);
  });

  it('personality changes the outcome: a patient Kebo gets less annoyed than an impatient one', () => {
    const patient = fresh({ personality: { ...DEFAULT_PERSONALITY, patience: 1 } });
    const impatient = fresh({ personality: { ...DEFAULT_PERSONALITY, patience: 0 } });
    const a = appraiseMessage('you are stupid');
    expect(applyAppraisal(patient, a, NOW).stats.annoyance).toBeLessThan(applyAppraisal(impatient, a, NOW).stats.annoyance);
  });

  it('sensitive Kebo is hurt more', () => {
    const sensitive = fresh({ personality: { ...DEFAULT_PERSONALITY, sensitivity: 1 } });
    const thick = fresh({ personality: { ...DEFAULT_PERSONALITY, sensitivity: 0 } });
    const a = appraiseMessage('you are ugly');
    expect(applyAppraisal(sensitive, a, NOW).stats.happiness).toBeLessThan(applyAppraisal(thick, a, NOW).stats.happiness);
  });

  it('neutral messages follow vitals, not a keyword', () => {
    const tired = fresh({ stats: { ...DEFAULT_STATS, energy: 10 } });
    expect(applyAppraisal(tired, appraiseMessage('the bus was late again'), NOW).emotion).toBe('tired');
  });

  it('deriveEmotion hard boundaries', () => {
    expect(deriveEmotion({ ...DEFAULT_STATS, annoyance: 90 }, DEFAULT_PERSONALITY)).toBe('angry');
    expect(deriveEmotion({ ...DEFAULT_STATS, happiness: 10 }, DEFAULT_PERSONALITY)).toBe('sad');
    expect(deriveEmotion({ ...DEFAULT_STATS, energy: 5 }, DEFAULT_PERSONALITY)).toBe('tired');
  });
});

describe('time and care', () => {
  it('stats drift but never collapse to a dead 0 on happiness/bond', () => {
    const d = decayStats({ ...DEFAULT_STATS, happiness: 5, bond: 5 }, 1000 * 3600 * 100);
    expect(d.bond).toBeGreaterThanOrEqual(3);
    expect(d.happiness).toBeGreaterThanOrEqual(0);
    expect(d.hunger).toBe(0);
  });
  it('demo speed makes time pass faster', () => {
    const slow = decayStats(DEFAULT_STATS, 60_000, 1);
    const fast = decayStats(DEFAULT_STATS, 60_000, 30);
    expect(fast.hunger).toBeLessThan(slow.hunger);
  });
  it('feeding fixes hunger (the 0% Fullness bug)', () => {
    const hungry = fresh({ stats: { ...DEFAULT_STATS, hunger: 0 } });
    expect(applyCare(hungry, 'feed', NOW).stats.hunger).toBeGreaterThanOrEqual(35);
  });
  it('resting recovers energy', () => {
    expect(decayStats({ ...DEFAULT_STATS, energy: 20 }, 3_600_000, 1, true).energy).toBeGreaterThan(20);
  });
  it('loneliness grows with absence and is slower for patient Kebo', () => {
    const later = NOW + 3 * 3_600_000;
    const impatient = fresh({ personality: { ...DEFAULT_PERSONALITY, patience: 0 } });
    const patient = fresh({ personality: { ...DEFAULT_PERSONALITY, patience: 1 } });
    expect(lonelinessOf(fresh(), NOW, 1)).toBe(0);
    expect(lonelinessOf(impatient, later, 1)).toBeGreaterThan(lonelinessOf(patient, later, 1));
  });
});

describe('relationship', () => {
  it('levels and milestones', () => {
    expect(relationshipLevel(5).label).toBe('Strangers');
    expect(relationshipLevel(40).label).toBe('Friends');
    let rel = createRelationship(NOW);
    rel = updateRelationship(rel, appraiseMessage('hello'), 20, NOW);
    expect(rel.milestones.map((m) => m.id)).toContain('first-chat');
    rel = updateRelationship(rel, appraiseMessage('i am so sad'), 36, NOW + 1);
    expect(rel.milestones.map((m) => m.id)).toEqual(expect.arrayContaining(['first-comfort', 'bond-friends']));
  });
  it('streak counts consecutive days', () => {
    let rel = createRelationship(NOW);
    rel = updateRelationship(rel, appraiseMessage('hi'), 20, NOW);
    rel = updateRelationship(rel, appraiseMessage('hi'), 20, NOW + 86_400_000);
    expect(rel.streakDays).toBe(2);
  });
});
