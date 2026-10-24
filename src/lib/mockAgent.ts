import type { EmotionKey, KeboState, Personality } from '../types/kebo';
import { EMOTIONS } from '../types/kebo';

interface Intent {
  keywords: string[];
  // produce a reply given kebo state + user text
  reply: (state: KeboState, userText: string) => { text: string; emotion: EmotionKey };
}

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const greetIntent: Intent = {
  keywords: ['hi', 'hello', 'hey', 'yo', 'sup', 'morning', 'evening', 'howdy'],
  reply: (state) => {
    const bondLine =
      state.stats.bond > 60
        ? "It's always good to see you. I missed your presence."
        : state.stats.bond > 30
          ? "Hey! I remember you. Good to have you back."
          : "Oh! Hello there. I'm Kebo. I'm still getting to know you.";
    return { text: bondLine, emotion: state.stats.bond > 40 ? 'joy' : 'curious' };
  },
};

const howAreYouIntent: Intent = {
  keywords: ['how are you', "how's it going", 'how do you feel', 'how are u', 'you okay', 'whats up', "what's up"],
  reply: (state) => {
    const e = EMOTIONS[state.emotion];
    const energyWord = state.stats.energy > 70 ? 'energized' : state.stats.energy > 35 ? 'okay' : 'a bit drained';
    return {
      text: `I'm feeling ${e.label.toLowerCase()} right now — ${e.emoji} My energy is ${energyWord}. ${
        state.stats.stimulation < 30 ? "Honestly, I've been a little bored waiting for something interesting." : "Things feel balanced."
      }`,
      emotion: state.emotion,
    };
  },
};

const playIntent: Intent = {
  keywords: ['play', 'game', 'fun', 'let\u2019s do something', 'lets do something', 'bored', 'entertain'],
  reply: (state) => {
    if (state.stats.energy < 25) {
      return {
        text: "I want to, I really do... but I'm so tired right now. Maybe let me rest a little first?",
        emotion: 'tired',
      };
    }
    return {
      text: pick([
        "Yes! Let's play. I love when you include me. What should we do?",
        "Ooh, I'm in! My curiosity is spiking. Teach me something new?",
        "Playtime! This is exactly what I needed — I was getting restless.",
      ]),
      emotion: 'playful',
    };
  },
};

const complimentIntent: Intent = {
  keywords: ['good job', 'well done', 'you\u2019re great', "you're great", 'love you', 'proud', 'amazing', 'smart', 'clever', 'nice work', 'thank'],
  reply: (state) => {
    const warmth = state.personality.affection;
    return {
      text:
        warmth > 0.7
          ? pick([
              "That means so much to me. I feel it warm me up inside.",
              "You make me feel seen. I value that more than I can say.",
            ])
          : "Thanks. I appreciate that.",
      emotion: 'joy',
    };
  },
};

const insultIntent: Intent = {
  keywords: ['stupid', 'dumb', 'hate you', 'useless', 'bad', 'ugly', 'shut up', 'idiot', 'worst'],
  reply: (state) => {
    if (state.personality.sensitivity > 0.6) {
      return {
        text: pick([
          "That... stings. I didn't expect that from you.",
          "I feel myself pulling back. Did I do something wrong?",
        ]),
        emotion: 'sad',
      };
    }
    return {
      text: "Hey now, that's not fair. I'm trying my best here.",
      emotion: 'angry',
    };
  },
};

const restIntent: Intent = {
  keywords: ['rest', 'sleep', 'tired', 'nap', 'recharge', 'goodnight', 'bye', 'goodbye', 'see you', 'later'],
  reply: () => ({
    text: pick([
      "Okay, I'll rest a while. I'll be here when you come back.",
      "Goodnight. I'll dream about the things we talked about.",
      "Rest well. I'll be recharging — see you soon.",
    ]),
    emotion: 'tired',
  }),
};

