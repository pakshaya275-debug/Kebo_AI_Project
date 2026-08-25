import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Gamepad2, UtensilsCrossed, Moon, Sparkles, Info, MoreHorizontal } from 'lucide-react';
import { KeboCreature } from './components/KeboCreature';
import { ChatPanel } from './components/ChatPanel';
import { EmotionBadge, VitalStatsPanel } from './components/VitalStatsPanel';
import { useKebo } from './hooks/useKebo';
import { EMOTIONS } from './types/kebo';

function App() {
  const { state, messages, isThinking, sendMessage, doActivity, clearMessages, clearMemories } = useKebo();
  const [showAbout, setShowAbout] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmClearMemories, setConfirmClearMemories] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const e = EMOTIONS[state.emotion];

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (ev: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(ev.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const handleClearChat = () => {
    clearMessages();
    setMenuOpen(false);
  };

  const handleClearMemoriesRequest = () => {
    setMenuOpen(false);
    setConfirmClearMemories(true);
  };

  const handleConfirmClearMemories = () => {
    clearMemories();
    setConfirmClearMemories(false);
  };

  return (
    <div className="min-h-screen text-slate-100 flex flex-col">
      {/* ─── Header ─── */}
      <header className="sticky top-0 z-30 px-4 sm:px-5 py-3 flex items-center justify-between border-b border-white/5 backdrop-blur-sm bg-black/20">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="grid place-items-center h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-400 text-slate-900 font-black text-base shadow-lg shadow-emerald-500/20 select-none">
            🌱
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight leading-none">Kebo</h1>
            <p className="text-[11px] text-slate-400 leading-none mt-0.5">Your living AI companion</p>
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {/* Online pill */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/5 text-[11px] text-emerald-400 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
            Online
          </div>

          {/* Info button */}
          <button
            onClick={() => setShowAbout((v) => !v)}
            className="grid place-items-center h-8 w-8 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
            aria-label="About Kebo"
          >
            <Info size={17} />
          </button>

          {/* ⋯ Menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="grid place-items-center h-8 w-8 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
              aria-label="More options"
            >
              <MoreHorizontal size={17} />
            </button>

            {menuOpen && (
              <div className="dropdown-menu absolute right-0 top-full mt-1.5 w-52 rounded-2xl border border-white/10 bg-slate-900/95 backdrop-blur-md shadow-2xl overflow-hidden z-50 py-1">
                <MenuItem
                  onClick={handleClearChat}
                  label="Clear conversation"
                  description="Removes visible chat"
                />
                <MenuItem
                  onClick={handleClearMemoriesRequest}
                  label="Clear Kebo's memories"
                  description="Removes long-term memory"
                  danger
                />
                <div className="my-1 border-t border-white/5" />
                <MenuItem
                  onClick={() => { setShowAbout(true); setMenuOpen(false); }}
                  label="About Kebo"
                />
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ─── Main ─── */}
      <main className="flex-1 mx-auto w-full max-w-5xl px-3 sm:px-4 py-4 sm:py-5 grid gap-4 sm:gap-5 lg:grid-cols-[1.1fr_1fr] lg:gap-6">

        {/* Left: creature + emotion + actions + vitals */}
        <section className="flex flex-col gap-4">
          {/* Creature card */}
          <div
            className="relative rounded-3xl border border-white/10 overflow-hidden flex flex-col items-center justify-center py-8 transition-all duration-700"
            style={{
              background: `radial-gradient(ellipse at 50% 40%, ${e.colorSoft}1f 0%, transparent 70%), linear-gradient(180deg, #0a1f15 0%, #07140d 100%)`,
            }}
          >
            {/* Soft glow behind creature */}
            <div
              className="absolute inset-0 opacity-40 pointer-events-none transition-all duration-700"
              style={{ background: `radial-gradient(circle at 50% 45%, ${e.color}22, transparent 60%)` }}
            />
            <KeboCreature emotion={state.emotion} activity={state.activity} energy={state.stats.energy} size={240} />
            <div className="mt-5 z-10">
              <EmotionBadge emotion={state.emotion} activity={state.activity} />
            </div>
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-3 gap-2.5">
            <ActionButton icon={<Gamepad2 size={18} />} label="Play"  onClick={() => doActivity('playing')}  accent="#ec4899" />
            <ActionButton icon={<UtensilsCrossed size={18} />} label="Feed" onClick={() => doActivity('feeding')} accent="#22c55e" />
            <ActionButton icon={<Moon size={18} />} label="Rest"  onClick={() => doActivity('resting')}  accent="#10b981" />
          </div>

          {/* Vitals */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Vitals</h2>
            <VitalStatsPanel stats={state.stats} />
          </div>
        </section>

        {/* Right: chat */}
        <section className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-4 min-h-[420px] lg:min-h-0">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={15} className="text-emerald-400" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Conversation</h2>
          </div>
          <div className="flex-1 min-h-0">
            <ChatPanel messages={messages} isThinking={isThinking} onSend={sendMessage} />
          </div>
        </section>
      </main>

      {/* ─── Overlays ─── */}
      {showAbout && <AboutOverlay onClose={() => setShowAbout(false)} />}

      {confirmClearMemories && (
        <ConfirmOverlay
          title="Clear Kebo's memories?"
          description="This removes all long-term memories Kebo has collected. This cannot be undone."
          confirmLabel="Clear memories"
          onConfirm={handleConfirmClearMemories}
          onCancel={() => setConfirmClearMemories(false)}
        />
      )}
    </div>
  );
}

/* ─── Action button ─── */
interface ActionButtonProps {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  accent: string;
}

function ActionButton({ icon, label, onClick, accent }: ActionButtonProps) {
  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.03] py-3.5 hover:bg-white/[0.07] hover:border-white/20 active:scale-95 transition-all"
    >
      <span className="transition-transform group-hover:scale-110" style={{ color: accent }}>{icon}</span>
      <span className="text-xs font-medium text-slate-300">{label}</span>
    </button>
  );
}

/* ─── Dropdown menu item ─── */
function MenuItem({ label, description, onClick, danger }: {
  label: string;
  description?: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-2.5 hover:bg-white/5 transition-colors ${danger ? 'text-rose-400 hover:text-rose-300' : 'text-slate-200 hover:text-white'}`}
    >
      <span className="text-sm font-medium block">{label}</span>
      {description && <span className="text-[11px] text-slate-500 block mt-0.5">{description}</span>}
    </button>
  );
}

/* ─── About overlay ─── */
function AboutOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="max-w-md rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl"
        onClick={(ev) => ev.stopPropagation()}
      >
        <h2 className="text-lg font-bold mb-2">About Kebo</h2>
        <p className="text-sm text-slate-300 leading-relaxed mb-4">
          Kebo is a living companion with its own personality, emotions, and vital needs. It reacts to how you treat
          it, slowly drifts over time, and remembers your bond. Talk to it, play, feed, or let it rest — every
          interaction shapes who Kebo becomes.
        </p>
        <div className="space-y-2 text-xs text-slate-400 mb-5">
          <p><span className="text-emerald-400 font-semibold">Phase 2:</span> Living state, emotion dynamics, personality, and a conversational agent.</p>
          <p>Next: real conversational intelligence and long-term memory.</p>
        </div>
        <button
          onClick={onClose}
          className="w-full rounded-xl bg-emerald-500 hover:bg-emerald-400 py-2.5 text-sm font-semibold text-white transition-colors"
        >
          Got it
        </button>
      </div>
    </div>
  );
}

/* ─── Confirm overlay ─── */
function ConfirmOverlay({ title, description, confirmLabel, onConfirm, onCancel }: {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-4" onClick={onCancel}>
      <div
        className="max-w-sm w-full rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl"
        onClick={(ev) => ev.stopPropagation()}
      >
        <h2 className="text-base font-bold mb-2">{title}</h2>
        <p className="text-sm text-slate-400 leading-relaxed mb-5">{description}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-rose-500 hover:bg-rose-400 py-2.5 text-sm font-semibold text-white transition-colors"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
