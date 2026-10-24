import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_PERSONALITY,
  DEFAULT_STATS,
  EMOTIONS,
  PERSONALITY_TRAITS,
  createRelationship,
  type ActivityEntry,
  type Activity,
  type KeboState,
  type Message,
  type Personality,
} from '../types/kebo';
import {
  applyAppraisal,
  applyCare,
  decayStats,
  deriveEmotion,
  updateRelationship,
  type CareAction,
} from '../lib/keboEngine';
import { appraiseMessage, refineWithAnalysis, type Appraisal } from '../lib/appraisal';
import { activityForAction, ambientText, composeAutonomousText, decideAction, MESSAGE_ACTIONS, type AgentDecision } from '../lib/agent';
import { mockAgentRespond } from '../lib/mockAgent';
import {
  analyzeKeboMessage,
  askKeboLLM,
  checkBackend,
  composeInitiatedMessage,
  type BackendStatus,
} from '../lib/llmAgent';
import {
  addMemories,
  deleteMemory as removeMemory,
  extractMemories,
  loadMemories,
  markFollowedUp,
  memoryContext,
  saveMemories,
  type KeboMemory,
} from '../lib/memory';
import { clearRemoteMemories, loadRemoteMemories, saveRemoteMemories } from '../lib/supabaseMemory';
import { loadSettings, saveSettings, timeScaleOf, type KeboSettings } from '../lib/settings';

const STATE_KEY = 'kebo-state-v2';
const LEGACY_STATE_KEY = 'kebo-state-v1';
const MESSAGES_KEY = 'kebo-messages-v1';
const ACTIVITY_KEY = 'kebo-activity-v1';
const AGENT_KEY = 'kebo-agent-v1';

const TICK_MS = 15_000;
const AGENT_TICK_MS = 10_000;
const QUIET_MS = 30 * 60_000;
const ANALYSIS_TIMEOUT_MS = 3_000;
const MAX_MESSAGES = 200;
const MAX_ACTIVITY = 120;

let counter = 0;
const newId = (prefix = 'm') => `${prefix}-${Date.now()}-${counter++}`;

/* ───────────────────────────── Persistence ───────────────────────────── */

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full / disabled */ }
}

