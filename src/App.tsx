import { useState, type ReactNode } from 'react';
import { Gamepad2, UtensilsCrossed, Moon, Sparkles, Info } from 'lucide-react';
import { KeboCreature } from './components/KeboCreature';
import { ChatPanel } from './components/ChatPanel';
import { EmotionBadge, VitalStatsPanel } from './components/VitalStatsPanel';
import { useKebo } from './hooks/useKebo';
import { EMOTIONS } from './types/kebo';

function App() {
  const { state, messages, isThinking, sendMessage, doActivity } = useKebo();
  const [showAbout, setShowAbout] = useState(false);
  const e = EMOTIONS[state.emotion];

  return (
    <div className="min-h-screen text-slate-100 flex flex-col">
      {/* Header */}
      <header className="px-5 py-3 flex items-center justify-between border-b border-white/5 backdrop-blur-sm bg-black/10">
        <div className="flex items-center gap-2.5">
          <div className="grid place-items-center h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-400 text-slate-900 font-black shadow-lg shadow-emerald-500/20">
            K
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight leading-none">Kebo</h1>
            <p className="text-[11px] text-slate-400 leading-none mt-0.5">Your living companion</p>
          </div>
        </div>
        <button
          onClick={() => setShowAbout((v) => !v)}
          className="grid place-items-center h-8 w-8 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
          aria-label="About Kebo"
        >
          <Info size={17} />
        </button>
      </header>

      {/* Main */}
      <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-5 grid gap-5 lg:grid-cols-[1.1fr_1fr] lg:gap-6">
        {/* Left: creature + stats */}
        <section className="flex flex-col gap-4">
          <div
            className="relative rounded-3xl border border-white/10 overflow-hidden flex flex-col items-center justify-center py-8 transition-all duration-700"
            style={{
              background: `radial-gradient(ellipse at 50% 40%, ${e.colorSoft}1f 0%, transparent 70%), linear-gradient(180deg, #0a1f15 0%, #07140d 100%)`,
            }}
          >
            {/* soft moving glow behind */}
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
            <ActionButton icon={<Gamepad2 size={18} />} label="Play" onClick={() => doActivity('playing')} accent="#ec4899" />
            <ActionButton icon={<UtensilsCrossed size={18} />} label="Feed" onClick={() => doActivity('feeding')} accent="#22c55e" />
            <ActionButton icon={<Moon size={18} />} label="Rest" onClick={() => doActivity('resting')} accent="#10b981" />
          </div>

          {/* Vitals */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Vitals</h2>
            <VitalStatsPanel stats={state.stats} />
          </div>
        </section>

        {/* Right: chat */}
        <section className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-4 min-h-[480px] lg:min-h-0">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={15} className="text-emerald-400" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Conversation</h2>
          </div>
          <div className="flex-1 min-h-0">
            <ChatPanel messages={messages} isThinking={isThinking} onSend={sendMessage} />
          </div>
        </section>
      </main>

      {showAbout && <AboutOverlay onClose={() => setShowAbout(false)} />}
    </div>
  );
}

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

function AboutOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="max-w-md rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl"
        onClick={(ev) => ev.stopPropagation()}
      >
        <h2 className="text-lg font-bold mb-2">About Kebo</h2>
        <p className="text-sm text-slate-300 leading-relaxed mb-4">
          Kebo is a living companion with its own personality, emotions, and vital needs. It reacts to how you treat it,
          slowly drifts over time, and remembers your bond. Talk to it, play, feed, or let it rest — every interaction
          shapes who Kebo becomes.
        </p>
        <div className="space-y-2 text-xs text-slate-400 mb-5">
          <p><span className="text-emerald-400 font-semibold">Phase 2:</span> Living state, emotion dynamics, personality, and a mock conversational agent.</p>
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

export default App;
