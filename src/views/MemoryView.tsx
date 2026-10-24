import { useMemo, useState } from 'react';
import { Brain, CalendarClock, Plus, Search, Star, Trash2, UserRound } from 'lucide-react';
import { memoryKind, retrieveMemories, type KeboMemory } from '../lib/memory';
import type { KeboSettings } from '../lib/settings';
import { PageHeader } from './ui';
import { formatWhen } from './format';

type Tab = 'all' | 'semantic' | 'episodic';

const TABS: { key: Tab; label: string; hint: string }[] = [
  { key: 'all', label: 'All', hint: 'Everything Kebo remembers' },
  { key: 'semantic', label: 'About you', hint: 'Lasting facts, preferences and goals' },
  { key: 'episodic', label: 'Moments', hint: 'Dated events and emotional moments' },
];

export function MemoryView({
  memories, settings, onDelete, onAdd, onClear, onEnable,
}: {
  memories: KeboMemory[];
  settings: KeboSettings;
  onDelete: (id: string) => void;
  onAdd: (text: string) => void;
  onClear: () => void;
  onEnable: () => void;
}) {
  const [tab, setTab] = useState<Tab>('all');
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

  const visible = useMemo(() => {
    const base = query.trim() ? retrieveMemories(memories, query.trim()) : [...memories];
    return base
      .filter((m) => tab === 'all' || memoryKind(m) === tab)
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [memories, query, tab]);

  const semantic = memories.filter((m) => memoryKind(m) === 'semantic').length;
  const episodic = memories.length - semantic;

  const submit = () => {
    const text = draft.trim();
    if (text.length < 6) return;
    onAdd(text.endsWith('.') ? text : `${text}.`);
    setDraft('');
  };

  return (
    <div className="flex-1 min-w-0 flex flex-col rounded-3xl border border-white/5 bg-white/[0.02] overflow-hidden">
      <div className="p-6 sm:p-8 border-b border-white/5 space-y-5">
        <PageHeader
          icon={<Brain size={22} />}
          title="Kebo's Memory"
          subtitle="Kebo stores what matters from your chats and retrieves only what is relevant to the moment. You are always in control: delete anything, add your own, or switch memory off."
          right={memories.length > 0 ? (
            confirmClear ? (
              <div className="flex items-center gap-2">
                <button onClick={() => { onClear(); setConfirmClear(false); }} className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">Yes, erase all</button>
                <button onClick={() => setConfirmClear(false)} className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-white/10 text-slate-400">Cancel</button>
              </div>
            ) : (
              <button onClick={() => setConfirmClear(true)} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border border-white/10 text-slate-400 hover:text-rose-300 hover:border-rose-500/30 transition-colors">
                <Trash2 size={14} /> Clear all
              </button>
            )
          ) : undefined}
        />

        {!settings.memoryEnabled && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] p-3.5">
            <p className="text-xs text-amber-200/90">Memory is turned off. Kebo is not saving or using memories right now.</p>
            <button onClick={onEnable} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/20 text-amber-200">Turn on</button>
          </div>
        )}

        <div className="grid sm:grid-cols-3 gap-3 text-center">
          <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-3"><p className="text-2xl font-bold text-slate-100 tabular-nums">{memories.length}</p><p className="text-[11px] uppercase tracking-wider text-slate-500">Total</p></div>
          <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-3"><p className="text-2xl font-bold text-emerald-300 tabular-nums">{semantic}</p><p className="text-[11px] uppercase tracking-wider text-slate-500">Semantic · about you</p></div>
          <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-3"><p className="text-2xl font-bold text-violet-300 tabular-nums">{episodic}</p><p className="text-[11px] uppercase tracking-wider text-slate-500">Episodic · moments</p></div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1.5">
            {TABS.map((t) => (
              <button key={t.key} title={t.hint} onClick={() => setTab(t.key)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors ${tab === t.key ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-200' : 'border-white/10 text-slate-400 hover:text-slate-200'}`}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="relative flex-1 min-w-[180px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search memories…"
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-black/20 border border-white/10 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/40" />
          </div>
        </div>

        <div className="flex gap-2">
          <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
            placeholder="Teach Kebo something, e.g. “My favourite colour is green”"
            className="flex-1 px-3.5 py-2 rounded-xl bg-black/20 border border-white/10 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/40" />
          <button onClick={submit} disabled={draft.trim().length < 6} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-emerald-500/20 text-emerald-200 disabled:opacity-40 hover:bg-emerald-500/30 transition-colors">
            <Plus size={15} /> Add
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scroll p-6 sm:p-8">
        {visible.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-3xl mb-3">🌱</p>
            <p className="text-sm text-slate-400 leading-relaxed">
              {memories.length === 0
                ? <>Kebo hasn’t learned anything yet.<br />Try telling it “My name is Akshaya” or “I have an exam tomorrow”.</>
                : 'No memories match this view.'}
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {visible.map((m) => {
              const episodic = memoryKind(m) === 'episodic';
              return (
                <li key={m.id} className="group flex items-start gap-3 rounded-2xl border border-white/5 bg-white/[0.015] p-4">
                  <span className={`mt-0.5 shrink-0 w-8 h-8 rounded-xl grid place-items-center ${episodic ? 'bg-violet-500/15 text-violet-300' : 'bg-emerald-500/15 text-emerald-300'}`}>
                    {episodic ? <CalendarClock size={15} /> : <UserRound size={15} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-200 leading-relaxed break-words">{m.text}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[11px] text-slate-500">
                      <span className="capitalize">{m.type.replace('_', ' ')}</span>
                      <span>{formatWhen(m.createdAt)}</span>
                      {m.source === 'manual' && <span className="text-sky-400">added by you</span>}
                      {m.importance >= 0.85 && <span className="inline-flex items-center gap-1 text-amber-400/90"><Star size={10} fill="currentColor" /> important</span>}
                      {m.type === 'event' && m.topic && (
                        <span className={m.followedUpAt ? 'text-emerald-400' : 'text-violet-300'}>{m.followedUpAt ? 'Kebo followed up' : 'Kebo will follow up'}</span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => onDelete(m.id)} aria-label="Forget this memory"
                    className="shrink-0 p-2 rounded-lg text-slate-500 hover:text-rose-300 hover:bg-rose-500/10 opacity-60 group-hover:opacity-100 transition">
                    <Trash2 size={15} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

