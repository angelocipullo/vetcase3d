import { useGame } from '../store';

/** Pulsante audio on/off (scorciatoia: M). */
export function SoundToggle({ className = 'pill' }: { className?: string }) {
  const muted = useGame((s) => s.muted);
  const toggleMute = useGame((s) => s.toggleMute);
  return (
    <button
      className={`${className} sound-toggle ${muted ? 'muted' : ''}`}
      onClick={toggleMute}
      aria-pressed={!muted}
      aria-label={muted ? 'Attiva audio' : 'Disattiva audio'}
      title={muted ? 'Attiva audio (M)' : 'Disattiva audio (M)'}
    >
      {muted ? '🔇' : '🔊'}
      <span className="pill-label">{muted ? 'Audio off' : 'Audio'}</span>
    </button>
  );
}
