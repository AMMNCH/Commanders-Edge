/**
 * Table — pass-and-play life tracking for 2–6 players on one phone.
 * Seats face their players around the table; state persists on the device.
 */
import React, { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, Shuffle, Undo2 } from 'lucide-react';
import { createPageUrl } from '@/utils';
import PlayerPanel from '@/components/table/PlayerPanel';
import TableSetup from '@/components/table/TableSetup';
import TableMenu from '@/components/table/TableMenu';
import VictoryOverlay from '@/components/table/VictoryOverlay';
import CardShareModal from '@/components/mtg/CardShareModal';
import CardOverlay from '@/components/mtg/CardOverlay';
import { initAudio, playSound } from '@/components/mtg/SoundEffects';
import { createTable, tableReducer, summarizeGame, isAlive } from '@/lib/table';
import { loadCurrentTable, saveCurrentTable, saveGame, deleteGame } from '@/lib/history';
import { seatLayout, resolveSeatMode } from '@/lib/seats';
import { useSettings, buzz } from '@/lib/settings';
import { randomIndex } from '@/lib/random';
import useWakeLock from '@/hooks/useWakeLock';

function reducer(state, action) {
  if (action.type === 'load') return action.state;
  return state ? tableReducer(state, action) : state;
}

function useSeatMode(setting) {
  const [mode, setMode] = useState(() => resolveSeatMode(setting));
  useEffect(() => {
    const update = () => setMode(resolveSeatMode(setting));
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [setting]);
  return mode;
}

export default function Table() {
  const navigate = useNavigate();
  const [state, dispatch] = useReducer(reducer, null, () => {
    const saved = loadCurrentTable();
    return saved && !saved.endedAt ? saved : null;
  });
  const [settings] = useSettings();
  const seatMode = useSeatMode(settings.seatMode);
  const [menuOpen, setMenuOpen] = useState(false);
  const [spotlight, setSpotlight] = useState(null);
  const [showCardSearch, setShowCardSearch] = useState(false);
  const [cardOverlay, setCardOverlay] = useState(null);
  const savedWinner = useRef(state?.winnerId || null);

  useWakeLock(Boolean(state) && settings.keepAwake);

  useEffect(() => {
    const h = () => initAudio();
    document.addEventListener('pointerdown', h, { once: true });
    return () => document.removeEventListener('pointerdown', h);
  }, []);

  // Persist every change so a refresh or a locked phone never loses the game.
  useEffect(() => { saveCurrentTable(state); }, [state]);

  // Record finished games; take them back out if someone undoes the win.
  useEffect(() => {
    if (!state) return;
    if (state.winnerId && savedWinner.current !== state.winnerId) {
      savedWinner.current = state.winnerId;
      saveGame(summarizeGame(state));
      playSound('commander');
      buzz(40);
    } else if (!state.winnerId && savedWinner.current) {
      savedWinner.current = null;
      deleteGame(state.id);
    }
  }, [state?.winnerId]); // eslint-disable-line react-hooks/exhaustive-deps

  const startTable = (config) => {
    savedWinner.current = null;
    dispatch({ type: 'load', state: createTable(config) });
  };

  const randomFirst = useCallback(() => {
    if (!state) return;
    const alive = state.players.map((p, i) => ({ p, i })).filter(({ p }) => isAlive(p));
    if (!alive.length) return;
    const pick = alive[randomIndex(alive.length)];
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { dispatch({ type: 'setActive', id: pick.p.id }); return; }
    // Spin the spotlight round the table, slowing down, and land on the pick.
    const laps = alive.length * 2 + alive.findIndex((x) => x.i === pick.i);
    let step = 0;
    const spin = () => {
      setSpotlight(alive[step % alive.length].i);
      playSound('dice');
      if (step >= laps) {
        setTimeout(() => { setSpotlight(null); dispatch({ type: 'setActive', id: pick.p.id }); }, 450);
        return;
      }
      step += 1;
      setTimeout(spin, 70 + step * step * 1.6);
    };
    spin();
  }, [state]);

  const endGame = () => {
    if (state && state.log.length > 0) saveGame(summarizeGame(state));
    savedWinner.current = null;
    dispatch({ type: 'load', state: null });
  };

  if (!state) return <TableSetup onStart={startTable} />;

  const layout = seatLayout(state.players.length, seatMode);
  const notStarted = state.turn.active === null;

  return (
    <div className="fixed inset-0 bg-[#050408] overflow-hidden touch-manipulation">
      <div
        className="absolute inset-0 grid gap-1.5 p-1.5"
        style={{
          gridTemplateColumns: `repeat(${layout.cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${layout.rows}, minmax(0, 1fr))`,
          paddingTop: 'max(6px, env(safe-area-inset-top))',
          paddingBottom: 'max(6px, env(safe-area-inset-bottom))',
        }}
      >
        {state.players.map((p, i) => {
          const seat = layout.seats[i];
          const sideways = Math.abs(seat.rot) === 90;
          return (
            <div key={p.id} className="relative min-w-0 min-h-0"
              style={{ gridRow: seat.row, gridColumn: `${seat.col} / span ${seat.colSpan || 1}`, containerType: 'size' }}>
              <div className="absolute left-1/2 top-1/2"
                style={{
                  width: sideways ? '100cqh' : '100cqw',
                  height: sideways ? '100cqw' : '100cqh',
                  transform: `translate(-50%, -50%) rotate(${seat.rot}deg)`,
                }}>
                <PlayerPanel
                  player={p}
                  players={state.players}
                  isActive={state.turn.active === i}
                  isMonarch={state.monarchId === p.id}
                  hasInitiative={state.initiativeId === p.id}
                  spotlight={spotlight === i}
                  turnStartedAt={state.turn.active === i ? state.turn.startedAt : null}
                  dispatch={dispatch}
                  onEndTurn={() => { playSound('commander'); buzz(12); dispatch({ type: 'nextTurn' }); }}
                  compact={state.players.length >= 5}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Centre hub */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-40 flex items-center gap-2">
        {state.past?.length > 0 && (
          <button onClick={() => dispatch({ type: 'undo' })} aria-label="Undo"
            className="w-10 h-10 rounded-full bg-[#100e16]/90 border border-white/15 shadow-xl flex items-center justify-center active:scale-90 transition-transform">
            <Undo2 className="w-4 h-4 text-white/70" />
          </button>
        )}
        <button onClick={() => setMenuOpen(true)} aria-label="Open table menu"
          className="relative w-14 h-14 rounded-full bg-[#100e16] border-2 border-gold/70 shadow-[0_0_30px_rgba(212,166,74,0.35)] flex flex-col items-center justify-center active:scale-90 transition-transform">
          <Menu className="w-5 h-5 text-gold" />
          {state.turn.number > 0 && <span className="text-[9px] font-bold text-white/60 leading-none mt-0.5">T{state.turn.number}</span>}
        </button>
        {notStarted && !spotlight && (
          <button onClick={randomFirst} aria-label="Pick a random first player"
            className="w-10 h-10 rounded-full bg-[#100e16]/90 border border-white/15 shadow-xl flex items-center justify-center active:scale-90 transition-transform">
            <Shuffle className="w-4 h-4 text-violet-300" />
          </button>
        )}
      </div>

      <TableMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        state={state}
        dispatch={dispatch}
        onRandomFirst={randomFirst}
        onCardLookup={() => setShowCardSearch(true)}
        onEndGame={endGame}
        onNewTable={endGame}
        onHome={() => navigate(createPageUrl('Lobby'))}
      />

      <AnimatePresence>
        {showCardSearch && (
          <CardShareModal
            onClose={() => setShowCardSearch(false)}
            onSend={(card) => { setCardOverlay(card); setShowCardSearch(false); }}
            playerName="Table"
            playerIndex={-1}
            accentColor="#d4a64a"
          />
        )}
      </AnimatePresence>
      {cardOverlay && <CardOverlay card={cardOverlay} onDismiss={() => setCardOverlay(null)} />}

      <AnimatePresence>
        {state.winnerId && (
          <VictoryOverlay
            state={state}
            onUndo={() => dispatch({ type: 'undo' })}
            onRematch={() => { savedWinner.current = null; dispatch({ type: 'resetGame' }); }}
            onNewTable={() => { savedWinner.current = null; dispatch({ type: 'load', state: null }); }}
          />
        )}
      </AnimatePresence>

      {/* First-time hint */}
      <AnimatePresence>
        {notStarted && state.log.length === 0 && !spotlight && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="pointer-events-none absolute left-1/2 -translate-x-1/2 z-30 text-center"
            style={{ top: 'calc(50% + 40px)' }}>
            <span className="inline-block rounded-full bg-black/70 px-3 py-1 text-[11px] text-white/70">
              Tap left/right of a life total · hold to spin · <Shuffle className="inline w-3 h-3" /> picks who starts
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
