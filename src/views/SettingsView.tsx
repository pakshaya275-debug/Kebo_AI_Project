import { useState } from 'react';
import { Download, RotateCcw, Settings as SettingsIcon } from 'lucide-react';
import { DEFAULT_PERSONALITY, PERSONALITY_TRAITS, type Personality } from '../types/kebo';
import type { AutonomyLevel, KeboSettings } from '../lib/settings';
import type { BackendStatus } from '../lib/llmAgent';
import { PageHeader, Row, Section, Segmented, Toggle } from './ui';

const AUTONOMY_COPY: Record<AutonomyLevel, string> = {
  off: 'Kebo only speaks when you speak to it.',
  low: 'Kebo may reach out rarely — after long absences.',
  normal: 'Kebo reaches out now and then when it is lonely or remembers something.',
  high: 'Kebo is chatty and reaches out more often. Still capped to avoid spam.',
};

const STATUS_COPY: Record<BackendStatus, string> = {
  checking: 'Checking the AI backend…',
  online: 'Connected — replies are written by the LLM.',
  unconfigured: 'Backend reachable but no API key is configured.',
  offline: 'Backend unreachable — Kebo is using its simple built-in brain.',
};

export function SettingsView({
  settings, personality, backendStatus, onSettings, onPersonality, onClearMessages, onClearMemories, onReset, onExport,
}: {
  settings: KeboSettings;
  personality: Personality;
  backendStatus: BackendStatus;
  onSettings: (patch: Partial<KeboSettings>) => void;
  onPersonality: (patch: Partial<Personality>) => void;
  onClearMessages: () => void;
  onClearMemories: () => void;
  onReset: () => void;
  onExport: () => string;
}) {
  const [confirm, setConfirm] = useState<null | 'memories' | 'reset'>(null);
  const [notice, setNotice] = useState('');

  const flash = (text: string) => { setNotice(text); setTimeout(() => setNotice(''), 2200); };

  const toggleNotifications = async (value: boolean) => {
    if (!value) { onSettings({ notifications: false }); return; }
    if (!('Notification' in window)) { flash('This browser does not support notifications.'); return; }
    const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (permission === 'granted') onSettings({ notifications: true });
    else flash('Notifications were blocked in the browser.');
  };

  const download = () => {
    const blob = new Blob([onExport()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kebo-data-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 min-w-0 flex flex-col overflow-y-auto custom-scroll">
      <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-6 sm:p-8 space-y-8 max-w-3xl w-full">
        <PageHeader icon={<SettingsIcon size={22} />} title="Settings" subtitle="Shape Kebo's personality and decide how much it may do on its own. Everything is stored on your device." />
        {notice && <p className="text-xs text-amber-300 -mt-4">{notice}</p>}

        <Section title="Autonomy">
          <Row title="How independent is Kebo?" description={AUTONOMY_COPY[settings.autonomy]}>
            <Segmented<AutonomyLevel>
              value={settings.autonomy}
              onChange={(autonomy) => onSettings({ autonomy })}
              options={[{ value: 'off', label: 'Off' }, { value: 'low', label: 'Low' }, { value: 'normal', label: 'Normal' }, { value: 'high', label: 'High' }]}
            />
          </Row>
          <Row title="Browser notifications" description="Show a notification when Kebo reaches out while this tab is in the background.">
            <Toggle label="Notifications" checked={settings.notifications} onChange={(v) => { void toggleNotifications(v); }} />
          </Row>
          <Row title="LLM-written initiations" description="Let the AI phrase Kebo's own messages. When off (or offline) Kebo uses built-in phrases.">
            <Toggle label="LLM initiations" checked={settings.llmInitiations} onChange={(v) => onSettings({ llmInitiations: v })} />
          </Row>
          <Row title="Demo speed (30× time)" description="For presentations: hunger, loneliness and Kebo's decisions play out in minutes instead of hours.">
            <Toggle label="Demo speed" checked={settings.demoSpeed} onChange={(v) => onSettings({ demoSpeed: v })} />
          </Row>
        </Section>

        <Section title="Personality">
          <div className="rounded-2xl border border-white/5 bg-white/[0.015] p-5 space-y-4">
            <p className="text-xs text-slate-400 leading-relaxed">Each Kebo has seven traits. They change how strongly events affect it and how often it acts on its own.</p>
            {PERSONALITY_TRAITS.map(({ key, label, hint }) => (
              <div key={key}>
                <div className="flex items-baseline justify-between">
                  <label htmlFor={`trait-${key}`} className="text-sm font-semibold text-slate-200">{label}</label>
                  <span className="text-xs font-mono tabular-nums text-slate-400">{Math.round(personality[key] * 100)}</span>
                </div>
                <input id={`trait-${key}`} type="range" min={0} max={100} value={Math.round(personality[key] * 100)}
                  onChange={(e) => onPersonality({ [key]: Number(e.target.value) / 100 })}
                  className="w-full accent-emerald-400" />
                <p className="text-[11px] text-slate-500">{hint}</p>
              </div>
            ))}
            <button onClick={() => onPersonality(DEFAULT_PERSONALITY)} className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-emerald-300 transition-colors">
              <RotateCcw size={13} /> Reset to default personality
            </button>
          </div>
        </Section>

        <Section title="Voice">
          <Row title="Speak replies aloud" description="In Voice Chat Kebo answers out loud using your browser's speech engine.">
            <Toggle label="Voice replies" checked={settings.voiceReplies} onChange={(v) => onSettings({ voiceReplies: v })} />
          </Row>
          <Row title="Speaking speed" description={`${settings.voiceRate.toFixed(2)}×`}>
            <input type="range" min={60} max={160} value={Math.round(settings.voiceRate * 100)} aria-label="Speaking speed"
              onChange={(e) => onSettings({ voiceRate: Number(e.target.value) / 100 })} className="w-36 accent-emerald-400" />
          </Row>
        </Section>

        <Section title="Memory & privacy">
          <Row title="Long-term memory" description="When off, Kebo neither saves new memories nor uses old ones. Nothing is deleted.">
            <Toggle label="Memory" checked={settings.memoryEnabled} onChange={(v) => onSettings({ memoryEnabled: v })} />
          </Row>
          <Row title="Export my data" description="Download everything Kebo stores — state, settings, memories and chat — as JSON.">
            <button onClick={download} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border border-white/10 text-slate-300 hover:text-emerald-300 hover:border-emerald-500/30 transition-colors"><Download size={14} /> Export</button>
          </Row>
          <Row title="Clear conversation" description="Delete chat history. Memories and vitals stay.">
            <button onClick={() => { onClearMessages(); flash('Conversation cleared.'); }} className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-white/10 text-slate-300 hover:bg-white/5">Clear chat</button>
          </Row>
          <Row title="Erase all memories" description="Permanently forget everything learned about you.">
            {confirm === 'memories' ? (
              <div className="flex gap-2">
                <button onClick={() => { onClearMemories(); setConfirm(null); flash('Memories erased.'); }} className="px-3 py-2 rounded-xl text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">Confirm</button>
                <button onClick={() => setConfirm(null)} className="px-3 py-2 rounded-xl text-xs border border-white/10 text-slate-400">Cancel</button>
              </div>
            ) : (
              <button onClick={() => setConfirm('memories')} className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-rose-500/30 text-rose-300 hover:bg-rose-500/10">Erase memories</button>
            )}
          </Row>
          <Row title="Reset Kebo" description="Start over with a brand-new Kebo: vitals, relationship, activity log and chat. Memories are kept unless you erase them.">
            {confirm === 'reset' ? (
              <div className="flex gap-2">
                <button onClick={() => { onReset(); setConfirm(null); flash('Kebo has been reset.'); }} className="px-3 py-2 rounded-xl text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">Confirm</button>
                <button onClick={() => setConfirm(null)} className="px-3 py-2 rounded-xl text-xs border border-white/10 text-slate-400">Cancel</button>
              </div>
            ) : (
              <button onClick={() => setConfirm('reset')} className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-rose-500/30 text-rose-300 hover:bg-rose-500/10">Reset Kebo</button>
            )}
          </Row>
        </Section>

        <Section title="About">
          <div className="rounded-2xl border border-white/5 bg-white/[0.015] p-5 text-sm text-slate-300 leading-relaxed">
            <p><span className="text-emerald-400 font-bold">KEBO</span> is a companion built from an LLM reasoning layer, an emotion engine, long-term memory, a seven-trait personality and a controlled agent loop. Its emotions are computational states, not claims of consciousness.</p>
            <p className="mt-3 text-xs text-slate-400">Backend: {STATUS_COPY[backendStatus]}</p>
          </div>
        </Section>
      </div>
    </div>
  );
}
