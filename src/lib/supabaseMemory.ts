import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { KeboMemory } from './memory';

interface SupabaseMemoryRow {
  id: string;
  device_id: string;
  text: string;
  type: KeboMemory['type'];
  importance: number;
  confidence: number;
  source: KeboMemory['source'];
  created_at: string;
  last_used_at: string;
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const DEVICE_KEY = 'kebo-device-id-v1';

const client: SupabaseClient | null = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

function getDeviceId(): string {
  const existing = localStorage.getItem(DEVICE_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  localStorage.setItem(DEVICE_KEY, id);
  return id;
}

function fromRow(row: SupabaseMemoryRow): KeboMemory {
  return {
    id: row.id,
    text: row.text,
    type: row.type,
    importance: row.importance,
    confidence: row.confidence,
    source: row.source,
    createdAt: Date.parse(row.created_at),
    lastUsedAt: Date.parse(row.last_used_at),
  };
}

export function isSupabaseMemoryConfigured(): boolean {
  return Boolean(client);
}

export async function loadRemoteMemories(): Promise<KeboMemory[] | null> {
  if (!client) return null;
  const { data, error } = await client
    .from('kebo_memories')
    .select('id, device_id, text, type, importance, confidence, source, created_at, last_used_at')
    .eq('device_id', getDeviceId())
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data || []).map(fromRow).reverse();
}

export async function saveRemoteMemories(memories: KeboMemory[]): Promise<void> {
  if (!client || memories.length === 0) return;
  const deviceId = getDeviceId();
  const rows = memories.slice(-100).map((memory) => ({
    id: memory.id,
    device_id: deviceId,
    text: memory.text,
    type: memory.type,
    importance: memory.importance,
    confidence: memory.confidence,
    source: memory.source,
    created_at: new Date(memory.createdAt).toISOString(),
    last_used_at: new Date(memory.lastUsedAt).toISOString(),
  }));
  const { error } = await client.from('kebo_memories').upsert(rows, { onConflict: 'id' });
  if (error) throw error;
}

export async function clearRemoteMemories(): Promise<void> {
  if (!client) return;
  const { error } = await client.from('kebo_memories').delete().eq('device_id', getDeviceId());
  if (error) throw error;
}
