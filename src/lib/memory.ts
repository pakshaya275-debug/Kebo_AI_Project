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
  const terms = query.toLowerCase().split(/\W+/).filter((term) => term.length > 2);
  return memories
    .map((memory) => ({ memory, score: terms.filter((term) => memory.text.toLowerCase().includes(term)).length + memory.importance }))
    .filter(({ score }) => score > 1)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ memory }) => memory);
}

export function memoryContext(memories: KeboMemory[], query: string): string[] {
  return retrieveMemories(memories, query).map((memory) => memory.text);
}

export function messagesToMemoryCandidates(messages: Message[]): string[] {
  return messages.flatMap((message) => message.sender === 'user' ? extractMemories(message.text) : []);
}
