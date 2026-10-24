import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { eventTopic, type KeboMemory } from './memory';

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

function getDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
    return id;
  } catch {
    return 'ephemeral-device';
  }
}

// The device id is also sent as a header so the optional hardened policy in
// supabase/memory_hardening.sql can restrict every row to its own device.
const client: SupabaseClient | null = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { 'x-device-id': getDeviceId() } } })
  : null;

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
    ...(row.type === 'event' && eventTopic(row.text) ? { topic: eventTopic(row.text) } : {}),
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
  if (!client) return;
  const deviceId = getDeviceId();
  const kept = memories.slice(-100);
  if (kept.length > 0) {
    const rows = kept.map((memory) => ({
      id: memory.id,
      device_id: deviceId,
      text: memory.text,
      type: memory.type,
      importance: memory.importance,
      confidence: memory.confidence,
      // The original table only allows these two sources; manual memories are stored as user-provided.
      source: memory.source === 'manual' ? 'user_message' : memory.source,
      created_at: new Date(memory.createdAt).toISOString(),
      last_used_at: new Date(memory.lastUsedAt).toISOString(),
    }));
    const { error } = await client.from('kebo_memories').upsert(rows, { onConflict: 'id' });
    if (error) throw error;
  }

  // Propagate deletions: remove remote rows that no longer exist locally.
  const { data: remote, error: listError } = await client.from('kebo_memories').select('id').eq('device_id', deviceId).limit(500);
  if (listError) throw listError;
  const keep = new Set(kept.map((memory) => memory.id));
  const stale = (remote || []).map((row) => row.id as string).filter((id) => !keep.has(id));
  if (stale.length > 0) {
    const { error } = await client.from('kebo_memories').delete().eq('device_id', deviceId).in('id', stale);
    if (error) throw error;
  }
}

export async function clearRemoteMemories(): Promise<void> {
  if (!client) return;
  const { error } = await client.from('kebo_memories').delete().eq('device_id', getDeviceId());
  if (error) throw error;
}
