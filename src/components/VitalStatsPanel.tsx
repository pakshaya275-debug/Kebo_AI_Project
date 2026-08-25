import type { ReactNode } from 'react';
import { EMOTIONS, type VitalStats } from '../types/kebo';

/* ─── Mood phrases per emotion ─── */
const MOOD_PHRASES: Record<string, string> = {
  joy:     'Feeling great right now!',
  calm:    'Just taking it easy.',
  curious: 'Wondering about things...',
  sad:     'A little down today.',
  angry:   'Feeling a bit frustrated.',
  anxious: 'A little on edge.',
  tired:   'Running low on energy.',
  playful: 'Ready to have some fun!',
};

/* ─── Stat bar ─── */
interface StatBarProps {
  label: string;
  value: number;
  color: string;
  icon: ReactNode;
  warn?: boolean;
  warnHigh?: boolean; // warn when high (annoyance)
  warnLow?: boolean;  // warn when low (hunger)
}

function StatBar({ label, value, color, icon, warnHigh, warnLow }: StatBarProps) {
  const pct = Math.round(value);
  const isLow = pct < 25;
  const isAnnoyed = warnHigh && pct > 50;
  const isHungry = warnLow && pct < 25;
  const showWarning = isAnnoyed || isHungry || (isLow && !warnHigh);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-slate-300">
          <span style={{ color }}>{icon}</span>
          {label}
        </span>
        <span className={`font-mono tabular-nums flex items-center gap-1 ${showWarning ? 'text-rose-400 stat-low' : 'text-slate-400'}`}>
          {pct}%
          {showWarning && <span className="text-[10px]" title="Unusual level">⚠</span>}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-700/50 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${showWarning ? 'stat-low' : ''}`}
          style={{ width: `${pct}%`, backgroundColor: showWarning ? '#ef4444' : color }}
        />
      </div>
    </div>
  );
}

/* ─── Vitals panel ─── */
interface VitalStatsPanelProps {
  stats: VitalStats;
}

export function VitalStatsPanel({ stats }: VitalStatsPanelProps) {
  return (
    <div className="space-y-3">
      <StatBar label="Energy"      value={stats.energy}      color="#10b981" icon={<BoltIcon />}    />
      <StatBar label="Happiness"   value={stats.happiness}   color="#f59e0b" icon={<SunIcon />}     />
      <StatBar label="Bond"        value={stats.bond}        color="#ec4899" icon={<HeartIcon />}   />
      <StatBar label="Fullness"    value={stats.hunger}      color="#22c55e" icon={<BowlIcon />}    warnLow />
      <StatBar label="Stimulation" value={stats.stimulation} color="#8b5cf6" icon={<StarIcon />}    />
      <StatBar label="Annoyance"   value={stats.annoyance}   color="#ef4444" icon={<ZapIcon />}     warnHigh />
    </div>
  );
}

/* ─── Emotion badge (used in App.tsx) ─── */
interface EmotionBadgeProps {
  emotion: keyof typeof EMOTIONS;
  activity: string;
}

export function EmotionBadge({ emotion, activity }: EmotionBadgeProps) {
  const e = EMOTIONS[emotion];
  const phrase = MOOD_PHRASES[emotion] ?? 'Existing in the moment.';
  const activityLabel: Record<string, string> = {
    idle: 'idle', talking: 'talking', thinking: 'thinking',
    resting: 'resting', playing: 'playing', exploring: 'exploring', feeding: 'eating',
  };
  return (
    <div className="flex flex-col items-center gap-2">
      {/* Emotion pill */}
      <div
        className="flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-semibold"
        style={{ backgroundColor: `${e.colorSoft}22`, color: e.color, border: `1px solid ${e.color}44` }}
      >
        <span className="text-base leading-none" aria-hidden="true">{e.emoji}</span>
        {e.label}
      </div>

      {/* Mood phrase */}
      <p className="text-xs text-slate-400 italic">{phrase}</p>

      {/* Online / activity status */}
      <div className="flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow shadow-emerald-400/50 inline-block animate-pulse" />
        <span className="text-[11px] text-slate-500 capitalize">
          {activityLabel[activity] ?? activity}
        </span>
      </div>
    </div>
  );
}

/* ─── Minimal inline icons ─── */
function BoltIcon()   { return <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L4.5 13H11l-1 9 8.5-11H12l1-9z"/></svg>; }
function SunIcon()    { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19" strokeLinecap="round"/></svg>; }
function HeartIcon()  { return <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-7-4.5-9.5-9C1 9 2.5 5 6.5 5c2 0 3.5 1.5 5.5 3.5C14 6.5 15.5 5 17.5 5 21.5 5 23 9 21.5 12c-2.5 4.5-9.5 9-9.5 9z"/></svg>; }
function BowlIcon()   { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 11h18a8 8 0 01-16 0M12 3v4" strokeLinecap="round"/></svg>; }
function StarIcon()   { return <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 3.3 2.4-7.4L2 9.4h7.6z"/></svg>; }
function ZapIcon()    { return <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L4.5 13H11l-1 9 8.5-11H12l1-9z"/></svg>; }
