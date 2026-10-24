export type AutonomyLevel = 'off' | 'low' | 'normal' | 'high';

export interface KeboSettings {
  autonomy: AutonomyLevel;
  /** Final-review helper: time passes ~30x faster so loneliness, hunger and autonomous behaviour are visible live. */
  demoSpeed: boolean;
  notifications: boolean;
  voiceReplies: boolean;
  voiceRate: number;
  speechLanguage: string;
  memoryEnabled: boolean;
  /** Kebo-initiated messages are written by the LLM when the backend is reachable. */
  llmInitiations: boolean;
}

export const DEFAULT_SETTINGS: KeboSettings = {
  autonomy: 'normal',
  demoSpeed: false,
  notifications: false,
  voiceReplies: true,
  voiceRate: 1,
  speechLanguage: 'auto',
  memoryEnabled: true,
  llmInitiations: true,
};

const SETTINGS_KEY = 'kebo-settings-v1';

export function loadSettings(): KeboSettings {
  try {
    const parsed = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') as Partial<KeboSettings>;
    const autonomy = ['off', 'low', 'normal', 'high'].includes(parsed.autonomy as string) ? parsed.autonomy! : DEFAULT_SETTINGS.autonomy;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      autonomy,
      voiceRate: Math.min(1.6, Math.max(0.6, Number(parsed.voiceRate) || 1)),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: KeboSettings): void {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* ignore */ }
}

export const timeScaleOf = (settings: KeboSettings): number => (settings.demoSpeed ? 30 : 1);
