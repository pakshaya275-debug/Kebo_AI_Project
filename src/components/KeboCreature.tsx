import { EMOTIONS, type Activity, type EmotionKey } from '@/types/kebo';

interface KeboCreatureProps {
  emotion: EmotionKey;
  activity: Activity;
  energy: number;
  size?: number;
}

export function KeboCreature({ emotion, activity, energy, size = 220 }: KeboCreatureProps) {
  const e = EMOTIONS[emotion];
  const lowEnergy = energy < 35;
  const face = emotion === 'joy' || emotion === 'playful' ? 'happy' : emotion;
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
      className={`kebo-creature kebo-3d ${bodyAnim}`}
      style={{
        width: size,
        height: size,
        ['--kebo-accent' as string]: e.color,
        ['--kebo-mood' as string]: e.colorSoft,
      }}
      role="img"
      aria-label={`Kebo feeling ${e.label}`}
    >
      <div className="kebo-3d-shadow" />
      <div className="kebo-3d-model">
        <div className="kebo-hair-back">
          <span className="hair-lock hair-lock-left" />
          <span className="hair-lock hair-lock-right" />
        </div>
        <div className="kebo-head">
          <div className="kebo-hair-top">
            <span className="hair-spike hair-spike-left" />
            <span className="hair-spike hair-spike-center" />
            <span className="hair-spike hair-spike-right" />
          </div>
          <div className="kebo-face">
            <KeboEyes mood={face} lowEnergy={lowEnergy} />
            <div className={`kebo-mouth kebo-mouth-${face}`} />
            {(face === 'happy' || face === 'playful') && <><span className="kebo-cheek cheek-left" /><span className="kebo-cheek cheek-right" /></>}
            {face === 'curious' && <span className="kebo-curious-mark">?</span>}
          </div>
        </div>
        <div className="kebo-neck" />
        <div className="kebo-torso">
          <div className="kebo-chest-glow" />
          <div className="kebo-collar" />
        </div>
        <div className="kebo-arm kebo-arm-left"><span className="kebo-hand" /></div>
        <div className="kebo-arm kebo-arm-right"><span className="kebo-hand" /></div>
        <div className="kebo-leg kebo-leg-left"><span className="kebo-boot" /></div>
        <div className="kebo-leg kebo-leg-right"><span className="kebo-boot" /></div>
        {activity === 'thinking' && <div className="kebo-thought-3d"><i /><i /><i /></div>}
        {activity === 'resting' && <div className="kebo-zzz-3d">z<span>z</span><b>z</b></div>}
      </div>
    </div>
  );
}

function KeboEyes({ mood, lowEnergy }: { mood: string; lowEnergy: boolean }) {
  if (mood === 'happy' || mood === 'playful') {
    return <div className="kebo-eyes kebo-eyes-happy"><span /><span /></div>;
  }
  if (mood === 'angry') {
    return <div className="kebo-eyes kebo-eyes-angry"><span /><span /></div>;
  }
  if (mood === 'sad' || mood === 'tired') {
    return <div className="kebo-eyes kebo-eyes-sad"><span /><span /></div>;
  }
  return <div className={`kebo-eyes ${mood === 'curious' ? 'kebo-eyes-wide' : ''} ${lowEnergy ? 'kebo-eyes-low' : ''}`}><span /><span /></div>;
}
