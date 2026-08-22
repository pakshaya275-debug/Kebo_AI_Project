import { EMOTIONS, type Activity, type EmotionKey } from '../types/kebo';

interface KeboCreatureProps {
  emotion: EmotionKey;
  activity: Activity;
  energy: number;
  size?: number;
}

export function KeboCreature({ emotion, activity, energy, size = 220 }: KeboCreatureProps) {
  const e = EMOTIONS[emotion];
  const bodyAnim =
    activity === 'talking'
      ? 'kebo-talk'
      : activity === 'thinking'
        ? 'kebo-think'
        : activity === 'playing'
          ? 'kebo-play'
          : activity === 'resting'
            ? 'kebo-rest'
            : 'kebo-breathe';

  return (
    <div
      className={`kebo-creature kebo-image-model ${bodyAnim}`}
      style={{
        width: size,
        height: size,
        ['--kebo-accent' as string]: e.color,
      }}
      role="img"
      aria-label={`Kebo feeling ${e.label}`}
    >
      <div className="kebo-image-aura" />
      <img
        src="/kebo-transparent.png"
        alt="Kebo 3D character"
        className="kebo-model-image"
      />
      <div className="kebo-image-highlight" />
      {activity === 'thinking' && (
        <div className="kebo-thought-3d"><i /><i /><i /></div>
      )}
      {activity === 'resting' && <div className="kebo-zzz-3d">z<span>z</span><b>z</b></div>}
      <span className="sr-only">Energy {Math.round(energy)} percent</span>
    </div>
  );
}
