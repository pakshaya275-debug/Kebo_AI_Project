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

export interface ConversationEmotionAnalysis {
  emotion: EmotionKey;
  intensity: number;
  target: 'kebo' | 'outside' | 'self' | 'unclear';
}

function normalizeMessage(text: string): string {
  return text.toLowerCase().replace(/[’]/g, "'").replace(/\s+/g, ' ').trim();
}

/**
 * One decision point for the emotion Kebo visibly expresses.
 *
 * Explicit user language wins. LLM analysis helps with ambiguous language.
 * Vitals provide the background mood only when the latest message is neutral.
 */
export function resolveConversationEmotion(
  messageText: string,
  analysis: ConversationEmotionAnalysis | undefined,
  stats: VitalStats,
  personality: KeboState['personality'],
): {
  emotion: EmotionKey;
  messageEmotion: EmotionKey;
  target: ConversationEmotionAnalysis['target'];
  explicit: boolean;
} {
  const text = normalizeMessage(messageText);

  const directedAtKebo =
    /\\b(stop that|stop it|stop jumping|enough|leave me alone|shut up)\\b/.test(text)
    || /\\b(kebo|you)\\b.*\\b(annoying|irritating|frustrating|useless|stupid|idiot)\\b/.test(text)
    || /\\b(don't like|dont like|hate)\\b.*\\b(kebo|you)\\b/.test(text);

  const selfAnger =
    /\\b(angry|mad|furious|frustrated|irritated|annoyed|fed up)\\b.*\\b(with|at|on)\\s+(myself|me)\\b/.test(text)
    || /\\b(i am|i'm|im|i feel|feeling)\\b.*\\b(angry|mad|furious|frustrated|irritated|fed up)\\b.*\\b(myself|my life|my fault|my work|my marks|my exam|my project)\\b/.test(text);

  const socialDisconnection =
    /\\b(hate people|don't like anyone|dont like anyone|do not like anyone|i dislike everyone|can't stand people|cant stand people|everyone sucks|nobody likes me|no one likes me|have no friends|don't have friends|dont have friends|feel alone|socially exhausted)\\b/.test(text);

  const anxious =
    /\\b(scared|afraid|terrified|fearful|nervous|worried|anxious|stressed|stress|overwhelmed|panic|panicking)\\b/.test(text);

  const sad =
    /\\b(sad|unhappy|heartbroken|lonely|hurt|crying|cry|disappointed|don't like my life|dont like my life|rejected|left out|isolated)\\b/.test(text);

  const irritation =
    /\\b(irritated|irritating|annoyed|fed up|frustrated|frustrating|upset)\\b/.test(text);

  const tired =
    /\\b(tired|sleepy|exhausted|drained|no energy|low on energy|worn out)\\b/.test(text);

  const joyful =
    /\\b(happy|excited|amazing|awesome|excellent|great|wonderful|fantastic|relieved|proud|love|thanks|thank you)\\b/.test(text);

  const playful =
    /\\b(lol|haha|hehe|goofy|funny|playful|joke|kidding|let's play|lets play)\\b/.test(text);

  const curious =
    /\\b(why|how|what|when|where|who|explain|tell me|curious|interesting|can you)\\b/.test(text)
    || text.endsWith('?');

  if (directedAtKebo) {
    return { emotion: 'angry', messageEmotion: 'angry', target: 'kebo', explicit: true };
  }

  // Kebo has its own simulated mood. When the user is distressed, it should
  // usually express calm/attentive support instead of copying the user's state.
  if (socialDisconnection) {
    return { emotion: 'calm', messageEmotion: 'sad', target: 'outside', explicit: true };
  }

  if (selfAnger) {
    return { emotion: 'calm', messageEmotion: 'sad', target: 'self', explicit: true };
  }

  if (anxious) {
    return { emotion: 'calm', messageEmotion: 'anxious', target: 'outside', explicit: true };
  }

  if (sad) {
    return { emotion: 'calm', messageEmotion: 'sad', target: 'self', explicit: true };
  }

  if (irritation) {
    return { emotion: 'calm', messageEmotion: 'anxious', target: 'outside', explicit: true };
  }

  if (tired) {
    return { emotion: 'calm', messageEmotion: 'tired', target: 'self', explicit: true };
  }

  if (joyful) {
    return { emotion: 'joy', messageEmotion: 'joy', target: 'unclear', explicit: true };
  }

  if (playful) {
    return { emotion: 'playful', messageEmotion: 'playful', target: 'unclear', explicit: true };
  }

  if (curious) {
    return { emotion: 'curious', messageEmotion: 'curious', target: 'unclear', explicit: true };
  }

  if (analysis) {
    const messageEmotion =
      analysis.emotion === 'angry' && analysis.target !== 'kebo'
        ? 'sad'
        : analysis.emotion;

    const isDistress = ['sad', 'anxious', 'tired'].includes(messageEmotion);
    return {
      emotion: analysis.target === 'kebo' && messageEmotion === 'angry'
        ? 'angry'
        : isDistress || (messageEmotion === 'angry' && analysis.target !== 'kebo')
          ? 'calm'
          : messageEmotion,
      messageEmotion,
      target: analysis.target,
      explicit: analysis.intensity >= 0.45 || isDistress || (messageEmotion === 'angry' && analysis.target === 'kebo'),
    };
  }

  return {
    emotion: deriveEmotion(stats, personality),
    messageEmotion: 'calm',
    target: 'unclear',
    explicit: false,
  };
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
