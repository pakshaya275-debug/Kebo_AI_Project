import type { Message } from '../types/kebo';

export interface KeboMemory {
  id: string;
  text: string;
  type: 'user_fact' | 'preference' | 'goal' | 'emotion' | 'event';
  importance: number;
  confidence: number;
  source: 'user_message' | 'reasoning_plan' | 'manual';
  createdAt: number;
  lastUsedAt: number;
  /** For upcoming events ("exam tomorrow"): the topic Kebo may follow up on later. */
  topic?: string;
  /** Set once Kebo has asked the user about this event. */
  followedUpAt?: number;
}

export type MemoryKind = 'semantic' | 'episodic';

/** Semantic = lasting facts/preferences/goals. Episodic = dated events and emotional moments. */
export function memoryKind(memory: Pick<KeboMemory, 'type'>): MemoryKind {
  return memory.type === 'event' || memory.type === 'emotion' ? 'episodic' : 'semantic';
}

const EVENT_TOPICS = 'exam|test|interview|presentation|viva|review|deadline|match|trip|surgery|appointment|submission|demo|quiz|competition|results?';
const EVENT_WHEN = 'tomorrow|today|tonight|next week|this week|this weekend|on (?:mon|tues|wednes|thurs|fri|satur|sun)day|in \\d+ days?';