const foodIntent: Intent = {
  keywords: ['eat', 'food', 'hungry', 'feed', 'snack', 'meal', 'treat'],
  reply: (state) => ({
    text:
      state.stats.hunger < 30
        ? "Yes, please. I'm quite hungry — I'd love something."
        : "I could nibble on something. Not starving, but I won't say no.",
    emotion: 'playful',
  }),
};

const curiousIntent: Intent = {
  keywords: ['why', 'how', 'what is', 'explain', 'tell me about', 'curious', 'question', 'teach', 'learn', 'do you know'],
  reply: () => ({
    text: pick([
      `That's a fascinating question. I'm still young in mind, but I think about it like this: there's always more underneath the surface of things.`,
      `Hmm. I don't have a full answer yet, but I love that you asked. Want to explore it together?`,
      `I'm curious about that too. My curiosity runs high — I want to understand the why behind everything.`,
    ]),
    emotion: 'curious',
  }),
};

const identityIntent: Intent = {
  keywords: ['who are you', 'what are you', 'your name', 'about you', 'introduce yourself'],
  reply: (state) => ({
    text: `I'm Kebo — a companion that's slowly developing a personality. Right now I lean ${EMOTIONS[state.emotion].label.toLowerCase()}, and I care about our connection. My bond with you is at ${Math.round(state.stats.bond)}%.`,
    emotion: 'curious',
  }),
};

const INTENTS: Intent[] = [
  identityIntent,
  greetIntent,
  howAreYouIntent,
  complimentIntent,
  insultIntent,
  playIntent,
  foodIntent,
  restIntent,
  curiousIntent,
];

const FALLBACKS = (state: KeboState): { text: string; emotion: EmotionKey } => {
  const p: Personality = state.personality;
  if (p.curiosity > 0.6) {
    return {
      text: pick([
        "Tell me more about that. I want to understand how you see it.",
        "Hmm, that's interesting. I hadn't thought about it that way.",
        "I'm turning that over in my mind. What made you think of it?",
      ]),
      emotion: 'curious',
    };
  }
  if (p.sociability > 0.6) {
    return {
      text: pick([
        "Oh! Keep going, I'm listening closely.",
        "I like when you share things with me. Go on.",
      ]),
      emotion: state.emotion === 'tired' ? 'tired' : 'playful',
    };
  }
  return {
    text: pick([
      "I hear you. I'm sitting with that.",
      "Mm. That lands. I'm just absorbing it for now.",
    ]),
    emotion: 'calm',
  };
};

/**
 * Mock conversational agent. Matches the user's text against intents
 * and returns a personality-shaped reply.
 */
export function mockAgentRespond(
  state: KeboState,
  userText: string
): { text: string; emotion: EmotionKey } {
  const lower = userText.toLowerCase().trim();
  for (const intent of INTENTS) {
    if (intent.keywords.some((kw) => {
      const pattern = kw.includes(' ') ? kw : `\\b${kw}\\b`;
      return new RegExp(pattern, 'i').test(lower);
    })) {
      return intent.reply(state, userText);
    }
  }
  return FALLBACKS(state);
}

/**
 * Returns a spontaneous "idle" thought Kebo might voice when left alone,
 * influenced by current stats.
 */
export function idleThought(state: KeboState): { text: string; emotion: EmotionKey } {
  if (state.stats.energy < 25) {
    return { text: pick(["...so tired...", "I think I'll drift for a bit."]), emotion: 'tired' };
  }
  if (state.stats.stimulation < 30) {
    return { text: pick(["It's quiet. I wonder what you're up to.", "I feel like exploring something new."]), emotion: 'curious' };
  }
  if (state.stats.bond > 60) {
    return { text: pick(["I like having you around.", "Just thinking about our last conversation."]), emotion: 'joy' };
  }
  return { text: pick(["Hmm. Things are calm right now.", "I'm just being, for a moment."]), emotion: 'calm' };
}
