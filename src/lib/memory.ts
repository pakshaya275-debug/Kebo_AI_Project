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
  const patterns = [
    /\bmy name is ([a-z][a-z -]{1,30})/i,
    /\bcall me ([a-z][a-z -]{1,30})/i,
    /\bi(?:'m| am) (?:working on|building|studying) ([^.?!]{3,100})/i,
    /\bi (?:like|love|enjoy) ([^.?!]{3,80})/i,
    /\bi have (?:an?|the) ([^.?!]{3,80})/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match?.[1]) memories.push(normalized.includes('name is') || normalized.includes('call me') ? `The user's name is ${match[1].trim()}.` : `The user said: ${normalized}.`);
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