function formatDay(ts = Date.now()): string {
  return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function eventTopic(text: string): string | undefined {
  return /^Upcoming ([a-z]+)/i.exec(text)?.[1]?.toLowerCase();
}

const MEMORY_KEY = 'kebo-memories-v1';

export function loadMemories(): KeboMemory[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(MEMORY_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((memory): memory is KeboMemory => (
      typeof memory === 'object'
      && memory !== null
      && typeof memory.text === 'string'
      && typeof memory.importance === 'number'
      && (memory.type === 'user_fact' || memory.type === 'preference' || memory.type === 'goal' || memory.type === 'emotion' || memory.type === 'event' || memory.type === undefined)
      && typeof memory.createdAt === 'number'
      && typeof memory.lastUsedAt === 'number'
    )).map((memory) => ({
      ...memory,
      type: memory.type || 'user_fact',
      confidence: memory.confidence ?? 0.8,
      source: memory.source || 'user_message',
    }));
  } catch {
    return [];
  }
}

export function saveMemories(memories: KeboMemory[]): void {
  try {
    localStorage.setItem(MEMORY_KEY, JSON.stringify(memories.slice(-100)));
  } catch {
    /* ignore storage failures */
  }
}

export function extractMemories(text: string): string[] {
  const memories: string[] = [];
  const normalized = text.trim().replace(/\s+/g, ' ');
  const len = normalized.length;
  if (len < 6) return memories;

  const patterns: { re: RegExp; format: (groups: RegExpMatchArray) => string | null }[] = [
    { re: /\bmy name is ([a-z][a-z .\-_']{1,40})/i, format: (m) => `The user's name is ${m[1]?.trim()}.` },
    { re: /\bcall me ([a-z][a-z .\-_']{1,40})/i, format: (m) => `The user wants to be called ${m[1]?.trim()}.` },
    { re: /\bI(?:['’]m| am)\s+([A-Z][a-z .\-_']{1,40})[.!?]?$/, format: (m) => `The user's name is ${m[1]?.trim()}.` },
    { re: /\bi(?:['’]m| am) (?:working on|building|making|creating|developing|doing|studying|preparing for) ([^.?!]{3,120})/i,
      format: (m) => `The user is working on / building: ${m[1]?.trim()}.` },
    { re: /\bi (?:like|love|enjoy|adore|really like) ([^.?!]{3,120})/i,
      format: (m) => `The user likes ${m[1]?.trim()}.` },
    { re: /\bi (?:dislike|hate|don't like|dont like|do not like|can't stand) ([^.?!]{3,120})/i,
      format: (m) => `The user dislikes ${m[1]?.trim()}.` },
    { re: /\bi have (?:an?|the|a) ([^.?!]{3,120}?)(?:\s+(?:pet|dog|cat|plant|hobby|project|exam|test))/i,
      format: (m) => `The user mentioned having: ${m[1]?.trim()}.` },
    { re: /\bi (?:feel|am feeling|'m feeling) (?:happy|sad|angry|tired|anxious|stressed|excited|nervous|great|good|bad|okay|ok) ([^.?!]*)$/i,
      format: (m) => `The user shared their current mood (${m[0]?.replace(/^i (?:feel|am feeling|'m feeling) /i, '')}).` },
    { re: /\bmy (?:birthday|fav|favorite|favourite|hobby|pet|dog|cat|major|course|degree|school|college|university|project|work|job|dream|goal) is ([^.?!]{3,120})/i,
      format: () => `The user said: ${normalized}.` },
    { re: /\bi (?:live|stay) in ([^.?!]{2,80})/i,
      format: (m) => `The user lives in ${m[1]?.trim()}.` },
    { re: /\bi (?:will|'ll|am going to|plan to) ([^.?!]{3,120})/i,
      format: (m) => normalized.length < 180 ? `The user intends to ${m[1]?.trim()}.` : null },
    { re: /\bthank(s| you) (?:so much|a lot)?[\s!.,]*(?:for ([^.?!]{3,120}))?/i,
      format: (m) => m[2] ? `The user thanked Kebo for ${m[2]?.trim()}.` : 'The user thanked Kebo warmly.' },
    { re: /\bi(?:['’]m| am) (?:sorry|apologizing|so sorry|really sorry)(?: to you)?[\s!.,]*(?:for ([^.?!]{3,120}))?/i,
      format: (m) => m[1] ? `The user apologized to Kebo for ${m[1]?.trim()}.` : 'The user apologized to Kebo.' },
  ];

  const eventA = new RegExp(`\\b(?:i (?:have|got|am having|'ve got)|my) (?:an? |the )?(${EVENT_TOPICS})\\b[^.?!]{0,40}?\\b(${EVENT_WHEN})`, 'i').exec(normalized);
  const eventB = new RegExp(`\\b(${EVENT_WHEN})\\b[^.?!]{0,30}?\\b(${EVENT_TOPICS})\\b`, 'i').exec(normalized);
  if (eventA) memories.push(`Upcoming ${eventA[1].toLowerCase()} (${eventA[2].toLowerCase()}) — mentioned on ${formatDay()}.`);
  else if (eventB && /\b(i|my)\b/i.test(normalized)) memories.push(`Upcoming ${eventB[2].toLowerCase()} (${eventB[1].toLowerCase()}) — mentioned on ${formatDay()}.`);

  for (const { re, format } of patterns) {
    const match = normalized.match(re);
    if (match) {
      const entry = format(match);
      if (entry && !memories.includes(entry) && entry.length <= 220) memories.push(entry);
    }
  }

  if (memories.length === 0) {
    if (len >= 20 && len <= 200) {
      if (/(amazing|awesome|great|love you|proud|brilliant|wonderful|fantastic|thanks|thank you)/i.test(normalized)) {
        memories.push(`The user said something kind to Kebo: ${normalized.slice(0, 160)}.`);
      } else if (/(?:'m|’m| am) (?:angry|mad|upset|annoyed|disappointed|stressed|overwhelmed)/i.test(normalized)) {
        memories.push(`The user shared a difficult feeling: ${normalized.slice(0, 160)}.`);
      }
    }
  }

  return memories;
}

export function addMemories(existing: KeboMemory[], texts: string[]): KeboMemory[] {
  const next = [...existing];
  for (const rawText of texts) {
    const text = rawText.trim().replace(/\s+/g, ' ');
    if (text.length < 6 || text.length > 220) continue;
    const normalized = text.toLocaleLowerCase();
    const exact = next.findIndex((memory) => memory.text.trim().toLocaleLowerCase() === normalized);
    if (exact >= 0) {
      next[exact] = { ...next[exact], lastUsedAt: Date.now() };
      continue;
    }

    const metadata = classifyMemory(text);
    const subject = memorySubject(text, metadata.type);
    if (subject) {
      const conflictIndex = next.findIndex((memory) => {
        const existingMetadata = classifyMemory(memory.text);
        return memorySubject(memory.text, existingMetadata.type) === subject;
      });
      if (conflictIndex >= 0) next.splice(conflictIndex, 1);
    }

    const now = Date.now();
    next.push({
      id: `memory-${now}-${Math.random().toString(36).slice(2, 8)}`,
      text,
      ...metadata,
      ...(eventTopic(text) ? { topic: eventTopic(text) } : {}),
      createdAt: now,
      lastUsedAt: now,
    });
  }

  return next.slice(-100);
}

function memorySubject(text: string, type: KeboMemory['type']): string | null {
  const lower = text.toLowerCase();
  if (/user's name is|wants to be called/.test(lower)) return 'profile:name';
  if (/lives in/.test(lower)) return 'profile:location';

  if (type !== 'preference') return null;

  // Replace only preferences about the same recognizable subject.
  // Unknown/general preferences are retained rather than risking deletion
  // of an unrelated fact.
  if (/coffee|tea|drink|beverage|water/.test(lower)) return 'preference:drink';
  if (/food|eat|meal|cuisine|pizza|fruit/.test(lower)) return 'preference:food';
  if (/music|song|artist|band/.test(lower)) return 'preference:music';
  if (/color|colour/.test(lower)) return 'preference:color';
  if (/book|reading|novel|author/.test(lower)) return 'preference:books';
  if (/movie|film|cinema|tv show|series/.test(lower)) return 'preference:screen-media';
  if (/game|gaming|video game/.test(lower)) return 'preference:games';
  if (/sport|football|cricket|tennis|basketball/.test(lower)) return 'preference:sports';
  if (/hobby|gardening|drawing|painting|photography/.test(lower)) return 'preference:hobbies';

  return null;
}

function classifyMemory(text: string): Pick<KeboMemory, 'type' | 'importance' | 'confidence' | 'source'> {
  const lower = text.toLowerCase();
  const type = /^upcoming /.test(lower)
    ? 'event'
    : /name is|called|lives in|has a|mentioned having/.test(lower)
    ? 'user_fact'
    : /likes?|loves?|enjoys?|prefers?|dislikes?|hates?|favorite|favourite/.test(lower)
      ? 'preference'
      : /working on|building|project|goal|intends|plan/.test(lower)
        ? 'goal'
        : /feeling|mood|sad|angry|tired|worried/.test(lower)
          ? 'emotion'
          : 'event';
  const importance = type === 'user_fact' || type === 'goal' ? 0.95 : type === 'preference' ? 0.85 : 0.65;
  return { type, importance, confidence: 0.9, source: 'user_message' };
}

export function retrieveMemories(memories: KeboMemory[], query: string): KeboMemory[] {
  const terms = expandTerms(query);
  return memories
    .map((memory) => {
      const memoryTerms = expandTerms(memory.text);
      const overlap = terms.filter((term) => memoryTerms.includes(term)).length;
      const recency = Math.max(0, 1 - (Date.now() - memory.lastUsedAt) / (1000 * 60 * 60 * 24 * 30));
      return { memory, score: overlap * 2 + memory.importance + recency };
    })
    .filter(({ score }) => score > 1)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ memory }) => ({ ...memory, lastUsedAt: Date.now() }));
}

function expandTerms(text: string): string[] {
  const aliases: Record<string, string[]> = {
    ai: ['ai', 'artificial', 'intelligence', 'project', 'study', 'studying', 'work', 'working', 'building', 'prepare', 'preparing'],
    name: ['name', 'call', 'called'],
    like: ['like', 'love', 'enjoy', 'favorite', 'favourite'],
    sad: ['sad', 'unhappy', 'upset', 'hurt', 'lonely', 'worried', 'worry'],
    project: ['project', 'assignment', 'work', 'working', 'building', 'preparing', 'prepare'],
  };
  const words = text.toLowerCase().split(/\W+/).filter((word) => word.length > 2);
  return [...new Set(words.flatMap((word) => {
    const root = word.endsWith('ing') ? word.slice(0, -3) : word.endsWith('ed') ? word.slice(0, -2) : word;
    const concept = Object.entries(aliases).find(([, values]) => values.includes(word) || values.includes(root))?.[0];
    return concept ? [word, root, concept] : [word, root];
  }))];
}

export function memoryContext(memories: KeboMemory[], query: string): string[] {
  return retrieveMemories(memories, query).map((memory) => memory.text);
}

export function messagesToMemoryCandidates(messages: Message[]): string[] {
  return messages.flatMap((message) => message.sender === 'user' ? extractMemories(message.text) : []);
}

export function deleteMemory(memories: KeboMemory[], id: string): KeboMemory[] {
  return memories.filter((memory) => memory.id !== id);
}

export function markFollowedUp(memories: KeboMemory[], id: string, now = Date.now()): KeboMemory[] {
  return memories.map((memory) => (memory.id === id ? { ...memory, followedUpAt: now } : memory));
}

/** Upcoming-event memories Kebo has not asked about yet. */
export function pendingFollowUps(memories: KeboMemory[]): KeboMemory[] {
  return memories.filter((memory) => memory.type === 'event' && memory.topic && !memory.followedUpAt);
}

export function memoriesToText(memories: KeboMemory[]): string {
  return memories.map((memory) => `- [${memoryKind(memory)}/${memory.type}] ${memory.text}`).join('\n');
}
