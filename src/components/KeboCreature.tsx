import { EMOTIONS, type Activity, type EmotionKey, type VitalStats } from '../types/kebo';

interface KeboCreatureProps {
  emotion: EmotionKey;
  activity: Activity;
  energy: number;
  vitals?: VitalStats;
  size?: number;
}

export function KeboCreature({ emotion, activity, energy, vitals, size = 220 }: KeboCreatureProps) {
  const e = EMOTIONS[emotion];

  const annoyance = vitals?.annoyance ?? 0;
  const hunger = vitals?.hunger ?? 70;
  const happiness = vitals?.happiness ?? 70;

  const isDry = hunger < 25;
  const isWithered = happiness < 30;
  const isRed = annoyance > 35;
  const isAngry = emotion === 'angry' || annoyance > 50;
  const isSad = emotion === 'sad' || isWithered;
  const isHappy = emotion === 'joy' || emotion === 'playful' || (emotion === 'calm' && happiness > 70);
  const isTired = emotion === 'tired' || energy < 25;

  const healthClass = [
    isAngry ? 'kebo-health-angry' : '',
    isDry ? 'kebo-health-dry' : '',
    isWithered ? 'kebo-health-withered' : '',
    isRed ? 'kebo-health-red' : '',
    isHappy ? 'kebo-health-vibrant' : '',
  ].filter(Boolean).join(' ');

  const bodyAnim =
    activity === 'talking'
      ? 'kebo-talk'
      : activity === 'thinking'
        ? 'kebo-think'
        : activity === 'playing'
          ? 'kebo-play'
          : activity === 'resting'
            ? 'kebo-rest'
            : isTired
              ? 'kebo-rest'
              : isHappy
                ? 'kebo-breathe-happy'
                : 'kebo-breathe';

  const glowIntensity = isHappy ? 1 : isAngry ? 0.9 : isSad ? 0.3 : 0.6;
  const glowColor = isAngry ? '#ef4444' : isDry ? '#f59e0b' : isSad ? '#64748b' : e.color;

  return (
    <div
      className={`kebo-creature kebo-image-model kebo-emotion-${emotion} ${bodyAnim} ${healthClass}`}
      style={{
        width: size,
        height: size,
        ['--kebo-accent' as string]: e.color,
        ['--kebo-glow' as string]: glowColor,
        ['--kebo-glow-opacity' as string]: glowIntensity,
      }}
      role="img"
      aria-label={`Kebo feeling ${e.label}`}
    >
      {/* Outer ambient glow (layered) */}
      <div
        className="kebo-glow-outer"
        style={{
          background: `radial-gradient(circle at 50% 55%, ${glowColor}55, transparent 62%)`,
          opacity: glowIntensity * 0.9,
        }}
      />
      <div
        className="kebo-glow-inner"
        style={{
          background: `radial-gradient(circle at 50% 55%, ${glowColor}33, transparent 50%)`,
          opacity: glowIntensity,
        }}
      />

      {/* Dry / dust particles */}
      {isDry && (
        <div className="kebo-particles kebo-dry-particles">
          {Array.from({ length: 8 }).map((_, i) => (
            <span key={i} className={`dust dust-${i + 1}`} />
          ))}
        </div>
      )}

      {/* Angry / red aura veins */}
      {isAngry && (
        <div className="kebo-angry-aura" />
      )}

      {/* Heart sparkles when happy */}
      {isHappy && happiness > 75 && (
        <div className="kebo-happy-sparkles">
          {Array.from({ length: 6 }).map((_, i) => (
            <span key={i} className={`sparkle sparkle-${i + 1}`}>✨</span>
          ))}
        </div>
      )}

      <img
        src="/kebo-model.png"
        alt=""
        className="kebo-model-image"
        draggable="false"
      />
      {activity === 'thinking' && <div className="kebo-thought-3d"><i /><i /><i /></div>}
      {isTired && <div className="kebo-zzz-3d">z<span>z</span><b>z</b></div>}
      <span className="sr-only">Energy {Math.round(energy)} percent</span>
    </div>
  );
}
