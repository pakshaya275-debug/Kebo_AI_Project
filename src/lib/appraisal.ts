import type { EmotionKey } from '../types/kebo';

/**
 * Appraisal = "what does this message MEAN for Kebo?"
 *
 * The old pipeline picked an emotion straight from keywords, so anything it did
 * not recognise ("ur ugly", "please be quiet") fell through to a cheerful
 * default. Here we classify the *situation* (who is the target, is somebody
 * relaying someone else's words, is it a request, is it care), and the engine
 * turns that situation into vitals changes. Emotion is then derived from vitals.
 */

export type AppraisalKind =
  | 'insult'            // directed at Kebo
  | 'reported_insult'   // user relays what someone else said about Kebo
  | 'praise'
  | 'apology'
  | 'distress'          // user is sad / anxious / hurt
  | 'user_anger'        // user is angry (not at Kebo)
  | 'celebration'
  | 'playful'
  | 'question'
  | 'greeting'
  | 'request_quiet'
  | 'care'              // feeding / watering / sunlight offered in chat
  | 'tired'
  | 'smalltalk';

export type AppraisalTarget = 'kebo' | 'outside' | 'self' | 'unclear';
export type CareKind = 'feed' | 'water' | 'sun';

export interface Appraisal {
  kind: AppraisalKind;
  /** What the user seems to be feeling. */
  userEmotion: EmotionKey | 'neutral';
  target: AppraisalTarget;
  /** -1 (hostile to Kebo) .. +1 (affectionate to Kebo). */
  valence: number;
  /** 0..1 strength of the signal. */
  intensity: number;
  /** 0..1 how sure the rule-based reader is. Low => ask the LLM to help. */
  confidence: number;
  /** Emotion Kebo should express *for this moment*. */
  keboEmotion: EmotionKey;
  care?: CareKind;
  /** Hard safety flag: the user may be at risk. */
  safety?: 'self_harm';
  /** One-line plain-English description passed to the LLM as the situation. */
  situation: string;
}

const NEGATIONS = ['not', 'no', "don't", "didn't", "isn't", "aren't", "wasn't", "won't", 'never', "can't", "cannot", 'hardly'];

export function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/\bu\b/g, 'you')
    .replace(/\bur\b/g, 'your')
    .replace(/\br\b/g, 'are')
    .replace(/\b(plz|pls)\b/g, 'please')
    .replace(/\bdont\b/g, "don't")
    .replace(/\bdidnt\b/g, "didn't")
    .replace(/\bcant\b/g, "can't")
    .replace(/\bisnt\b/g, "isn't")
    .replace(/\barent\b/g, "aren't")
    .replace(/\bim\b/g, "i'm")
    .replace(/\byoure\b/g, "you're")
    .replace(/\s+/g, ' ')
    .trim();
}

function negatedBefore(text: string, index: number, window = 22): boolean {
  const before = text.slice(Math.max(0, index - window), index).split(/[\s,.!?]+/).filter(Boolean);
  return before.some((word) => NEGATIONS.includes(word));
}

const INSULT_WORDS = [
  'ugly', 'stupid', 'dumb', 'idiot', 'useless', 'worthless', 'pathetic', 'trash', 'garbage', 'hideous',
  'disgusting', 'loser', 'annoying', 'boring', 'lame', 'creepy', 'fool', 'moron', 'sucks', 'suck', 'hate', 'weird',
];
const STRONG_INSULTS = new Set(['stupid', 'idiot', 'useless', 'worthless', 'pathetic', 'trash', 'garbage', 'hideous', 'disgusting', 'moron', 'hate', 'loser']);
const PRAISE_WORDS = [
  'cute', 'great', 'awesome', 'amazing', 'smart', 'best', 'sweet', 'pretty', 'beautiful', 'lovely', 'adorable',
  'wonderful', 'brilliant', 'fantastic', 'nice', 'kind', 'funny', 'cool', 'perfect', 'special',
];

