import type { ReactNode } from 'react';
import { EMOTIONS, type VitalStats } from '../types/kebo';

interface StatBarProps {
  label: string;
  value: number;
  color: string;
  icon: ReactNode;
}

function StatBar({ label, value, color, icon }: StatBarProps) {
  const pct = Math.round(value);
  const low = pct < 25;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-slate-300">
          <span style={{ color }}>{icon}</span>
          {label}
        </span>
        <span className={`font-mono tabular-nums ${low ? 'text-rose-400 stat-low' : 'text-slate-400'}`}>{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-slate-700/50 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${low ? 'stat-low' : ''}`}
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

interface VitalStatsPanelProps {
  stats: VitalStats;
}

export function VitalStatsPanel({ stats }: VitalStatsPanelProps) {
  return (
    <div className="space-y-3.5">
      <StatBar label="Energy" value={stats.energy} color="#10b981" icon={<BoltIcon />} />
      <StatBar label="Happiness" value={stats.happiness} color="#f59e0b" icon={<SunIcon />} />
      <StatBar label="Bond" value={stats.bond} color="#ec4899" icon={<HeartIcon />} />
      <StatBar label="Fullness" value={stats.hunger} color="#22c55e" icon={<BowlIcon />} />
      <StatBar label="Stimulation" value={stats.stimulation} color="#8b5cf6" icon={<SparklesIcon />} />
      <StatBar label="Annoyance" value={stats.annoyance} color="#ef4444" icon={<SparklesIcon />} />
    </div>
  );
}

/* minimal inline icons (avoid extra lucide imports here) */
function BoltIcon() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L4.5 13H11l-1 9 8.5-11H12l1-9z"/></svg>; }
function SunIcon() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19" strokeLinecap="round"/></svg>; }
function HeartIcon() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-7-4.5-9.5-9C1 9 2.5 5 6.5 5c2 0 3.5 1.5 5.5 3.5C14 6.5 15.5 5 17.5 5 21.5 5 23 9 21.5 12c-2.5 4.5-9.5 9-9.5 9z"/></svg>; }
function BowlIcon() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 11h18a8 8 0 01-16 0M12 3v4" strokeLinecap="round"/></svg>; }
function SparklesIcon() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8z"/></svg>; }

interface EmotionBadgeProps {
  emotion: keyof typeof EMOTIONS;
  activity: string;
}

export function EmotionBadge({ emotion, activity }: EmotionBadgeProps) {
  const e = EMOTIONS[emotion];
  const activityLabel: Record<string, string> = {
    idle: 'idle', talking: 'talking', thinking: 'thinking', resting: 'resting', playing: 'playing', exploring: 'exploring',
  };
  return (
    <div className="flex items-center gap-3">
      <div
        className="flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium"
        style={{ backgroundColor: e.colorSoft + '22', color: e.color, border: `1px solid ${e.color}44` }}
      >
        <span className="text-base leading-none">{e.emoji}</span>
        {e.label}
      </div>
      <span className="text-xs text-slate-500 capitalize">{activityLabel[activity] ?? activity}</span>
    </div>
  );
}
