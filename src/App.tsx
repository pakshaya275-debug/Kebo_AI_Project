import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MessageCircle, Mic, Brain, BarChart3, Settings, Sun, Moon, ChevronDown, Send, Star, ArrowRight, Heart, Activity as ActivityIcon } from 'lucide-react';
import { KeboCreature } from './components/KeboCreature';
import { useKebo } from './hooks/useKebo';
import { EMOTIONS, PERSONALITY_TRAITS, type Message } from './types/kebo';
import { lonelinessOf, type CareAction } from './lib/keboEngine';
import type { KeboMemory } from './lib/memory';
import { timeScaleOf } from './lib/settings';
import { MemoryView } from './views/MemoryView';
import { SettingsView } from './views/SettingsView';
import { RelationshipView } from './views/RelationshipView';
import { ActivityView } from './views/ActivityView';
import { useSpeechRecognition, type SpeechRecognitionControls } from './hooks/useSpeechRecognition';

type NavItem = 'chat' | 'voice' | 'memory' | 'relationship' | 'activity' | 'stats' | 'settings';

const PAGE_TITLES: Record<NavItem, string> = {
  chat: 'Chat with Kebo',
  voice: 'Voice Chat',
  memory: 'Memory',
  relationship: 'Relationship',
  activity: 'Activity',
  stats: 'Stats',
  settings: 'Settings',
};

const SPEECH_LANGUAGES = [
  ['auto', 'Auto-detect'],
  ['en-US', 'English (US)'],
  ['en-IN', 'English (India)'],
  ['hi-IN', 'Hindi'],
  ['ta-IN', 'Tamil'],
  ['te-IN', 'Telugu'],
  ['bn-IN', 'Bengali'],
  ['es-ES', 'Spanish'],
  ['fr-FR', 'French'],
  ['de-DE', 'German'],
  ['ja-JP', 'Japanese'],
  ['ko-KR', 'Korean'],
].map(([value, label]) => ({ value, label }));

const MOOD_PHRASES: Record<string, string> = {
  joy:     'Kebo is feeling cheerful and positive!',
  calm:    'Kebo is feeling relaxed and at peace.',
  curious: 'Kebo is feeling curious and engaged!',
  sad:     'Kebo is feeling a bit down and needs gentleness.',
  angry:   'Kebo is feeling frustrated and annoyed.',
  anxious: 'Kebo is feeling concerned and a little on edge.',
  tired:   'Kebo is feeling sleepy and low on energy.',
  playful: 'Kebo is feeling playful and energetic!',
};

