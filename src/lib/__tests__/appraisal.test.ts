import { describe, expect, it } from 'vitest';
import { appraiseMessage } from '../appraisal';

const kind = (text: string) => appraiseMessage(text);

describe('appraisal: screenshot regressions', () => {
  it('relayed insult is NOT an attack by the user and NOT joyful', () => {
    const a = kind('my brother dont like you he said ur ugly');
    expect(a.kind).toBe('reported_insult');
    expect(a.target).toBe('outside');
    expect(a.keboEmotion).toBe('sad');
  });

  it('"ur ugly he keeps on saying that" is the user relaying the brother again — never playful/joyful', () => {
    const a = kind('ur ugly he keeps on saying that');
    expect(a.kind).toBe('reported_insult');
    expect(a.keboEmotion).toBe('sad');
  });

  it('the same words said directly ARE an insult at Kebo', () => {
    const a = kind('you are ugly');
    expect(a.kind).toBe('insult');
    expect(a.keboEmotion).not.toBe('playful');
  });

  it('"please be quiet" is a polite request, handled calmly', () => {
    const a = kind('hey please be quiet');
    expect(a.kind).toBe('request_quiet');
    expect(a.keboEmotion).toBe('calm');
  });

  it('unknown small talk is neutral with low confidence, never cheerful by default', () => {
    const a = kind('the bus was late again');
    expect(a.keboEmotion).toBe('calm');
    expect(a.confidence).toBeLessThan(0.6);
  });
});

describe('appraisal: meaning, not keywords', () => {
  it('negation flips insults', () => {
    expect(kind("you're not ugly").kind).toBe('praise');
  });
  it('praise', () => expect(kind('you are so cute').kind).toBe('praise'));
  it('hostile', () => {
    const a = kind('shut up you idiot');
    expect(a.kind).toBe('insult');
    expect(a.keboEmotion).toBe('angry');
  });
  it('user sadness is distress, not an attack', () => {
    const a = kind('i am so sad today');
    expect(a.kind).toBe('distress');
    expect(a.target).not.toBe('kebo');
    expect(a.keboEmotion).toBe('calm'); // Kebo stays attentive; it does not copy the user's sadness
  });
  it('user angry at something else is not aimed at Kebo', () => {
    const a = kind("i'm furious about my exam results");
    expect(a.kind).toBe('user_anger');
    expect(a.target).toBe('outside');
    expect(a.keboEmotion).toBe('calm');
  });
  it('anxiety', () => expect(kind("i'm really nervous about tomorrow").kind).toBe('distress'));
  it('celebration', () => expect(kind('i passed my exam!').kind).toBe('celebration'));
  it('greeting', () => expect(kind('hello kebo').kind).toBe('greeting'));
  it('question', () => expect(kind('why is the sky blue?').kind).toBe('question'));
  it('care in chat', () => {
    const a = kind('here, have some water');
    expect(a.kind).toBe('care');
    expect(a.care).toBe('water');
  });
  it('apology', () => expect(kind("i'm sorry about earlier").kind).toBe('apology'));
  it('safety flag for self-harm language', () => {
    const a = kind('i want to die');
    expect(a.safety).toBe('self_harm');
    expect(a.keboEmotion).toBe('calm');
  });
});
