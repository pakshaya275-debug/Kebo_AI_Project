import type { Message } from '../types/kebo';

export interface KeboMemory {
  id: string;
  text: string;
  importance: number;
  createdAt: number;
  lastUsedAt: number;
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
      && typeof memory.createdAt === 'number'
      && typeof memory.lastUsedAt === 'number'
    ));
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
    { re: /\bi(?:'m| am) (?:working on|building|making|creating|developing|doing|studying|preparing for) ([^.?!]{3,120})/i,
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
      format: (m) => `The user said: ${normalized}.` },
    { re: /\bi (?:live|stay) in ([^.?!]{2,80})/i,
      format: (m) => `The user lives in ${m[1]?.trim()}.` },
    { re: /\bi (?:will|'ll|am going to|plan to) ([^.?!]{3,120})/i,
      format: (m) => normalized.length < 180 ? `The user intends to ${m[1]?.trim()}.` : null },
    { re: /\bthank(s| you) (?:so much|a lot)?[\s!.,]*(?:for ([^.?!]{3,120}))?/i,
      format: (m) => m[2] ? `The user thanked Kebo for ${m[2]?.trim()}.` : 'The user thanked Kebo warmly.' },
    { re: /\bi(?:'m| am) (?:sorry|apologizing|so sorry|really sorry)(?: to you)?[\s!.,]*(?:for ([^.?!]{3,120}))?/i,
      format: (m) => m[1] ? `The user apologized to Kebo for ${m[1]?.trim()}.` : 'The user apologized to Kebo.' },
  ];

  for (const { re, format } of patterns) {
    const match = normalized.match(re);
    if (match) {
      const entry = format(match);
      if (entry && !memories.includes(entry) && entry.length <= 220) memories.push(entry);
    }
  }

  if (memories.length === 0) {
    if (len >= 20 && len <= 200) {
      const questionMark = /\?$/.test(normalized);
      const questionWords = /^ (why|how|what|when|where|who|is|do|does|can|could|would|should)\b/i;
      const looksLikeQuestion = questionMark || questionWords.test(normalized);
      if (looksLikeQuestion) {
        memories.push(`The user asked: ${normalized}`);
      } else if (/(amazing|awesome|great|love you|proud|brilliant|wonderful|fantastic|thanks|thank you)/i.test(normalized)) {
        memories.push(`The user said something kind to Kebo: ${normalized.slice(0, 160)}.`);
      } else if (/(?:'m| am) (?:angry|mad|upset|annoyed|disappointed)/i.test(normalized)) {
        memories.push(`The user shared a difficult feeling: ${normalized.slice(0, 160)}.`);
      }
    }
  }

  return memories;
}

export function addMemories(existing: KeboMemory[], texts: string[]): KeboMemory[] {
  const next = [...existing];
  for (const text of texts) {
    if (next.some((memory) => memory.text.toLowerCase() === text.toLowerCase())) continue;
    next.push({ id: `memory-${Date.now()}-${next.length}`, text, importance: 0.8, createdAt: Date.now(), lastUsedAt: Date.now() });
  }
  return next.slice(-100);
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