function isNum(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Accepts any stored personality (including the old Big-Five shape) and returns the 7-trait model. */
function migratePersonality(value: unknown): Personality {
  const candidate = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const out = { ...DEFAULT_PERSONALITY };
  for (const { key } of PERSONALITY_TRAITS) {
    if (isNum(candidate[key])) out[key] = Math.min(1, Math.max(0, candidate[key] as number));
  }
  return out;
}

function freshState(now = Date.now()): KeboState {
  return {
    emotion: deriveEmotion(DEFAULT_STATS, DEFAULT_PERSONALITY),
    emotionUntil: 0,
    stats: { ...DEFAULT_STATS },
    personality: { ...DEFAULT_PERSONALITY },
    activity: 'idle',
    lastInteraction: now,
    lastUserMessageAt: now,
    relationship: createRelationship(now),
  };
}

function loadState(timeScale: number): KeboState {
  const now = Date.now();
  const stored = readJson<Partial<KeboState>>(STATE_KEY) ?? readJson<Partial<KeboState>>(LEGACY_STATE_KEY);
  if (!stored || typeof stored !== 'object' || !stored.stats) return freshState(now);

  const base = freshState(now);
  const statKeys = ['energy', 'happiness', 'bond', 'hunger', 'stimulation', 'annoyance'] as const;
  const stats = { ...base.stats };
  for (const key of statKeys) if (isNum(stored.stats[key])) stats[key] = stored.stats[key];

  const lastInteraction = isNum(stored.lastInteraction) ? stored.lastInteraction : now;
  // Catch up on time away (Kebo got hungrier, less stimulated, calmer...).
  let restored = decayStats(stats, Math.max(0, now - lastInteraction), timeScale);
  // Rescue states broken by older builds (everything drained to ~0).
  if (restored.energy <= 5 && restored.happiness <= 5) {
    restored = { ...restored, energy: 72, happiness: 60, stimulation: Math.max(restored.stimulation, 45), annoyance: Math.min(restored.annoyance, 20) };
  }

  const personality = migratePersonality(stored.personality);
  const relationship = { ...createRelationship(isNum(stored.relationship?.firstMetAt) ? stored.relationship.firstMetAt : now), ...(stored.relationship ?? {}) };
  if (!Array.isArray(relationship.milestones)) relationship.milestones = [];

  return {
    emotion: deriveEmotion(restored, personality),
    emotionUntil: 0,
    stats: restored,
    personality,
    activity: 'idle',
    lastInteraction: now,
    lastUserMessageAt: isNum(stored.lastUserMessageAt) ? stored.lastUserMessageAt : lastInteraction,
    relationship,
  };
}

function loadMessages(): Message[] {
  const stored = readJson<Message[]>(MESSAGES_KEY);
  if (!Array.isArray(stored)) return [];
  return stored
    .filter((m) => m && (m.sender === 'user' || m.sender === 'kebo') && typeof m.text === 'string' && isNum(m.createdAt))
    .map((m) => ({ ...m, emotion: m.emotion in EMOTIONS ? m.emotion : 'calm' }))
    .slice(-MAX_MESSAGES);
}

interface AgentRuntime {
  lastAutonomousMessageAt: number;
  lastAutonomousActionAt: number;
  unansweredAutonomous: number;
  quietUntil: number;
}

function loadAgentRuntime(): AgentRuntime {
  const stored = readJson<Partial<AgentRuntime>>(AGENT_KEY) ?? {};
  return {
    lastAutonomousMessageAt: isNum(stored.lastAutonomousMessageAt) ? stored.lastAutonomousMessageAt : Date.now(),
    lastAutonomousActionAt: isNum(stored.lastAutonomousActionAt) ? stored.lastAutonomousActionAt : 0,
    unansweredAutonomous: isNum(stored.unansweredAutonomous) ? stored.unansweredAutonomous : 0,
    quietUntil: isNum(stored.quietUntil) ? stored.quietUntil : 0,
  };
}

function welcomeMessage(state: KeboState, memories: KeboMemory[], returning: boolean): Message {
  const name = memories.find((m) => /name is|called/i.test(m.text))?.text.match(/(?:is|called) ([^.]+)\./i)?.[1];
  const text = returning
    ? `Welcome back${name ? `, ${name}` : ''}! 🌱 I missed you. ${state.stats.hunger < 30 ? "I'm a little hungry, though." : 'How have you been?'}`
    : "Hi! I'm Kebo 🌱 — a little plant who remembers, feels, and grows with you. What should I call you?";
  return { id: newId(), sender: 'kebo', text, emotion: returning ? 'joy' : 'curious', createdAt: Date.now() };
}

const CARE_LABELS: Record<CareAction, { log: string; reply: string }> = {
  feed: { log: 'You fed Kebo.', reply: 'Mmm, thank you! That hit the spot. 🌱' },
  water: { log: 'You watered Kebo.', reply: "Ahh, cool and fresh — thank you! 💧" },
  sun: { log: 'You moved Kebo into the sunlight.', reply: 'Warm sunshine… I feel so awake! ☀️' },
  play: { log: 'You played with Kebo.', reply: "That was fun! Again later? 🍃" },
  rest: { log: 'You let Kebo rest.', reply: "Zzz… thanks for letting me rest a bit. 😴" },
};

/* ──────────────────────────────── Hook ──────────────────────────────── */

export function useKebo() {
  const [settings, setSettingsState] = useState<KeboSettings>(loadSettings);
  const [state, setState] = useState<KeboState>(() => loadState(timeScaleOf(loadSettings())));
  const [messages, setMessages] = useState<Message[]>(loadMessages);
  const [memories, setMemories] = useState<KeboMemory[]>(loadMemories);
  const [activityLog, setActivityLog] = useState<ActivityEntry[]>(() => readJson<ActivityEntry[]>(ACTIVITY_KEY) ?? []);
  const [isThinking, setIsThinking] = useState(false);
  const [thoughtBubble, setThoughtBubble] = useState<string | null>(null);
  const [backendStatus, setBackendStatus] = useState<BackendStatus>('checking');

  const stateRef = useRef(state);
  const messagesRef = useRef(messages);
  const memoriesRef = useRef(memories);
  const settingsRef = useRef(settings);
  const backendRef = useRef<BackendStatus>('checking');
  const agentRef = useRef<AgentRuntime>(loadAgentRuntime());
  const activityUntil = useRef(0);
  const agentBusy = useRef(false);
  const requestId = useRef(0);
  const abortController = useRef<AbortController | null>(null);
  const thoughtTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remoteMemoriesLoaded = useRef(false);

  useEffect(() => {
    stateRef.current = state;
    messagesRef.current = messages;
    memoriesRef.current = memories;
    settingsRef.current = settings;
    backendRef.current = backendStatus;
  }, [state, messages, memories, settings, backendStatus]);

  /* ── Persistence ── */
  useEffect(() => { writeJson(STATE_KEY, state); }, [state]);
  useEffect(() => { writeJson(MESSAGES_KEY, messages.slice(-MAX_MESSAGES)); }, [messages]);
  useEffect(() => { writeJson(ACTIVITY_KEY, activityLog.slice(0, MAX_ACTIVITY)); }, [activityLog]);
  useEffect(() => { saveSettings(settings); }, [settings]);
  useEffect(() => {
    saveMemories(memories);
    if (remoteMemoriesLoaded.current) {
      void saveRemoteMemories(memories).catch((error) => console.warn('[Kebo] Remote memory save failed:', error));
    }
  }, [memories]);

  useEffect(() => {
    let active = true;
    void loadRemoteMemories()
      .then((remote) => {
        if (!active || !remote) return;
        remoteMemoriesLoaded.current = true;
        setMemories(remote);
        memoriesRef.current = remote;
      })
      .catch((error) => {
        remoteMemoriesLoaded.current = true;
        console.warn('[Kebo] Remote memory load failed; using local memory:', error);
      });
    return () => { active = false; };
  }, []);

  /* ── Helpers ── */
  const log = useCallback((entry: Omit<ActivityEntry, 'id' | 'at'> & { at?: number }) => {
    setActivityLog((current) => [{ id: newId('a'), at: Date.now(), ...entry }, ...current].slice(0, MAX_ACTIVITY));
  }, []);

  const showThought = useCallback((text: string, durationMs = 4000) => {
    if (thoughtTimer.current) clearTimeout(thoughtTimer.current);
    setThoughtBubble(text);
    thoughtTimer.current = setTimeout(() => setThoughtBubble(null), durationMs);
  }, []);

  const commitState = useCallback((next: KeboState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const pushMessage = useCallback((message: Message) => {
    messagesRef.current = [...messagesRef.current, message];
    setMessages((current) => [...current, message]);
  }, []);

  const persistAgent = () => writeJson(AGENT_KEY, agentRef.current);

  /* ── Backend health ── */
  useEffect(() => {
    let alive = true;
    const run = async () => {
      const status = await checkBackend(AbortSignal.timeout(6000));
      if (alive) setBackendStatus(status);
    };
    void run();
    const interval = setInterval(run, 45_000);
    return () => { alive = false; clearInterval(interval); };
  }, []);

  /* ── First run / welcome back ── */
  const welcomed = useRef(false);
  useEffect(() => {
    if (welcomed.current) return;
    welcomed.current = true;
    const current = stateRef.current;
    const away = Date.now() - current.lastUserMessageAt;
    if (messagesRef.current.length === 0) {
      pushMessage(welcomeMessage(current, memoriesRef.current, false));
    } else if (away > 30 * 60_000) {
      pushMessage(welcomeMessage(current, memoriesRef.current, true));
      log({ kind: 'system', text: 'Kebo greeted you after you were away.' });
    }
  }, [log, pushMessage]);

  /* ── Passive time: decay + mood follows vitals once a pulse expires ── */
  useEffect(() => {
    const tick = () => {
      const prev = stateRef.current;
      const now = Date.now();
      const scale = timeScaleOf(settingsRef.current);
      const stats = decayStats(prev.stats, now - prev.lastInteraction, scale, prev.activity === 'resting');
      let { activity } = prev;
      if (now > activityUntil.current && (activity === 'playing' || activity === 'exploring' || activity === 'resting' || activity === 'feeding')) activity = 'idle';
      const emotion = now > prev.emotionUntil ? deriveEmotion(stats, prev.personality) : prev.emotion;
      commitState({ ...prev, stats, emotion, activity, lastInteraction: now });
    };
    const interval = setInterval(tick, TICK_MS);
    return () => clearInterval(interval);
  }, [commitState]);

  /* ── Autonomous agent loop ── */
  useEffect(() => {
    const run = async () => {
      if (agentBusy.current || (document.visibilityState === 'hidden' && !settingsRef.current.notifications)) return;
      const now = Date.now();
      const current = stateRef.current;
      const agent = agentRef.current;
      const decision = decideAction({
        state: current,
        memories: settingsRef.current.memoryEnabled ? memoriesRef.current : [],
        settings: settingsRef.current,
        now,
        lastAutonomousMessageAt: agent.lastAutonomousMessageAt,
        lastAutonomousActionAt: agent.lastAutonomousActionAt,
        unansweredAutonomous: agent.unansweredAutonomous,
        quietUntil: agent.quietUntil,
      });
      if (decision.action === 'WAIT') return;

      agentBusy.current = true;
      try {
        if (MESSAGE_ACTIONS.includes(decision.action)) {
          const fallback = composeAutonomousText(decision, current, memoriesRef.current, now);
          let text = fallback.text;
          const useLlm = settingsRef.current.llmInitiations && backendRef.current === 'online' && decision.action !== 'REFERENCE_MEMORY';
          if (useLlm) {
            try {
              text = await composeInitiatedMessage({
                action: decision.action,
                reason: decision.reason,
                keboState: current,
                recentConversation: messagesRef.current,
                memory: decision.memory?.text,
                signal: AbortSignal.timeout(8000),
              });
            } catch { /* template fallback */ }
          }
          if (stateRef.current.activity === 'talking' || stateRef.current.activity === 'thinking') return;
          pushMessage({ id: newId(), sender: 'kebo', text, emotion: fallback.emotion, createdAt: Date.now(), autonomous: true });
          agent.lastAutonomousMessageAt = Date.now();
          agent.unansweredAutonomous += 1;
          if (decision.memory && decision.action === 'REFERENCE_MEMORY' && decision.memory.type === 'event') {
            const next = markFollowedUp(memoriesRef.current, decision.memory.id);
            memoriesRef.current = next;
            setMemories(next);
          }
          log({ kind: 'autonomous', action: decision.action, text, reason: decision.reason });
          showThought(text.length > 90 ? `${text.slice(0, 87)}…` : text, 5000);
          if (settingsRef.current.notifications && document.visibilityState === 'hidden' && 'Notification' in window && Notification.permission === 'granted') {
            try { new Notification('Kebo 🌱', { body: text }); } catch { /* ignore */ }
          }
        } else {
          const text = ambientText(decision.action, current, now);
          const nextActivity = activityForAction(decision.action);
          if (nextActivity) {
            activityUntil.current = now + (decision.action === 'REST' ? 60_000 : 20_000);
            const stats = { ...stateRef.current.stats };
            if (decision.action === 'PLAY') { stats.happiness = Math.min(100, stats.happiness + 3); stats.stimulation = Math.min(100, stats.stimulation + 8); stats.energy = Math.max(0, stats.energy - 3); }
            if (decision.action === 'EXPLORE') { stats.stimulation = Math.min(100, stats.stimulation + 10); stats.energy = Math.max(0, stats.energy - 2); }
            commitState({ ...stateRef.current, stats, activity: nextActivity });
          }
          agent.lastAutonomousActionAt = now;
          log({ kind: 'autonomous', action: decision.action, text, reason: decision.reason });
        }
        persistAgent();
      } finally {
        agentBusy.current = false;
      }
    };
    const interval = setInterval(() => { void run(); }, AGENT_TICK_MS);
    return () => clearInterval(interval);
  }, [commitState, log, pushMessage, showThought]);

  /* ── Care actions (feed / water / sun / play / rest) ── */
  const care = useCallback((action: CareAction) => {
    const now = Date.now();
    const prev = stateRef.current;
    const change = applyCare(prev, action, now);
    const activity: Activity = action === 'play' ? 'playing' : action === 'rest' ? 'resting' : 'feeding';
    activityUntil.current = now + (action === 'rest' ? 45_000 : 8_000);
    const relationship = updateRelationship(prev.relationship, null, change.stats.bond, now, { care: true, memoryCount: memoriesRef.current.length });
    commitState({
      ...prev,
      stats: change.stats,
      emotion: change.emotion,
      emotionUntil: change.emotionUntil,
      activity,
      lastInteraction: now,
      lastUserMessageAt: now,
      relationship,
    });
    agentRef.current.unansweredAutonomous = 0;
    persistAgent();
    const labels = CARE_LABELS[action];
    pushMessage({ id: newId(), sender: 'kebo', text: labels.reply, emotion: change.emotion, createdAt: now });
    log({ kind: 'care', text: labels.log });
  }, [commitState, log, pushMessage]);

  /* ── Conversation ── */
  const sendMessage = useCallback((text: string) => {
    const trimmed = text.trim().slice(0, 1000);
    if (!trimmed || isThinking) return;
    const startedAt = Date.now();

    const userMessage: Message = { id: newId(), sender: 'user', text: trimmed, emotion: 'curious', createdAt: startedAt };
    pushMessage(userMessage);
    agentRef.current.unansweredAutonomous = 0;

    commitState({ ...stateRef.current, activity: 'thinking', lastUserMessageAt: startedAt });
    setIsThinking(true);

    const currentRequestId = ++requestId.current;
    abortController.current?.abort();
    const controller = new AbortController();
    abortController.current = controller;
    const cancelled = () => currentRequestId !== requestId.current || controller.signal.aborted;

    void (async () => {
      // 1) Understand the message (rules first; LLM only when the rules are unsure).
      let appraisal: Appraisal = appraiseMessage(trimmed);
      if (appraisal.confidence < 0.6 && backendRef.current === 'online' && !appraisal.safety) {
        try {
          const analysis = await analyzeKeboMessage(trimmed, stateRef.current.emotion, AbortSignal.any([controller.signal, AbortSignal.timeout(ANALYSIS_TIMEOUT_MS)]));
          appraisal = refineWithAnalysis(appraisal, analysis);
        } catch { /* keep the rule-based reading */ }
      }
      if (cancelled()) return;

      // 2) Update Kebo's internal state (appraisal -> vitals -> emotion).
      const before = stateRef.current;
      const now = Date.now();
      const change = applyAppraisal(before, appraisal, now);
      let stateAfter: KeboState = { ...before, stats: change.stats, emotion: change.emotion, emotionUntil: change.emotionUntil, lastInteraction: now, lastUserMessageAt: now };

      if (appraisal.care) {
        const careChange = applyCare(stateAfter, appraisal.care, now);
        stateAfter = { ...stateAfter, stats: careChange.stats, emotion: careChange.emotion, emotionUntil: careChange.emotionUntil };
        log({ kind: 'care', text: CARE_LABELS[appraisal.care].log });
      }
      if (appraisal.kind === 'request_quiet') {
        agentRef.current.quietUntil = now + QUIET_MS;
        log({ kind: 'system', text: 'You asked Kebo for quiet — it will not start conversations for 30 minutes.' });
      }
      stateAfter = {
        ...stateAfter,
        relationship: updateRelationship(before.relationship, appraisal, stateAfter.stats.bond, now, { care: Boolean(appraisal.care), memoryCount: memoriesRef.current.length }),
      };
      commitState(stateAfter);
      persistAgent();

      if (stateAfter.emotion !== before.emotion) {
        log({
          kind: 'emotion',
          text: `Mood changed: ${EMOTIONS[before.emotion].label} → ${EMOTIONS[stateAfter.emotion].label}`,
          reason: appraisal.situation.split('.')[0],
        });
      }

      // 3) Ask the LLM (or fall back to the local brain) with the full context.
      const settingsNow = settingsRef.current;
      const relevantMemories = settingsNow.memoryEnabled ? memoryContext(memoriesRef.current, trimmed) : [];
      let replyText: string;
      let llmMemories: string[] | null = null;
      try {
        const response = await askKeboLLM({
          message: trimmed,
          keboState: stateAfter,
          emotion: stateAfter.emotion,
          recentConversation: messagesRef.current,
          relevantMemories,
          situation: appraisal.situation,
          signal: controller.signal,
        });
        replyText = response.text;
        llmMemories = response.extractedMemories;
        if (backendRef.current !== 'online') setBackendStatus('online');
        if (relevantMemories.length) showThought(`Remembering: ${relevantMemories[0]}`, 3000);
      } catch (error) {
        if (cancelled()) return;
        console.warn('[Kebo] LLM unavailable, using local brain:', error instanceof Error ? error.message : error);
        setBackendStatus('offline');
        replyText = mockAgentRespond(stateAfter, trimmed).text;
      }
      if (cancelled()) return;

      // 4) Memory (episodic events are always extracted locally; facts prefer the LLM).
      if (settingsNow.memoryEnabled && !appraisal.safety) {
        const local = extractMemories(trimmed);
        const candidates = llmMemories === null ? local : [...llmMemories, ...local.filter((item) => item.startsWith('Upcoming '))];
        if (candidates.length) {
          const next = addMemories(memoriesRef.current, candidates);
          memoriesRef.current = next;
          setMemories(next);
          log({ kind: 'memory', text: `Kebo remembered: ${candidates[0]}` });
          stateAfter = { ...stateRef.current, relationship: updateRelationship(stateRef.current.relationship, null, stateRef.current.stats.bond, Date.now(), { memoryCount: next.length }) };
          commitState(stateAfter);
        }
      }

      // 5) Speak.
      commitState({ ...stateRef.current, activity: 'talking' });
      pushMessage({ id: newId(), sender: 'kebo', text: replyText, emotion: stateRef.current.emotion, createdAt: Date.now() });
      setIsThinking(false);
      setTimeout(() => {
        if (stateRef.current.activity === 'talking') commitState({ ...stateRef.current, activity: 'idle' });
      }, 2500);
    })();
  }, [commitState, isThinking, log, pushMessage, showThought]);

  useEffect(() => () => {
    requestId.current += 1;
    abortController.current?.abort();
    if (thoughtTimer.current) clearTimeout(thoughtTimer.current);
  }, []);

  /* ── Settings / data controls ── */
  const updateSettings = useCallback((patch: Partial<KeboSettings>) => {
    setSettingsState((current) => ({ ...current, ...patch }));
  }, []);

  const setPersonality = useCallback((patch: Partial<Personality>) => {
    const prev = stateRef.current;
    const personality = { ...prev.personality, ...patch };
    commitState({ ...prev, personality, emotion: deriveEmotion(prev.stats, personality), emotionUntil: 0 });
  }, [commitState]);

  const clearMessages = useCallback(() => {
    messagesRef.current = [];
    setMessages([]);
  }, []);

  const clearMemories = useCallback(() => {
    setMemories([]);
    memoriesRef.current = [];
    try { localStorage.removeItem('kebo-memories-v1'); } catch { /* ignore */ }
    void clearRemoteMemories().catch((error) => console.warn('[Kebo] Remote memory clear failed:', error));
  }, []);

  const deleteMemory = useCallback((id: string) => {
    const next = removeMemory(memoriesRef.current, id);
    memoriesRef.current = next;
    setMemories(next);
  }, []);

  const addManualMemory = useCallback((text: string) => {
    const next = addMemories(memoriesRef.current, [text]).map((memory) => (memory.text === text.trim().replace(/\s+/g, ' ') ? { ...memory, source: 'manual' as const } : memory));
    memoriesRef.current = next;
    setMemories(next);
  }, []);

  const clearActivity = useCallback(() => setActivityLog([]), []);

  const resetKebo = useCallback(() => {
    const fresh = freshState();
    commitState(fresh);
    agentRef.current = { lastAutonomousMessageAt: Date.now(), lastAutonomousActionAt: 0, unansweredAutonomous: 0, quietUntil: 0 };
    persistAgent();
    messagesRef.current = [];
    setMessages([welcomeMessage(fresh, [], false)]);
    setActivityLog([]);
  }, [commitState]);

  /** Demo helper: pretend the user has been away, so loneliness/hunger/agent behaviour become visible. */
  const simulateAway = useCallback((hours: number) => {
    const prev = stateRef.current;
    const ms = hours * 3_600_000;
    const stats = decayStats(prev.stats, ms, 1, false);
    commitState({ ...prev, stats, emotion: deriveEmotion(stats, prev.personality), emotionUntil: 0, lastUserMessageAt: prev.lastUserMessageAt - ms, lastInteraction: Date.now() });
    agentRef.current = { lastAutonomousMessageAt: 0, lastAutonomousActionAt: 0, unansweredAutonomous: 0, quietUntil: 0 };
    persistAgent();
    log({ kind: 'system', text: `Simulated ${hours} hours without you (demo tool).` });
  }, [commitState, log]);

  const exportData = useCallback(() => JSON.stringify({
    exportedAt: new Date().toISOString(),
    state: stateRef.current,
    settings: settingsRef.current,
    memories: memoriesRef.current,
    messages: messagesRef.current,
  }, null, 2), []);

  const agentPreview: AgentDecision = decideAction({
    state,
    memories: settings.memoryEnabled ? memories : [],
    settings,
    now: Date.now(),
    lastAutonomousMessageAt: agentRef.current.lastAutonomousMessageAt,
    lastAutonomousActionAt: agentRef.current.lastAutonomousActionAt,
    unansweredAutonomous: agentRef.current.unansweredAutonomous,
    quietUntil: agentRef.current.quietUntil,
  });

  return {
    agentPreview,
    simulateAway,
    state,
    messages,
    memories,
    activityLog,
    settings,
    backendStatus,
    isThinking,
    thoughtBubble,
    agentQuietUntil: agentRef.current.quietUntil,
    sendMessage,
    care,
    updateSettings,
    setPersonality,
    clearMessages,
    clearMemories,
    deleteMemory,
    addManualMemory,
    clearActivity,
    resetKebo,
    exportData,
  };
}
