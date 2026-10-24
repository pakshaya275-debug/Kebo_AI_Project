import { useState } from 'react';
import { Activity as ActivityIcon, Bot, Brain, Droplets, FastForward, Gauge, Heart, Moon, Sparkles, Trash2 } from 'lucide-react';
import type { ActivityEntry, KeboState } from '../types/kebo';
import type { AgentDecision } from '../lib/agent';
import type { KeboSettings } from '../lib/settings';
import { Bar, PageHeader, Panel } from './ui';
import { formatWhen } from './format';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'autonomous', label: 'Kebo acted' },
  { key: 'care', label: 'Care' },
  { key: 'emotion', label: 'Mood' },
  { key: 'memory', label: 'Memory' },
  { key: 'system', label: 'System' },
] as const;

function iconFor(entry: ActivityEntry) {
  switch (entry.kind) {
    case 'autonomous': return <Bot size={15} className="text-emerald-400" />;
    case 'care': return <Droplets size={15} className="text-sky-400" />;
    case 'emotion': return <Heart size={15} className="text-pink-400" />;
    case 'memory': return <Brain size={15} className="text-violet-400" />;
    default: return <Sparkles size={15} className="text-slate-400" />;
  }
}

export function ActivityView({
  entries, state, settings, preview, onClear, onSimulateAway, quietUntil,
}: {
  entries: ActivityEntry[];
  state: KeboState;
  settings: KeboSettings;
  preview: AgentDecision;
  onClear: () => void;
  onSimulateAway: (hours: number) => void;
  quietUntil: number;
}) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('all');
  const visible = entries.filter((entry) => filter === 'all' || entry.kind === filter);
  const quiet = quietUntil > Date.now();
  const topScores = (Object.entries(preview.scores) as [string, number][])
    .filter(([, v]) => v > 0).sort(([, a], [, b]) => b - a).slice(0, 4);

  return (
    <div className="flex-1 min-w-0 overflow-y-auto custom-scroll space-y-5">
      <Panel className="p-6 sm:p-8">
        <PageHeader
          icon={<ActivityIcon size={22} />}
          title="Activity"
          subtitle="Everything Kebo did on its own — and why. Kebo runs a controlled loop: observe, remember, evaluate, decide. It never acts without a recorded reason."
          right={entries.length > 0 ? (
            <button onClick={onClear} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border border-white/10 text-slate-400 hover:text-rose-300 hover:border-rose-500/30 transition-colors">
              <Trash2 size={14} /> Clear log
            </button>
          ) : undefined}
        />

        <div className="mt-6 grid md:grid-cols-3 gap-3">
          <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
            <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">Loneliness</p>
            <p className="text-2xl font-bold tabular-nums text-slate-100">{preview.loneliness}%</p>
            <div className="mt-2"><Bar value={preview.loneliness} color="#a78bfa" /></div>
          </div>
          <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
            <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">Autonomy</p>
            <p className="text-2xl font-bold text-slate-100 capitalize">{settings.autonomy}</p>
            <p className="text-[11px] text-slate-500 mt-1">{quiet ? 'Quiet mode — you asked for space' : settings.demoSpeed ? 'Demo speed (30× time)' : 'Real-time'}</p>
          </div>
          <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
            <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">Agent is considering</p>
            <p className="text-lg font-bold text-emerald-300">{preview.action.replace('_', ' ')}</p>
            <p className="text-[11px] text-slate-500 mt-1 leading-snug">{preview.reason || 'Nothing right now.'}</p>
          </div>
        </div>

        {topScores.length > 0 && (
          <div className="mt-3 rounded-2xl border border-white/5 bg-white/[0.015] p-4">
            <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5"><Gauge size={12} /> Action scores right now</p>
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
              {topScores.map(([name, value]) => (
                <div key={name}>
                  <div className="flex justify-between text-xs text-slate-400 mb-1"><span>{name.replace('_', ' ')}</span><span className="tabular-nums">{Math.round(value)}</span></div>
                  <Bar value={Math.min(100, value)} />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-emerald-500/20 bg-emerald-500/[0.03] p-3">
          <span className="text-xs text-slate-400 flex items-center gap-1.5"><FastForward size={13} className="text-emerald-400" /> Demo tools:</span>
          <button onClick={() => onSimulateAway(3)} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25 transition-colors">Simulate 3 hours away</button>
          <button onClick={() => onSimulateAway(8)} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25 transition-colors flex items-center gap-1"><Moon size={12} /> 8 hours (overnight)</button>
          <span className="text-[11px] text-slate-500">Kebo will notice within ~10 s and decide what to do.</span>
        </div>
      </Panel>

      <Panel className="p-6">
        <div className="flex flex-wrap gap-2 mb-5">
          {FILTERS.map((f) => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${filter === f.key ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-200' : 'border-white/10 text-slate-400 hover:text-slate-200'}`}>
              {f.label}
            </button>
          ))}
        </div>
        {visible.length === 0 ? (
          <p className="text-sm text-slate-500 py-6 text-center">Nothing here yet. Chat with Kebo, take care of it, or leave it alone for a while.</p>
        ) : (
          <ul className="space-y-3">
            {visible.map((entry) => (
              <li key={entry.id} className="flex gap-3 rounded-2xl border border-white/5 bg-white/[0.015] p-3.5">
                <span className="mt-0.5 shrink-0 w-8 h-8 rounded-xl bg-white/5 grid place-items-center">{iconFor(entry)}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {entry.action && <span className="text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300">{entry.action}</span>}
                    <span className="text-[11px] text-slate-500">{formatWhen(entry.at)}</span>
                  </div>
                  <p className="text-sm text-slate-200 mt-1 break-words leading-relaxed">{entry.text}</p>
                  {entry.reason && <p className="text-xs text-slate-500 mt-1">Why: {entry.reason}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="text-[11px] text-slate-600 mt-4">Current mood: {state.emotion} · activity: {state.activity}</p>
      </Panel>
    </div>
  );
}
