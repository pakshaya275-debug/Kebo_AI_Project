import { Heart, Flame, MessageCircle, Sprout, Trophy } from 'lucide-react';
import { relationshipLevel, RELATIONSHIP_LEVELS } from '../lib/keboEngine';
import type { KeboState } from '../types/kebo';
import { Bar, PageHeader, Panel, Stat } from './ui';
import { formatWhen } from './format';

export function RelationshipView({ state }: { state: KeboState }) {
  const { relationship: rel, stats } = state;
  const level = relationshipLevel(stats.bond);
  const toNext = level.next ? Math.max(0, Math.ceil(level.next.min - stats.bond)) : 0;
  const days = Math.max(1, Math.ceil((Date.now() - rel.firstMetAt) / 86_400_000));
  const total = rel.positiveInteractions + rel.negativeInteractions;
  const positivePct = total ? Math.round((rel.positiveInteractions / total) * 100) : 100;
  const milestones = [...rel.milestones].sort((a, b) => b.at - a.at);

  return (
    <div className="flex-1 min-w-0 overflow-y-auto custom-scroll space-y-5">
      <Panel className="p-6 sm:p-8">
        <PageHeader
          icon={<Heart size={22} />}
          title="Relationship"
          subtitle="How your bond with Kebo is growing. Kind words, care and regular visits make it stronger; neglect and hostility weaken it."
        />
        <div className="mt-6 rounded-2xl border border-pink-500/20 bg-pink-500/[0.04] p-5">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-wider text-pink-300/80">Current level</p>
              <p className="text-3xl font-bold text-slate-100">{level.label}</p>
              <p className="text-sm text-slate-400 mt-1">{level.blurb}</p>
            </div>
            <p className="text-3xl font-mono tabular-nums text-pink-300">{Math.round(stats.bond)}%</p>
          </div>
          <div className="mt-4"><Bar value={stats.bond} color="#ec4899" /></div>
          <p className="text-xs text-slate-500 mt-2">
            {level.next ? `${toNext} more bond to reach “${level.next.label}”` : 'You have reached the deepest level of friendship.'}
          </p>
          <div className="mt-4 flex gap-1.5">
            {RELATIONSHIP_LEVELS.map((l, i) => (
              <div key={l.label} className={`flex-1 h-1.5 rounded-full ${i <= level.index ? 'bg-pink-400' : 'bg-white/10'}`} title={l.label} />
            ))}
          </div>
        </div>
      </Panel>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Days together" value={days} sub={`since ${new Date(rel.firstMetAt).toLocaleDateString()}`} />
        <Stat label="Messages shared" value={rel.totalMessages} />
        <Stat label="Visit streak" value={`${rel.streakDays}d`} sub="consecutive days" />
        <Stat label="Times you cared" value={rel.careCount} sub="feed · water · play" />
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <Panel className="p-6">
          <h4 className="text-sm font-bold text-slate-100 mb-4 flex items-center gap-2"><MessageCircle size={16} className="text-emerald-400" /> How you treat Kebo</h4>
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span>Kind interactions: {rel.positiveInteractions}</span>
            <span>Unkind: {rel.negativeInteractions}</span>
          </div>
          <div className="h-3 rounded-full overflow-hidden bg-rose-500/40 flex">
            <div className="h-full bg-emerald-400 transition-all duration-700" style={{ width: `${positivePct}%` }} />
          </div>
          <p className="text-xs text-slate-500 mt-3 leading-relaxed">
            Kebo also remembers when you comforted it or when it comforted you — {rel.comfortCount} time{rel.comfortCount === 1 ? '' : 's'} so far.
          </p>
          <div className="mt-5 flex items-center gap-2 text-xs text-slate-400">
            <Flame size={14} className="text-amber-400" /> Current streak: <span className="text-slate-200 font-semibold">{rel.streakDays} day{rel.streakDays === 1 ? '' : 's'}</span>
          </div>
        </Panel>

        <Panel className="p-6">
          <h4 className="text-sm font-bold text-slate-100 mb-4 flex items-center gap-2"><Trophy size={16} className="text-amber-400" /> Milestones</h4>
          {milestones.length === 0 ? (
            <p className="text-sm text-slate-500 flex items-center gap-2"><Sprout size={14} /> Say hello to Kebo to begin your story.</p>
          ) : (
            <ol className="relative border-l border-white/10 ml-2 space-y-4">
              {milestones.map((m) => (
                <li key={m.id} className="pl-4 relative">
                  <span className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
                  <p className="text-sm text-slate-200">{m.label}</p>
                  <p className="text-[11px] text-slate-500">{formatWhen(m.at)}</p>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>
    </div>
  );
}
