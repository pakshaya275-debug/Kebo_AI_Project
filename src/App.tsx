import { useEffect, useRef, useState } from 'react';
import { MessageCircle, Mic, Brain, BarChart3, Settings, Sun, Moon, ChevronDown, Send } from 'lucide-react';
import { KeboCreature } from './components/KeboCreature';
import { useKebo } from './hooks/useKebo';
import { EMOTIONS, type Message, type VitalStats } from './types/kebo';

type NavItem = 'chat' | 'voice' | 'memory' | 'stats' | 'settings';

const MOOD_PHRASES: Record<string, string> = {
  joy:     'Kebo is feeling cheerful and positive!',
  calm:    'Kebo is feeling relaxed and at peace.',
  curious: 'Kebo is feeling curious and engaged!',
  sad:     'Kebo is feeling a bit down...',
  angry:   'Kebo is feeling frustrated and annoyed.',
  anxious: 'Kebo is feeling a bit on edge.',
  tired:   'Kebo is feeling sleepy and low on energy.',
  playful: 'Kebo is feeling playful and energetic!',
};

function App() {
  const { state, messages, isThinking, sendMessage, clearMessages, clearMemories } = useKebo();
  const [activeNav, setActiveNav] = useState<NavItem>('chat');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(true);

  const emotion = EMOTIONS[state.emotion];
  const moodPhrase = MOOD_PHRASES[state.emotion] ?? 'Existing in the moment.';

  const navItems: { key: NavItem; label: string; icon: React.ReactNode }[] = [
    { key: 'chat', label: 'Chat', icon: <MessageCircle size={20} /> },
    { key: 'voice', label: 'Voice Chat', icon: <Mic size={20} /> },
    { key: 'memory', label: 'Memory', icon: <Brain size={20} /> },
    { key: 'stats', label: 'Stats', icon: <BarChart3 size={20} /> },
    { key: 'settings', label: 'Settings', icon: <Settings size={20} /> },
  ];

  const recentMemories = [
    { text: 'You said: "That\'s good to hear!"', time: Date.now() - 0 },
    { text: 'You asked: "How are you today?"', time: Date.now() - 60_000 },
    { text: 'Kebo joined the chat', time: Date.now() - 120_000 },
  ].filter((m, i) => i < 3);

  return (
    <div className="min-h-screen w-full bg-[#06100c] text-slate-100 flex overflow-hidden font-sans">
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
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse" />
            <span className="text-sm font-semibold text-slate-200">System Online</span>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Kebo is connected and listening <span className="text-emerald-400">🌱</span>
          </p>
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
        <header className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#071511]/40 backdrop-blur-sm">
          <h2 className="text-xl font-bold text-slate-100">Chat with Kebo</h2>
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

        {/* ─── Chat + Right Panel ─── */}
        <div className="flex-1 flex min-h-0 p-4 sm:p-6 gap-6">
          {/* Chat Column */}
          <div className="flex-1 min-w-0 flex flex-col rounded-3xl border border-white/5 bg-white/[0.02] overflow-hidden">
            <ChatMessages messages={messages} isThinking={isThinking} onSend={sendMessage} />
          </div>

          {/* Right Panel: Kebo + Stats */}
          <div className="hidden lg:flex flex-col w-96 shrink-0 gap-5 overflow-y-auto">
            {/* Kebo Display */}
            <div
              className="relative rounded-3xl border border-white/5 overflow-hidden flex items-center justify-center py-8 min-h-[340px]"
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
                      top: `${Math.random() * 80 + 5}%`,
                      left: `${Math.random() * 90 + 5}%`,
                      backgroundColor: emotion.color,
                      animation: `sparkle ${2 + Math.random() * 3}s ease-in-out infinite`,
                      animationDelay: `${Math.random() * 3}s`,
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

              <div className="relative z-10">
                <KeboCreature
                  emotion={state.emotion}
                  activity={state.activity}
                  energy={state.stats.energy}
                  vitals={state.stats}
                  size={260}
                />
              </div>
            </div>

            {/* Current Emotion */}
            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-slate-100">Current Emotion</h3>
                <span
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
                  style={{ backgroundColor: `${emotion.color}22`, color: emotion.color, border: `1px solid ${emotion.color}33` }}
                >
                  <span>{emotion.label}</span>
                  <span>{emotion.emoji}</span>
                </span>
              </div>
              <p className="text-sm text-slate-400 mb-4">{moodPhrase}</p>
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
            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
              <h3 className="text-sm font-bold text-slate-100 mb-4">Vitals</h3>
              <div className="space-y-3.5">
                <VitalBar label="Energy"      value={state.stats.energy}      color="#10b981" icon="⚡" />
                <VitalBar label="Happiness"   value={state.stats.happiness}   color="#f59e0b" icon="💚" />
                <VitalBar label="Bond"        value={state.stats.bond}        color="#ec4899" icon="👥" />
                <VitalBar label="Fullness"    value={state.stats.hunger}      color="#22c55e" icon="🌱" warnLow />
                <VitalBar label="Stimulation" value={state.stats.stimulation} color="#fbbf24" icon="⭐" />
                <VitalBar label="Annoyance"   value={state.stats.annoyance}   color="#ef4444" icon="😡" warnHigh />
              </div>
            </div>

            {/* Recent Memory */}
            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
              <h3 className="text-sm font-bold text-slate-100 mb-4">Recent Memory</h3>
              <div className="space-y-3">
                {recentMemories.map((m, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0 shadow-[0_0_4px_#34d399]" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-300 leading-relaxed">{m.text}</p>
                      <p className="text-[10px] text-slate-600 mt-0.5 tabular-nums">{formatTime(m.time)}</p>
                    </div>
                  </div>
                ))}
              </div>
              <button className="mt-4 w-full flex items-center justify-between px-3.5 py-2 rounded-xl border border-white/5 bg-white/[0.02] text-xs text-slate-400 hover:bg-white/5 hover:text-slate-200 transition-colors">
                <span>View All Memories</span>
                <ChevronDown size={14} className="rotate-[-90deg]" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes sparkle {
          0%, 100% { opacity: 0.15; transform: scale(0.8); }
          50% { opacity: 0.8; transform: scale(1.4); }
        }
      `}</style>
    </div>
  );
}

function emotionIntensity(state: ReturnType<typeof useKebo>['state']): number {
  const base = (state.stats.happiness + state.stats.bond + state.stats.energy) / 3;
  const annoy = state.stats.annoyance;
  const raw = annoy > 20 ? Math.max(30, 100 - annoy) : base;
  return Math.round(Math.max(10, Math.min(100, raw)));
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

export default App;