const SECOND_PERSON = /\b(you|your|you're|yours|kebo|yourself)\b/;
const REPORTED_SPEECH = new RegExp(
  '\\b(he|she|they|my (?:brother|sister|friend|mom|mother|dad|father|cousin|classmate|roommate|teacher|boss|bf|gf)|' +
  'brother|sister|friend|someone|somebody|people|everyone|everybody|kids|classmates)\\b' +
  '.{0,60}\\b(said|says|say|saying|call(?:ed|s)?|told|tell|tells|thinks?|think|keeps? (?:on )?saying|laughed|teases?|teased|made fun|mocks?|mocked|dislikes?|hates?|doesn\'t like|don\'t like|didn\'t like)\\b',
);

const SELF_HARM = /\b(kill myself|end my life|end it all|want to die|wanna die|suicid\w*|self[- ]?harm|hurt myself|don't want to live|no reason to live|better off dead)\b/;

const DISTRESS_WORDS = /\b(sad|unhappy|heartbroken|lonely|hurt|crying|cry|depressed|miserable|upset|disappointed|bad day|terrible day|rough day|down|worthless|hopeless|lost|alone|failed|failing)\b/;
const ANXIETY_WORDS = /\b(scared|afraid|terrified|nervous|worried|anxious|stressed|stress|overwhelmed|panic\w*|tense|dread\w*)\b/;
const ANGER_WORDS = /\b(angry|mad|furious|frustrated|irritated|annoyed|fed up|pissed|livid)\b/;
const TIRED_WORDS = /\b(tired|sleepy|exhausted|drained|no energy|burnt out|burned out)\b/;
const JOY_WORDS = /\b(happy|excited|thrilled|relieved|proud|yay|hooray|celebrat\w*|passed|got the job|got selected|won|promoted|good news|great news)\b/;
const PLAYFUL_WORDS = /\b(lol|lmao|haha+|hehe+|goofy|joke|kidding|let's play|lets play|play with me|wanna play|game)\b/;

function intensityOf(text: string, base: number): number {
  let value = base;
  if (/\b(so|very|really|extremely|totally|completely|too|super)\b/.test(text)) value += 0.12;
  if (/!{2,}/.test(text)) value += 0.08;
  if (/\b(always|keeps?|again|every (day|time)|constantly)\b/.test(text)) value += 0.08;
  if (/\b[a-z]{3,}\b/.test(text) && text.toUpperCase() === text && /[A-Z]/.test(text)) value += 0.05;
  return Math.min(1, value);
}

function findInsult(text: string): { word: string; index: number } | null {
  for (const word of INSULT_WORDS) {
    const re = new RegExp(`\\b${word}\\b`);
    const match = re.exec(text);
    if (match) return { word, index: match.index };
  }
  return null;
}

function findPraise(text: string): boolean {
  for (const word of PRAISE_WORDS) {
    const match = new RegExp(`\\b${word}\\b`).exec(text);
    if (match && !negatedBefore(text, match.index)) return true;
  }
  return false;
}

function base(partial: Partial<Appraisal> & Pick<Appraisal, 'kind' | 'keboEmotion' | 'situation'>): Appraisal {
  return {
    userEmotion: 'neutral',
    target: 'unclear',
    valence: 0,
    intensity: 0.3,
    confidence: 0.6,
    ...partial,
  };
}

/** Rule-based appraisal. Fast, offline, deterministic; LLM can refine low-confidence cases. */
export function appraiseMessage(raw: string): Appraisal {
  const text = normalizeText(raw);

  if (SELF_HARM.test(text)) {
    return base({
      kind: 'distress', userEmotion: 'sad', target: 'self', valence: 0, intensity: 1, confidence: 1,
      keboEmotion: 'sad', safety: 'self_harm',
      situation: 'The user may be in serious emotional danger. Respond with calm, warm care, take it seriously, and encourage reaching out to a trusted person or a local helpline.',
    });
  }

  // ── Requests for quiet / space ──
  const quiet = /\b(be quiet|quiet down|stop talking|stay quiet|give me (?:some )?space|leave me alone|not now|i need (?:some )?(?:quiet|space|silence)|be silent|shh+|hush|shut up)\b/.exec(text);
  const insultInQuiet = /\bshut up\b/.test(text);
  if (quiet && !insultInQuiet) {
    return base({
      kind: 'request_quiet', userEmotion: 'neutral', target: 'kebo', valence: -0.1, intensity: 0.5, confidence: 0.9,
      keboEmotion: 'calm',
      situation: 'The user politely asked Kebo to be quiet or give them space. Acknowledge briefly and gently, promise to stay quiet, keep it to one short sentence.',
    });
  }

  // ── Care offered in chat ──
  const careMatch = /\b(here(?:'s| is)?|take|have|some|giving|gave|i(?:'ll| will)? (?:give|bring|get))\b.{0,30}\b(water|food|snack|fruit|sunlight|sun|fertili[sz]er|nutrients?|treat)\b/.exec(text)
    || /\b(feed(?:ing)? you|water(?:ing)? you|put you in the sun|you(?:'re| are) hungry|you(?:'re| are) thirsty)\b/.exec(text);
  if (careMatch) {
    const care: CareKind = /water|thirst/.test(text) ? 'water' : /sun/.test(text) ? 'sun' : 'feed';
    return base({
      kind: 'care', userEmotion: 'joy', target: 'kebo', valence: 0.7, intensity: 0.7, confidence: 0.85,
      keboEmotion: 'joy', care,
      situation: `The user is taking care of Kebo (${care}). Kebo feels cared for and grateful.`,
    });
  }

  const insult = findInsult(text);
  const secondPerson = SECOND_PERSON.test(text);
  const reported = REPORTED_SPEECH.test(text);
  const dislikeKebo = /\b(don't|do not|doesn't|didn't) like (you|kebo)\b|\bhates? (you|kebo)\b|\bdislikes? (you|kebo)\b/.test(text);

  // ── Someone else insulted Kebo and the user is telling Kebo about it ──
  if (reported && (dislikeKebo || (insult && secondPerson))) {
    return base({
      kind: 'reported_insult', userEmotion: 'sad', target: 'outside', valence: 0.15, intensity: 0.55, confidence: 0.85,
      keboEmotion: 'sad',
      situation: "The user is relaying that someone else (not the user) insulted or disliked Kebo. The user is NOT attacking Kebo — they are confiding, and may be upset about it too. Kebo feels a bit hurt but should respond with warmth, thank them for telling, and not retaliate.",
    });
  }

  // ── Direct insult at Kebo ──
  if (insult && secondPerson && !negatedBefore(text, insult.index)) {
    const strong = STRONG_INSULTS.has(insult.word) || /\b(shut up|hate you|you suck)\b/.test(text);
    return base({
      kind: 'insult', userEmotion: 'angry', target: 'kebo', valence: strong ? -0.9 : -0.6,
      intensity: intensityOf(text, strong ? 0.75 : 0.55), confidence: 0.9,
      keboEmotion: strong ? 'angry' : 'sad',
      situation: strong
        ? 'The user is being hostile or insulting to Kebo. Kebo is hurt and a bit frustrated; it may set a gentle boundary but stays kind.'
        : 'The user said something unkind about Kebo. Kebo feels hurt more than angry; respond honestly and gently.',
    });
  }
  if (/\b(shut up|you suck|hate you)\b/.test(text) || (dislikeKebo && !reported)) {
    return base({
      kind: 'insult', userEmotion: 'angry', target: 'kebo', valence: -0.85, intensity: intensityOf(text, 0.75), confidence: 0.9,
      keboEmotion: 'angry', situation: 'The user is being hostile to Kebo.',
    });
  }

  // ── Self-harm-adjacent self-criticism handled as distress ──
  const hasNeg = (re: RegExp) => { const m = re.exec(text); return Boolean(m) && !negatedBefore(text, m!.index); };

  if (hasNeg(ANXIETY_WORDS)) {
    return base({
      kind: 'distress', userEmotion: 'anxious', target: 'outside', valence: 0.1, intensity: intensityOf(text, 0.6), confidence: 0.85,
      keboEmotion: 'anxious',
      situation: 'The user is anxious or stressed. Kebo should be calming, concrete and supportive.',
    });
  }
  if (hasNeg(ANGER_WORDS)) {
    const atKebo = /\b(angry|mad|annoyed|frustrated|irritated)\b.{0,20}\b(with|at) (you|kebo)\b/.test(text);
    const atSelf = /\b(with|at|on) (myself|me)\b/.test(text);
    return base({
      kind: atKebo ? 'insult' : 'user_anger',
      userEmotion: 'angry', target: atKebo ? 'kebo' : atSelf ? 'self' : 'outside',
      valence: atKebo ? -0.6 : 0, intensity: intensityOf(text, 0.6), confidence: 0.8,
      keboEmotion: atKebo ? 'sad' : 'anxious',
      situation: atKebo
        ? 'The user says they are angry with Kebo. Kebo should listen and ask what went wrong.'
        : 'The user is angry about something else. Kebo should let them vent and stay calm; it is not the target.',
    });
  }
  if (hasNeg(DISTRESS_WORDS)) {
    return base({
      kind: 'distress', userEmotion: 'sad', target: /\b(my life|myself|my fault)\b/.test(text) ? 'self' : 'outside',
      valence: 0.1, intensity: intensityOf(text, 0.6), confidence: 0.85, keboEmotion: 'sad',
      situation: 'The user is sad or hurting. Kebo should stay with them gently, acknowledge the feeling, and not rush to fix it.',
    });
  }
  if (hasNeg(TIRED_WORDS)) {
    return base({
      kind: 'tired', userEmotion: 'tired', target: 'self', valence: 0.05, intensity: 0.5, confidence: 0.8,
      keboEmotion: 'calm', situation: 'The user is tired. Kebo is soft and soothing, suggests rest if natural.',
    });
  }

  // ── Positive ──
  const praiseDirected = secondPerson && (findPraise(text) || /\blove (you|kebo)\b|\bi like you\b|\bthank(s| you)\b|\bgood (job|boy|girl)\b|\bwell done\b|\bproud of you\b/.test(text));
  if (praiseDirected || /\byou(?:'re| are) not (ugly|stupid|dumb|useless|annoying|boring|weird)\b/.test(text)) {
    return base({
      kind: 'praise', userEmotion: 'joy', target: 'kebo', valence: 0.85, intensity: intensityOf(text, 0.65), confidence: 0.9,
      keboEmotion: 'joy', situation: 'The user is kind or affectionate to Kebo. Kebo is warmly pleased.',
    });
  }
  if (/\b(sorry|apologi[sz]e|forgive me|my bad)\b/.test(text)) {
    return base({
      kind: 'apology', userEmotion: 'sad', target: 'kebo', valence: 0.5, intensity: 0.6, confidence: 0.85,
      keboEmotion: 'calm', situation: 'The user is apologising. Kebo forgives gracefully and lets the tension go.',
    });
  }
  if (JOY_WORDS.test(text)) {
    return base({
      kind: 'celebration', userEmotion: 'joy', target: 'outside', valence: 0.4, intensity: intensityOf(text, 0.65), confidence: 0.85,
      keboEmotion: 'joy', situation: 'The user has good news or feels happy. Kebo celebrates with them.',
    });
  }
  if (PLAYFUL_WORDS.test(text)) {
    return base({
      kind: 'playful', userEmotion: 'joy', target: 'unclear', valence: 0.4, intensity: 0.55, confidence: 0.8,
      keboEmotion: 'playful', situation: 'The user is being playful. Kebo joins in the fun.',
    });
  }
  if (/^(hi+|hello+|hey+|hola|yo|good (morning|evening|afternoon|night)|namaste|vanakkam|sup|what's up|whats up)\b/.test(text)) {
    return base({
      kind: 'greeting', userEmotion: 'neutral', target: 'kebo', valence: 0.3, intensity: 0.35, confidence: 0.85,
      keboEmotion: 'joy', situation: 'The user greeted Kebo.',
    });
  }
  if (text.endsWith('?') || /^(why|how|what|when|where|who|can you|could you|do you|are you|tell me|explain)\b/.test(text)) {
    return base({
      kind: 'question', userEmotion: 'neutral', target: 'unclear', valence: 0.1, intensity: 0.4, confidence: 0.7,
      keboEmotion: 'curious', situation: 'The user asked a question. Answer it directly.',
    });
  }

  // Unknown: say so. The caller may ask the LLM; the default is neutral, never cheerful.
  return base({
    kind: 'smalltalk', userEmotion: 'neutral', target: 'unclear', valence: 0, intensity: 0.2, confidence: 0.3,
    keboEmotion: 'calm', situation: 'Ordinary conversation.',
  });
}

/** Merge an LLM emotion analysis into a low-confidence rule-based appraisal. */
export function refineWithAnalysis(
  local: Appraisal,
  analysis: { emotion: EmotionKey; intensity: number; target: AppraisalTarget } | undefined,
): Appraisal {
  if (!analysis || local.confidence >= 0.6) return local;
  const target = analysis.target;
  const hostile = analysis.emotion === 'angry' && target === 'kebo';
  const keboEmotion: EmotionKey = hostile ? 'sad' : analysis.emotion === 'angry' ? 'anxious' : analysis.emotion;
  return {
    ...local,
    kind: hostile ? 'insult' : analysis.emotion === 'sad' || analysis.emotion === 'anxious' ? 'distress' : local.kind,
    userEmotion: analysis.emotion,
    target,
    intensity: Math.max(local.intensity, analysis.intensity),
    valence: hostile ? -0.6 : local.valence,
    keboEmotion,
    confidence: 0.65,
  };
}