function App() {
  const kebo = useKebo();
  const {
    state, messages, isThinking, memories, settings, backendStatus, thoughtBubble, activityLog, agentPreview,
    sendMessage, clearMessages, clearMemories, care, updateSettings,
  } = kebo;
  const [activeNav, setActiveNav] = useState<NavItem>('chat');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    try { return localStorage.getItem('kebo-theme') !== 'light'; } catch { return true; }
  });
  useEffect(() => {
    try { localStorage.setItem('kebo-theme', darkMode ? 'dark' : 'light'); } catch { /* ignore */ }
  }, [darkMode]);
  const voiceSessionRef = useRef(false);
  const voiceBaselineMessageRef = useRef<string | null>(null);
  const spokenVoiceMessageRef = useRef<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const handleVoiceTranscript = useCallback((transcript: string) => {
    voiceSessionRef.current = true;
    voiceBaselineMessageRef.current = messages[messages.length - 1]?.id || null;
    sendMessage(transcript);
  }, [messages, sendMessage]);
  const voice = useSpeechRecognition(handleVoiceTranscript);

  useEffect(() => {
    if (!voiceSessionRef.current || !settings.voiceReplies) return;
    const latest = messages[messages.length - 1];
    if (!latest || latest.sender !== 'kebo' || latest.id === spokenVoiceMessageRef.current || latest.id === voiceBaselineMessageRef.current) return;
    spokenVoiceMessageRef.current = latest.id;
    if (typeof window === 'undefined' || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
      setIsSpeaking(false);
      return;
    }
    try {
      const utterance = new SpeechSynthesisUtterance(latest.text);
      const voices = window.speechSynthesis.getVoices();
      const languagePrefix = voice.language.toLowerCase().split('-')[0];
      utterance.lang = voice.language;
      utterance.voice = voices.find((candidate) => candidate.lang.toLowerCase().startsWith(languagePrefix) && /female|child|samantha|zira|aria|jenny|google/i.test(candidate.name))
        || voices.find((candidate) => candidate.lang.toLowerCase().startsWith(languagePrefix))
        || null;
      utterance.pitch = 1.5;
      utterance.rate = settings.voiceRate;
      utterance.volume = 0.9;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    } catch (speechError) {
      console.warn('[Kebo] Speech synthesis unavailable:', speechError);
      setIsSpeaking(false);
    }
  }, [messages, voice.language, settings.voiceReplies, settings.voiceRate]);

  useEffect(() => () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  const moodPhrase = MOOD_PHRASES[state.emotion] ?? 'Existing in the moment.';
  const status = {
    checking: { dot: 'bg-amber-400', title: 'Connecting…', body: 'Reaching Kebo’s AI backend.' },
    online: { dot: 'bg-emerald-400 shadow-[0_0_8px_#34d399]', title: 'System Online', body: 'AI backend connected. Kebo is listening 🌱' },
    unconfigured: { dot: 'bg-amber-400', title: 'Backend needs a key', body: 'No LLM API key is set on the server. Kebo is using its simple built-in brain.' },
    offline: { dot: 'bg-rose-400', title: 'Offline mode', body: 'Backend unreachable. Kebo still works with its built-in brain and local memory.' },
  }[backendStatus];

  const navItems: { key: NavItem; label: string; icon: React.ReactNode }[] = [
    { key: 'chat', label: 'Chat', icon: <MessageCircle size={20} /> },
    { key: 'voice', label: 'Voice Chat', icon: <Mic size={20} /> },
    { key: 'memory', label: 'Memory', icon: <Brain size={20} /> },
    { key: 'relationship', label: 'Relationship', icon: <Heart size={20} /> },
    { key: 'activity', label: 'Activity', icon: <ActivityIcon size={20} /> },
    { key: 'stats', label: 'Stats', icon: <BarChart3 size={20} /> },
    { key: 'settings', label: 'Settings', icon: <Settings size={20} /> },
  ];

  const recentMemories = useMemo(() => {
    const sorted = [...memories].sort((a, b) => b.createdAt - a.createdAt);
    return sorted.slice(0, 3);
  }, [memories]);


  return (
    <div className={`kebo-shell h-screen w-full text-slate-100 flex overflow-hidden font-sans ${darkMode ? 'kebo-dark' : 'kebo-light'}`} data-theme={darkMode ? 'dark' : 'light'}>
      {/* ─── Left Sidebar ─── */}
      <aside className="hidden md:flex flex-col w-64 shrink-0 border-r border-white/5 bg-[#071511]/80 p-5 gap-6">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 grid place-items-center text-2xl shadow-lg shadow-emerald-500/30">
            🌱
          </div>
          <div>
            <h1 className="text-2xl font-bold text-emerald-400 leading-tight tracking-wide">KEBO</h1>
            <p className="text-xs text-slate-400">Your AI Plant Pet</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-1.5">
          {navItems.map((item) => (
            <button
              key={item.key}
              onClick={() => setActiveNav(item.key)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                activeNav === item.key
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <span className={activeNav === item.key ? 'text-emerald-400' : ''}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="flex-1" />

        {/* System Status */}
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className={`w-2.5 h-2.5 rounded-full ${status.dot} animate-pulse`} />
            <span className="text-sm font-semibold text-slate-200">{status.title}</span>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">{status.body}</p>
        </div>

        {/* Quote */}
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
          <p className="text-sm text-slate-400 leading-relaxed italic">
            "I may be a plant, but I feel deeply. <span className="text-emerald-400">🌱</span>"
          </p>
        </div>
      </aside>

      {/* ─── Main Content ─── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* ─── Top Bar ─── */}
        <header className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#071511]/40 backdrop-blur-sm">
          <h2 className="text-xl font-bold text-slate-100">{PAGE_TITLES[activeNav]}</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setDarkMode((v) => !v)}
              className="grid place-items-center w-9 h-9 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
              aria-label="Toggle theme"
            >
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen((v) => !v)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-white/5 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-slate-600 grid place-items-center text-sm font-semibold">U</div>
                <span className="text-sm font-medium text-slate-200">User</span>
                <ChevronDown size={16} className="text-slate-400" />
              </button>
              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-white/10 bg-slate-900/95 backdrop-blur-md shadow-2xl py-1 z-50">
                  <button
                    onClick={() => { clearMessages(); setUserMenuOpen(false); }}
                    className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-white/5 transition-colors"
                  >
                    Clear conversation
                  </button>
                  <button
                    onClick={() => { clearMemories(); setUserMenuOpen(false); }}
                    className="w-full text-left px-4 py-2 text-sm text-rose-400 hover:bg-rose-500/5 transition-colors"
                  >
                    Clear memories
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ─── Main Content Area (switches by nav) ─── */}
        <div className="kebo-main-grid flex-1 flex min-h-0 overflow-hidden p-3 pb-20 sm:p-6 md:pb-6 gap-6">
          {activeNav === 'memory' ? (
            <MemoryView
              memories={memories}
              settings={settings}
              onDelete={kebo.deleteMemory}
              onAdd={kebo.addManualMemory}
              onClear={clearMemories}
              onEnable={() => updateSettings({ memoryEnabled: true })}
            />
          ) : activeNav === 'relationship' ? (
            <RelationshipView state={state} />
          ) : activeNav === 'activity' ? (
            <ActivityView
              entries={activityLog}
              state={state}
              settings={settings}
              preview={agentPreview}
              onClear={kebo.clearActivity}
              onSimulateAway={kebo.simulateAway}
              quietUntil={kebo.agentQuietUntil}
            />
          ) : activeNav === 'stats' ? (
            <StatsView state={state} messages={messages} />
          ) : activeNav === 'settings' ? (
            <SettingsView
              settings={settings}
              personality={state.personality}
              backendStatus={backendStatus}
              onSettings={updateSettings}
              onPersonality={kebo.setPersonality}
              onClearMessages={clearMessages}
              onClearMemories={clearMemories}
              onReset={kebo.resetKebo}
              onExport={kebo.exportData}
            />
          ) : activeNav === 'voice' ? (
            <VoiceChatView voice={voice} messages={messages} isThinking={isThinking} isSpeaking={isSpeaking} state={state} />
          ) : (
            <DefaultChatLayout
              messages={messages}
              isThinking={isThinking}
              onSend={sendMessage}
              state={state}
              memories={memories}
              recentMemories={recentMemories}
              moodPhrase={moodPhrase}
              onOpenMemory={() => setActiveNav('memory')}
              onCare={care}
              thoughtBubble={thoughtBubble}
              timeScale={timeScaleOf(settings)}
            />
          )}
        </div>
      </div>

      {/* Mobile bottom navigation (the sidebar is hidden below md) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 flex justify-around border-t border-white/10 bg-[#071511]/95 backdrop-blur px-1 pt-1.5 pb-[max(0.4rem,env(safe-area-inset-bottom))]" aria-label="Primary">
        {navItems.map((item) => (
          <button
            key={item.key}
            onClick={() => setActiveNav(item.key)}
            aria-current={activeNav === item.key ? 'page' : undefined}
            className={`flex flex-col items-center gap-0.5 px-1.5 py-1 rounded-lg text-[9px] font-medium ${activeNav === item.key ? 'text-emerald-300' : 'text-slate-500'}`}
          >
            <span className="[&>svg]:w-[18px] [&>svg]:h-[18px]">{item.icon}</span>
            {item.label.replace(' Chat', '')}
          </button>
        ))}
      </nav>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes sparkle {
          0%, 100% { opacity: 0.15; transform: scale(0.8); }
          50% { opacity: 0.8; transform: scale(1.4); }
        }
      `}</style>
    </div>
  );
}

/* ─── Default Chat Layout (used for activeNav = chat) ─── */
function DefaultChatLayout({
  messages,
  isThinking,
  onSend,
  state,
  memories,
  recentMemories,
  moodPhrase,
  onOpenMemory,
  onCare,
  thoughtBubble,
  timeScale,
}: {
  messages: Message[];
  isThinking: boolean;
  onSend: (text: string) => void;
  state: ReturnType<typeof useKebo>['state'];
  memories: KeboMemory[];
  recentMemories: KeboMemory[];
  moodPhrase: string;
  onOpenMemory: () => void;
  onCare: (action: CareAction) => void;
  thoughtBubble: string | null;
  timeScale: number;
}) {
  const emotion = EMOTIONS[state.emotion];
  const loneliness = lonelinessOf(state, Date.now(), timeScale);
  return (
    <>
      {/* Chat Column */}
      <div className="flex-1 min-w-0 flex flex-col rounded-3xl border border-white/5 bg-white/[0.02] overflow-hidden min-h-0">
        {/* Compact Kebo strip for screens without the right-hand panel */}
        <div className="lg:hidden shrink-0 border-b border-white/5 p-3 space-y-3" style={{ background: `radial-gradient(ellipse at 15% 50%, ${emotion.color}22, transparent 60%)` }}>
          <div className="flex items-center gap-3">
            <div className="shrink-0 w-16 h-16 grid place-items-center">
              <KeboCreature emotion={state.emotion} activity={state.activity} energy={state.stats.energy} vitals={state.stats} size={64} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold" style={{ color: emotion.color }}>{emotion.label} {emotion.emoji}</p>
              <p className="text-[11px] text-slate-400 truncate">{thoughtBubble ? `💭 ${thoughtBubble}` : moodPhrase}</p>
              <div className="mt-1.5 grid grid-cols-3 gap-2 text-[10px] text-slate-500">
                <span>⚡ {Math.round(state.stats.energy)}%</span>
                <span>🍃 {Math.round(state.stats.hunger)}%</span>
                <span>👥 {Math.round(state.stats.bond)}%</span>
              </div>
            </div>
          </div>
          <CareButtons onCare={onCare} hunger={state.stats.hunger} energy={state.stats.energy} />
        </div>
        <ChatMessages messages={messages} isThinking={isThinking} onSend={onSend} />
      </div>

      {/* Right Panel: Kebo + Stats */}
      <div className="hidden lg:flex flex-col w-96 shrink-0 gap-4 overflow-y-auto custom-scroll min-h-0 h-full max-h-full pr-1">
        {/* Kebo Display */}
        <div
          className="relative rounded-3xl border border-white/5 overflow-hidden flex items-center justify-center py-4 min-h-[280px] shrink-0"
          style={{
            background: `radial-gradient(ellipse at 50% 60%, ${emotion.color}18 0%, transparent 65%), linear-gradient(180deg, #0a1812 0%, #06100c 100%)`,
          }}
        >
          {/* Background sparkle dots */}
          <div className="absolute inset-0 pointer-events-none">
            {Array.from({ length: 14 }).map((_, i) => (
              <div
                key={i}
                className="absolute w-1 h-1 rounded-full opacity-40"
                style={{
                  top: `${(i * 67) % 80 + 5}%`,
                  left: `${(i * 37) % 90 + 5}%`,
                  backgroundColor: emotion.color,
                  animation: `sparkle ${2 + (i % 3) * 0.7}s ease-in-out infinite`,
                  animationDelay: `${(i * 0.23) % 3}s`,
                }}
              />
            ))}
          </div>

          {/* Glow layer */}
          <div
            className="absolute inset-0 pointer-events-none transition-all duration-1000"
            style={{
              background: `radial-gradient(circle at 50% 55%, ${emotion.color}30, transparent 55%)`,
              opacity: state.stats.annoyance > 30 ? 0.85 : 0.55,
            }}
          />

          {thoughtBubble && (
            <div className="absolute top-3 left-4 right-4 z-20 rounded-2xl border border-white/10 bg-slate-900/85 px-3.5 py-2 text-xs text-slate-200 shadow-lg backdrop-blur animate-[fadeIn_.3s_ease]">
              💭 {thoughtBubble}
            </div>
          )}
          <div className="relative z-10">
            <KeboCreature
              emotion={state.emotion}
              activity={state.activity}
              energy={state.stats.energy}
              vitals={state.stats}
              size={220}
            />
          </div>
        </div>

        {/* Current Emotion */}
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-slate-100">Current Emotion</h3>
            <span
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
              style={{ backgroundColor: `${emotion.color}22`, color: emotion.color, border: `1px solid ${emotion.color}33` }}
            >
              <span>{emotion.label}</span>
              <span>{emotion.emoji}</span>
            </span>
          </div>
          <p className="text-sm text-slate-400 mb-3">{moodPhrase}</p>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${emotionIntensity(state)}%`,
                  backgroundColor: emotion.color,
                  boxShadow: `0 0 8px ${emotion.color}66`,
                }}
              />
            </div>
            <span className="text-sm font-mono tabular-nums text-slate-300">
              {emotionIntensity(state)}%
            </span>
          </div>
        </div>

        {/* Vitals */}
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 shrink-0">
          <h3 className="text-sm font-bold text-slate-100 mb-3">Vitals</h3>
          <div className="space-y-3">
            <VitalBar label="Energy"      value={state.stats.energy}      color="#10b981" icon="⚡" />
            <VitalBar label="Happiness"   value={state.stats.happiness}   color="#f59e0b" icon="💚" />
            <VitalBar label="Bond"        value={state.stats.bond}        color="#ec4899" icon="👥" />
            <VitalBar label="Fullness"    value={state.stats.hunger}      color="#22c55e" icon="🍃" warnLow />
            <VitalBar label="Stimulation" value={state.stats.stimulation} color="#fbbf24" icon="⭐" />
            <VitalBar label="Annoyance"   value={state.stats.annoyance}   color="#ef4444" icon="😡" warnHigh />
            <VitalBar label="Loneliness"  value={loneliness}              color="#a78bfa" icon="🫧" warnHigh />
          </div>
        </div>

        {/* Care */}
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 shrink-0">
          <h3 className="text-sm font-bold text-slate-100 mb-3">Take care of Kebo</h3>
          <CareButtons onCare={onCare} hunger={state.stats.hunger} energy={state.stats.energy} />
        </div>

        {/* Recent Memory */}
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 shrink-0">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-100">Recent Memory</h3>
            <span className="text-[10px] text-slate-500 tabular-nums">{memories.length} stored</span>
          </div>
          {recentMemories.length === 0 ? (
            <div className="py-4">
              <p className="text-xs text-slate-500 text-center leading-relaxed">
                Tell Kebo something about you —<br />e.g. "My name is Akshaya"
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentMemories.map((m) => (
                <div key={m.id} className="flex items-start gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0 shadow-[0_0_4px_#34d399]" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-300 leading-relaxed break-words">{m.text}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-slate-600 tabular-nums">{formatTime(m.createdAt)}</span>
                      {m.importance >= 0.7 && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-amber-400/80">
                          <Star size={9} fill="currentColor" /> important
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={onOpenMemory}
            className="mt-4 w-full flex items-center justify-between px-3.5 py-2 rounded-xl border border-white/5 bg-white/[0.02] text-xs text-slate-400 hover:bg-white/5 hover:text-slate-200 hover:border-emerald-500/20 transition-colors"
          >
            <span>View All Memories</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </>
  );
}

function emotionIntensity(state: ReturnType<typeof useKebo>['state']): number {
  const { energy, happiness, stimulation, annoyance } = state.stats;
  let signal = 50;

  switch (state.emotion) {
    case 'joy':
      signal = happiness;
      break;
    case 'calm':
      signal = 100 - annoyance;
      break;
    case 'curious':
      signal = stimulation;
      break;
    case 'sad':
      signal = 100 - happiness;
      break;
    case 'angry':
      signal = annoyance;
      break;
    case 'anxious':
      signal = (stimulation + (100 - happiness)) / 2;
      break;
    case 'tired':
      signal = 100 - energy;
      break;
    case 'playful':
      signal = (happiness + energy + stimulation) / 3;
      break;
  }

  return Math.round(Math.max(25, Math.min(100, signal)));
}

/* ─── Vital bar ─── */
function VitalBar({ label, value, color, icon, warnHigh, warnLow }: {
  label: string;
  value: number;
  color: string;
  icon: string;
  warnHigh?: boolean;
  warnLow?: boolean;
}) {
  const pct = Math.round(value);
  const isWarnLow = warnLow && pct < 30;
  const isWarnHigh = warnHigh && pct > 30;
  const showWarn = isWarnLow || isWarnHigh;
  const effectiveColor = showWarn ? '#ef4444' : color;

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="flex items-center gap-2 text-xs font-medium text-slate-300">
          <span className="text-sm">{icon}</span>
          {label}
        </span>
        <span className={`text-xs font-mono tabular-nums ${showWarn ? 'text-rose-400' : 'text-slate-400'}`}>
          {pct}%
        </span>
      </div>
      <div className="h-2 rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${pct}%`,
            backgroundColor: effectiveColor,
            boxShadow: showWarn ? `0 0 6px ${effectiveColor}88` : 'none',
          }}
        />
      </div>
    </div>
  );
}

/* ─── Chat messages + input ─── */
function ChatMessages({ messages, isThinking, onSend }: {
  messages: Message[];
  isThinking: boolean;
  onSend: (text: string) => void;
}) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isThinking]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 140)}px`;
  }, [input]);

  const submit = () => {
    if (!input.trim() || isThinking) return;
    onSend(input.trim());
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const canSend = input.trim().length > 0 && !isThinking;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-8 py-6 space-y-5 custom-scroll"
      >
        {/* Empty / greeting state */}
        {messages.length === 0 && !isThinking && (
          <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center px-4">
            <div className="text-5xl mb-4 select-none">🌱</div>
            <h3 className="text-lg font-bold text-slate-100 mb-2">Hi, I'm Kebo!</h3>
            <p className="text-sm text-slate-400 max-w-sm leading-relaxed">
              Your plant-like companion. Talk to me and my emotions will change based on our conversation.
            </p>
          </div>
        )}

        {/* Messages */}
        {messages.map((msg, i) => {
          const prev = messages[i - 1];
          const showTs = !prev || msg.createdAt - prev.createdAt > 5 * 60 * 1000;
          return (
            <div key={msg.id}>
              {showTs && null}
              <ChatBubble msg={msg} prevMsg={prev} />
            </div>
          );
        })}

        {/* Thinking */}
        {isThinking && (
          <div className="flex items-start gap-3 msg-in">
            <div className="shrink-0 w-9 h-9 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 grid place-items-center text-lg">🌱</div>
            <div className="px-4 py-3 rounded-2xl rounded-bl-sm bg-slate-800/60 border border-slate-700/40">
              <p className="text-xs text-slate-400 mb-2.5 font-medium">Kebo is thinking...</p>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" style={{ animation: 'dot 1.2s infinite 0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" style={{ animation: 'dot 1.2s infinite 150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" style={{ animation: 'dot 1.2s infinite 300ms' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 sm:p-6 pt-2">
        <form
          onSubmit={(e) => { e.preventDefault(); submit(); }}
          className="flex items-end gap-3 rounded-2xl bg-slate-800/50 px-4 py-3 border border-slate-700/50 focus-within:border-emerald-500/40 transition-colors"
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            className="flex-1 bg-transparent outline-none text-sm text-slate-100 placeholder:text-slate-500 resize-none leading-relaxed pt-1"
            style={{ maxHeight: '140px' }}
            disabled={isThinking}
          />
          <button
            type="submit"
            disabled={!canSend}
            className="shrink-0 grid place-items-center w-10 h-10 rounded-xl bg-emerald-500 text-white disabled:opacity-30 hover:bg-emerald-400 active:scale-95 transition-all shadow-lg shadow-emerald-500/20"
            aria-label="Send message"
          >
            <Send size={18} />
          </button>
        </form>
      </div>

      <style>{`
        .custom-scroll::-webkit-scrollbar { width: 6px; }
        .custom-scroll::-webkit-scrollbar-thumb { background: rgba(148, 163, 184, 0.2); border-radius: 3px; }
        .custom-scroll::-webkit-scrollbar-thumb:hover { background: rgba(148, 163, 184, 0.35); }
        .custom-scroll::-webkit-scrollbar-track { background: transparent; }
        @keyframes dot {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.35; }
          40% { transform: translateY(-4px); opacity: 1; }
        }
        @keyframes msg-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .msg-in { animation: msg-in 0.3s ease-out; }
      `}</style>
    </div>
  );
}

function ChatBubble({ msg, prevMsg }: { msg: Message; prevMsg?: Message }) {
  const isKebo = msg.sender === 'kebo';
  const e = EMOTIONS[msg.emotion];
  const showMeta = !prevMsg || prevMsg.sender !== msg.sender;

  if (!isKebo) {
    // User bubble
    return (
      <div className="flex items-end justify-end gap-3 msg-in">
        <div className="flex flex-col items-end gap-1.5 max-w-[78%]">
          {showMeta && (
            <div className="flex items-center gap-2 px-0.5">
              <span className="text-[11px] text-slate-500 tabular-nums">You</span>
              <span className="text-[11px] text-slate-600 tabular-nums">{formatTime(msg.createdAt)}</span>
            </div>
          )}
          <div className="rounded-2xl rounded-tr-sm bg-emerald-600/90 text-white px-4 py-3 text-sm leading-relaxed shadow-lg shadow-emerald-500/10 border border-emerald-500/20">
            {msg.text}
          </div>
        </div>
        <div className="shrink-0 w-9 h-9 rounded-2xl bg-slate-600/50 border border-slate-500/30 grid place-items-center text-sm font-bold text-slate-300">
          👤
        </div>
      </div>
    );
  }

  // Kebo bubble
  return (
    <div className="flex items-end gap-3 msg-in">
      <div
        className="shrink-0 w-9 h-9 rounded-2xl grid place-items-center text-lg"
        style={{ backgroundColor: `${e.color}15`, border: `1px solid ${e.color}33` }}
      >
        🌱
      </div>
      <div className="flex flex-col gap-1.5 max-w-[78%]">
        {showMeta && (
          <div className="flex items-center gap-2 px-0.5">
            <span className="text-[11px] font-semibold" style={{ color: e.color }}>Kebo</span>
            <span className="text-[11px] text-slate-600 tabular-nums">{formatTime(msg.createdAt)}</span>
          </div>
        )}
        <div
          className="rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed"
          style={{
            backgroundColor: `${e.color}0d`,
            border: `1px solid ${e.color}22`,
          }}
        >
          <p className="text-slate-100">{msg.text}</p>
        </div>
      </div>
    </div>
  );
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
}

/* ─── Full Memory View ─── */
/* ─── Stats View ─── */
function StatsView({ state, messages }: { state: ReturnType<typeof useKebo>['state']; messages: Message[] }) {
  const messagesSent = messages.filter((m) => m.sender === 'user').length;
  const messagesReceived = messages.filter((m) => m.sender === 'kebo').length;
  const emotion = EMOTIONS[state.emotion];
  const vitals = [
    { key: 'Energy', value: state.stats.energy, color: '#10b981', icon: '⚡' },
    { key: 'Happiness', value: state.stats.happiness, color: '#f59e0b', icon: '💚' },
    { key: 'Bond', value: state.stats.bond, color: '#ec4899', icon: '👥' },
    { key: 'Fullness', value: state.stats.hunger, color: '#22c55e', icon: '🌱' },
    { key: 'Stimulation', value: state.stats.stimulation, color: '#fbbf24', icon: '⭐' },
    { key: 'Annoyance', value: state.stats.annoyance, color: '#ef4444', icon: '😡' },
  ] as const;

  return (
    <div className="flex-1 min-w-0 flex flex-col gap-6 overflow-y-auto custom-scroll">
      <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-6 sm:p-8">
        <h3 className="text-xl font-bold text-slate-100 mb-5 flex items-center gap-2">
          <BarChart3 className="text-emerald-400" size={22} />
          Overview
        </h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Current Emotion" value={emotion.label} sub={emotion.emoji + ' ' + EMOTION_DESCRIPTIONS[state.emotion]} color={emotion.color} />
          <StatCard label="You've said" value={String(messagesSent)} sub={messagesSent === 1 ? 'message' : 'messages'} />
          <StatCard label="Kebo replied" value={String(messagesReceived)} sub={messagesReceived === 1 ? 'response' : 'responses'} />
        </div>
      </div>

      <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-6 sm:p-8">
        <h3 className="text-lg font-bold text-slate-100 mb-5">Vitals</h3>
        <div className="grid gap-5 sm:grid-cols-2">
          {vitals.map((v) => (
            <div key={v.key}>
              <div className="flex items-center justify-between mb-2">
                <span className="flex items-center gap-2 text-sm font-medium text-slate-200">
                  <span>{v.icon}</span>
                  {v.key}
                </span>
                <span className="text-sm font-mono tabular-nums text-slate-300">{Math.round(v.value)}%</span>
              </div>
              <div className="h-3 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${v.value}%`,
                    backgroundColor: v.color,
                    boxShadow: `0 0 10px ${v.color}55`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-6 sm:p-8">
        <h3 className="text-lg font-bold text-slate-100 mb-4">Personality</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {(
            [
              ...PERSONALITY_TRAITS.map(({ key, label }) => ({ k: label, v: state.personality[key] })),
            ] as const
          ).map((t) => (
            <div key={t.k}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-slate-300">{t.k}</span>
                <span className="text-[11px] font-mono tabular-nums text-slate-400">{Math.round(t.v * 100)}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${t.v * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const EMOTION_DESCRIPTIONS: Record<string, string> = {
  joy:     'Cheerful and positive',
  calm:    'Relaxed and at peace',
  curious: 'Curious and engaged',
  sad:     'Feeling a bit down',
  angry:   'Frustrated and annoyed',
  anxious: 'A little on edge',
  tired:   'Sleepy, needs a rest',
  playful: 'Playful and bouncy',
};

function StatCard({ label, value, sub, color }: { label: string; value: string; sub: string; color?: string }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 sm:p-5">
      <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-2">{label}</p>
      <p
        className="text-2xl font-extrabold tabular-nums mb-1"
        style={color ? { color } : undefined}
      >
        {value}
      </p>
      <p className="text-xs text-slate-400">{sub}</p>
    </div>
  );
}

/* ─── Care buttons ─── */
function CareButtons({ onCare, hunger, energy }: { onCare: (action: CareAction) => void; hunger: number; energy: number }) {
  const actions: { key: CareAction; emoji: string; label: string; hot: boolean }[] = [
    { key: 'feed', emoji: '🍎', label: 'Feed', hot: hunger < 35 },
    { key: 'water', emoji: '💧', label: 'Water', hot: hunger < 35 },
    { key: 'sun', emoji: '☀️', label: 'Sunlight', hot: energy < 40 },
    { key: 'play', emoji: '🎾', label: 'Play', hot: false },
    { key: 'rest', emoji: '😴', label: 'Rest', hot: energy < 25 },
  ];
  return (
    <div className="grid grid-cols-5 gap-2">
      {actions.map((a) => (
        <button
          key={a.key}
          onClick={() => onCare(a.key)}
          className={`flex flex-col items-center gap-1 rounded-xl border py-2.5 text-[11px] font-semibold transition-colors ${a.hot ? 'border-amber-400/40 bg-amber-400/10 text-amber-200 animate-pulse' : 'border-white/5 bg-white/[0.02] text-slate-300 hover:bg-white/5 hover:border-emerald-500/20'}`}
        >
          <span className="text-lg leading-none">{a.emoji}</span>
          {a.label}
        </button>
      ))}
    </div>
  );
}


function VoiceChatView({ voice, messages, isThinking, isSpeaking, state }: { voice: SpeechRecognitionControls; messages: Message[]; isThinking: boolean; isSpeaking: boolean; state: ReturnType<typeof useKebo>['state'] }) {
  const latestReply = [...messages].reverse().find((message) => message.sender === 'kebo');
  return (
    <div className="flex-1 min-w-0 flex items-center justify-center rounded-3xl border border-white/5 bg-white/[0.02] p-8">
      <div className="max-w-lg w-full text-center">
        <div className={`relative w-40 h-40 mx-auto mb-5 rounded-full grid place-items-center transition-all ${voice.isListening || isSpeaking ? 'bg-emerald-500/15 border-emerald-400/50 shadow-[0_0_45px_rgba(16,185,129,.35)]' : 'bg-emerald-500/5 border-emerald-500/20'} border`}>
          <KeboCreature emotion={state.emotion} activity={isSpeaking ? 'talking' : voice.isListening ? 'thinking' : 'idle'} energy={state.stats.energy} size={150} />
          <span className="absolute -bottom-2 right-1/2 translate-x-1/2 text-xl">{voice.isListening ? '🎙️' : isSpeaking ? '🔊' : '🌱'}</span>
        </div>
        <h3 className="text-xl font-bold text-slate-100 mb-2">{voice.isListening ? 'Kebo is listening...' : isThinking ? 'Kebo is thinking...' : isSpeaking ? 'Kebo is speaking...' : 'Talk to Kebo'}</h3>
        <p className="text-sm text-slate-400 leading-relaxed min-h-10">
          {voice.isListening ? voice.transcript || 'Listening...' : isThinking ? 'Kebo is thinking...' : isSpeaking ? latestReply?.text || 'Kebo is speaking...' : voice.transcript || latestReply?.text || 'Press the microphone and speak. Kebo will answer aloud.'}
        </p>
        <button
          type="button"
          onClick={voice.isListening ? voice.stopListening : voice.startListening}
          disabled={!voice.isSupported}
          className={`mt-6 inline-flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-semibold transition-all ${voice.isSupported ? 'bg-emerald-500 hover:bg-emerald-400 text-white' : 'bg-slate-700 text-slate-400 cursor-not-allowed'}`}
        >
          <Mic size={18} />
          {voice.isListening ? 'Stop listening' : 'Start speaking'}
        </button>
        <label className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-500">
          Language
          <select
            value={voice.language}
            onChange={(event) => voice.setLanguage(event.target.value)}
            className="rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-slate-300 outline-none"
            disabled={voice.isListening}
          >
            {SPEECH_LANGUAGES.map((language) => (
              <option key={language.value} value={language.value}>{language.label}</option>
            ))}
          </select>
        </label>
        <p className={`mt-4 text-xs ${voice.error ? 'text-rose-400' : 'text-slate-500'}`}>
          {voice.error || (voice.isSupported ? 'Push to talk · Whisper transcription · Kebo replies aloud' : 'Audio recording is not supported in this browser. Use Chat instead.')}
        </p>
        <div className="mt-6 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
          Whisper voice input · multilingual
        </div>
      </div>
    </div>
  );
}

export default App;
