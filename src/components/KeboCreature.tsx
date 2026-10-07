import { EMOTIONS, type Activity, type EmotionKey, type VitalStats } from '../types/kebo';

const EMOTION_ART: Record<string, string> = {
  happy: '/emotions/happy.png',
  sad: '/emotions/sad.png',
  angry: '/emotions/angry.png',
  surprised: '/emotions/surprised.png',
  low_energy: '/emotions/low-energy.png',
  curious: '/emotions/curious.png',
  calm: '/emotions/happy.png',
};

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
  const isAngry = emotion === 'angry';
  const isSad = emotion === 'sad' || isWithered;
  const isHappy = emotion === 'joy' || emotion === 'playful';
  const isTired = emotion === 'tired' || energy < 18;
  const isRed = isAngry || annoyance > 65;

  // Emotion is the single source of truth for the main artwork. Vitals can
  // add visual modifiers, but they must not silently replace the emotion art.
  const imageKey = e.artKey;
  const artSrc = EMOTION_ART[imageKey] ?? EMOTION_ART.happy;

  const moodOverlayClass = [
    isAngry ? 'kebo-mood-angry' : '',
    isDry ? 'kebo-mood-dry' : '',
    isWithered ? 'kebo-mood-withered' : '',
    isRed ? 'kebo-mood-red' : '',
    isHappy ? 'kebo-mood-vibrant' : '',
    isSad ? 'kebo-mood-sad' : '',
    isTired ? 'kebo-mood-tired' : '',
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

  const glowIntensity = isAngry ? 0.9 : isHappy ? 1 : isSad ? 0.3 : isTired ? 0.35 : 0.6;
  const glowColor = isAngry ? '#ef4444' : isDry ? '#f59e0b' : isSad ? '#64748b' : e.color;

  return (
    <div
      className={`kebo-creature kebo-image-model kebo-emotion-${emotion} ${bodyAnim} ${moodOverlayClass}`}
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

      {isDry && (
        <div className="kebo-particles kebo-dry-particles">
          {Array.from({ length: 8 }).map((_, i) => (
            <span key={i} className={`dust dust-${i + 1}`} />
          ))}
        </div>
      )}

      {isAngry && <div className="kebo-angry-aura" />}

      {isHappy && happiness > 75 && (
        <div className="kebo-happy-sparkles">
          {Array.from({ length: 6 }).map((_, i) => (
            <span key={i} className={`sparkle sparkle-${i + 1}`}>✨</span>
          ))}
        </div>
      )}

      <img
        src={artSrc}
        alt=""
        className="kebo-model-image"
        draggable="false"
        onError={(event) => {
          const img = event.currentTarget;
          if (img.dataset.fallbackApplied === '1') return;
          img.dataset.fallbackApplied = '1';
          img.src = '/kebo-model.png';
        }}
      />
      {activity === 'thinking' && <div className="kebo-thought-3d"><i /><i /><i /></div>}
      {isTired && <div className="kebo-zzz-3d">z<span>z</span><b>z</b></div>}
      <span className="sr-only">Energy {Math.round(energy)} percent</span>
    </div>
  );
}
