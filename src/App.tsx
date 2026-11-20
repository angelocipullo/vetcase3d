import { useEffect } from 'react';
import { audio } from './audio/engine';
import { useGame } from './store';
import { TitleScreen } from './ui/Screens';
import { SimScreen } from './ui/sim/SimScreen';

export default function App() {
  const screen = useGame((s) => s.screen);

  // blip 8-bit su ogni pulsante: tono "selezione" per risposte, domande e voci di elenco, "conferma" per gli altri
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const b = (e.target as Element | null)?.closest?.('button');
      if (!b || b.disabled) return;
      const select = !!b.closest('.rpg-menu, .lobby-list, .cc-nav, .cc-filter, .s-askgrid, .s-options, .s-orders, .s-chips');
      audio.click(select ? 'select' : 'confirm');
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, []);
  return (
    <div className="app">
      {screen === 'title' && <TitleScreen />}
      {screen === 'sim' && <SimScreen />}
    </div>
  );
}
