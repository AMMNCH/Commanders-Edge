import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '@/api/backend';
import { createPageUrl } from '@/utils';
import { getQuery, pageHref } from '@/lib/nav';
import { ArrowLeft, ChevronRight, RotateCcw, Skull, Users, Swords, LayoutGrid } from 'lucide-react';
import SharedLifeCounter from '@/components/horde/SharedLifeCounter';
import HordeLibrary from '@/components/horde/HordeLibrary';
import HordeBoardState from '@/components/horde/HordeBoardState';
import HordeBoardView from '@/components/horde/HordeBoardView';
import HordeTurnPanel from '@/components/horde/HordeTurnPanel';
import HordeHUD from '@/components/horde/HordeHUD';
import TurnTimer from '@/components/mtg/TurnTimer';

const PLAYER_COLORS = {
  purple: '#a855f7', blue: '#3b82f6', red: '#ef4444',
  green: '#22c55e', gold: '#eab308', white: '#94a3b8',
};
const COLORS_LIST = ['purple', 'blue', 'red', 'green', 'gold', 'white'];

function calcStartingSharedLife(playerCount) {
  return Math.max(40, 100 - (playerCount - 1) * 15);
}

export default function HordeCommander() {
  const params = getQuery();
  const code = params.get('code');

  const [session, setSession] = useState(null);
  const sessionIdRef = useRef(null);
  const sessionRef = useRef(null);
  const [totalDamageDealt, setTotalDamageDealt] = useState(0);
  const [gameResult, setGameResult] = useState(null);
  const [activeView, setActiveView] = useState('main'); // 'main' | 'board'

  useEffect(() => {
    const load = async () => {
      if (!code) return;
      const results = await db.GameSession.filter({ code });
      if (results?.length > 0) {
        sessionIdRef.current = results[0].id;
        sessionRef.current = results[0];
        setSession(results[0]);
      }
    };
    load();
  }, [code]);

  useEffect(() => {
    const unsub = db.GameSession.subscribe((event) => {
      if ((event.type === 'update' || event.type === 'create') && event.data?.code === code) {
        sessionIdRef.current = event.id || sessionIdRef.current;
        sessionRef.current = event.data;
        setSession(event.data);
      }
    });
    return () => unsub();
  }, [code]);

  const patch = async (updater) => {
    if (!sessionIdRef.current || !sessionRef.current) return;
    const updated = updater(JSON.parse(JSON.stringify(sessionRef.current)));
    sessionRef.current = updated;
    setSession(updated);
    await db.GameSession.update(sessionIdRef.current, updated);
  };

  const updateSharedLife = (newLife) => {
    patch(s => { s.shared_life_total = newLife; return s; });
    if (newLife <= 0) setGameResult('horde_wins');
  };

  const millDamage = (amount) => {
    setTotalDamageDealt(prev => prev + amount);
    patch(s => {
      const milled = Math.min(amount, s.horde_library_size || 0);
      s.horde_library_size = Math.max(0, (s.horde_library_size || 0) - milled);
      s.horde_graveyard_size = (s.horde_graveyard_size || 0) + milled;
      return s;
    });
  };

  const updateHordeBoard = (updaterOrArray) => {
    patch(s => {
      const current = s.horde_board_state || [];
      const newCreatures = typeof updaterOrArray === 'function' ? updaterOrArray(current) : updaterOrArray;
      s.horde_board_state = newCreatures;
      if (newCreatures.length === 0 && (s.horde_library_size || 0) <= 0) {
        setGameResult('players_win');
      }
      return s;
    });
  };

  const handleWaveComplete = (revealedCards, cardCount) => {
    patch(s => {
      const milled = Math.min(cardCount, s.horde_library_size || 0);
      s.horde_library_size = Math.max(0, (s.horde_library_size || 0) - milled);
      s.horde_graveyard_size = (s.horde_graveyard_size || 0) + milled;
      const creatures = revealedCards.filter(c => c.power !== undefined);
      s.horde_board_state = [...(s.horde_board_state || []), ...creatures];
      s.horde_wave_log = [...(s.horde_wave_log || []), {
        turn: s.turn_number,
        cards_revealed: cardCount,
        timestamp: new Date().toISOString(),
      }];
      return s;
    });
    // Do NOT auto-advance turn — player needs to run attack phase first
  };

  const isHordeTurn = session?.current_turn_player === -1;

  const passTurnToNextHuman = () => {
    patch(s => {
      // Auto-destroy creatures with lethal -1/-1 counters
      s.horde_board_state = (s.horde_board_state || []).filter(c => {
        const net = (c.counters?.['+1+1'] || 0) - (c.counters?.['-1-1'] || 0);
        return (c.toughness || 0) + net > 0;
      });

      if (s.current_turn_player === -1) {
        s.current_turn_player = 0;
        s.players[0].played_land = false;
      } else {
        const next = s.current_turn_player + 1;
        if (next >= s.player_count) {
          s.current_turn_player = -1;
        } else {
          s.current_turn_player = next;
          s.players[next].played_land = false;
        }
      }
      s.turn_started_at = new Date().toISOString();
      s.turn_number = (s.turn_number || 1) + 1;
      if (s.current_turn_player === -1) {
        s.horde_board_state = (s.horde_board_state || []).map(c => ({ ...c, tapped: false }));
      }
      return s;
    });
  };

  const resetGame = () => {
    if (!session) return;
    const count = session.player_count || 4;
    const sharedLife = calcStartingSharedLife(count);
    patch(s => {
      s.shared_life_total = sharedLife;
      // Restore the library to the chosen deck's size, not a hard-coded 100.
      s.horde_library_size = s.horde_starting_library ?? 100;
      s.horde_graveyard_size = 0;
      s.horde_board_state = [];
      s.horde_wave_log = [];
      s.current_turn_player = 0;
      s.turn_number = 1;
      s.turn_started_at = new Date().toISOString();
      s.players = s.players.map(p => ({ ...p, played_land: false }));
      return s;
    });
    setTotalDamageDealt(0);
    setGameResult(null);
  };

  if (!session) {
    return (
      <div className="min-h-screen bg-obsidian flex items-center justify-center">
        <div className="text-white/40 text-lg animate-pulse">Loading Horde game...</div>
      </div>
    );
  }

  const players = session.players || [];
  const sharedLife = session.shared_life_total ?? calcStartingSharedLife(players.length);
  const startingSharedLife = calcStartingSharedLife(players.length);
  const currentPlayer = isHordeTurn ? null : players[session.current_turn_player];
  const hordeLibraryEmpty = (session.horde_library_size || 0) <= 0;
  const hordeBoardEmpty = (session.horde_board_state || []).length === 0;

  const TABS = [
    { id: 'main', label: 'Command', icon: <Skull className="w-5 h-5" /> },
    { id: 'board', label: 'Board', icon: <LayoutGrid className="w-5 h-5" /> },
  ];

  return (
    <div className="bg-gradient-to-b from-slate-950 via-red-950/20 to-slate-950 overflow-hidden relative" style={{ height: '100dvh', height: '100svh', display: 'flex', flexDirection: 'column' }}>

      {/* Two-panel slider — board slides in from the RIGHT */}
      <div
        className="flex flex-1 overflow-hidden transition-transform duration-300 ease-in-out"
        style={{ transform: activeView === 'board' ? 'translateX(-50%)' : 'translateX(0)', width: '200%' }}
      >

        {/* ── LEFT PANEL: main game view ── */}
        <div className="flex flex-col h-full w-1/2 overflow-hidden">

          {/* Header */}
          <div className="px-4 pt-4 pb-2 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <a href={pageHref(createPageUrl('Lobby'))}
                className="flex items-center justify-center w-8 h-8 rounded-xl bg-white/10 border border-white/15 text-white/50 active:bg-white/20 flex-shrink-0">
                <ArrowLeft className="w-4 h-4" />
              </a>
              <div>
                <h1 className="text-white font-black text-xl tracking-tight flex items-center gap-2">
                  <Skull className="w-5 h-5 text-red-400" />
                  Horde Commander
                </h1>
                <p className="text-white/30 text-xs">#{code} · Turn {session.turn_number}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <TurnTimer startedAt={session.turn_started_at} isMyTurn={false} />
              <button onClick={resetGame}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/10 border border-white/15 text-white/40 active:bg-white/20">
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Turn banner */}
          <div className="mx-4 mb-3">
            {isHordeTurn ? (
              <motion.div
                animate={{ opacity: [1, 0.6, 1] }}
                transition={{ duration: 1.2, repeat: Infinity }}
                className="py-2 px-4 rounded-xl flex items-center gap-2 bg-red-900/50 border border-red-600/60"
              >
                <Swords className="w-4 h-4 text-red-400" />
                <span className="text-red-200 font-bold text-sm">THE HORDE ATTACKS</span>
              </motion.div>
            ) : currentPlayer ? (
              <div className="py-2 px-4 rounded-xl flex items-center gap-2"
                style={{
                  background: `${PLAYER_COLORS[currentPlayer.color || 'purple']}22`,
                  border: `1px solid ${PLAYER_COLORS[currentPlayer.color || 'purple']}55`,
                }}>
                <Users className="w-4 h-4 flex-shrink-0" style={{ color: PLAYER_COLORS[currentPlayer.color || 'purple'] }} />
                <span className="text-white font-bold text-sm">{currentPlayer.name || `Player ${session.current_turn_player + 1}`}</span>
                <span className="text-white/40 text-xs ml-1">is taking their turn</span>
              </div>
            ) : null}
          </div>

          {/* Win condition banner */}
          {hordeLibraryEmpty && hordeBoardEmpty && !gameResult && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              className="mx-4 mb-3 py-3 px-4 rounded-xl bg-green-900/60 border border-green-500/60 text-center">
              <div className="text-green-300 font-black text-base">⚔️ Horde defeated! Library &amp; board empty!</div>
              <button onClick={() => setGameResult('players_win')}
                className="mt-2 px-4 py-1.5 rounded-lg bg-green-600 text-white text-sm font-bold active:scale-95">
                Declare Victory
              </button>
            </motion.div>
          )}

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-4 space-y-3" style={{ paddingBottom: 'calc(72px + env(safe-area-inset-bottom, 0px) + 8px)' }}>

            <SharedLifeCounter
              sharedLife={sharedLife}
              startingLife={startingSharedLife}
              onUpdate={updateSharedLife}
            />

            <HordeLibrary
              librarySize={session.horde_library_size ?? 100}
              graveyardSize={session.horde_graveyard_size ?? 0}
              onMillDamage={millDamage}
              totalDamage={totalDamageDealt}
            />

            <HordeTurnPanel
              session={session}
              onWaveComplete={handleWaveComplete}
              isHordeTurn={isHordeTurn}
              onAttackResolved={({ killedIds, tappedIds, newLife, hordeLibraryAdditions }) => {
                patch(s => {
                  s.horde_board_state = (s.horde_board_state || [])
                    .filter(c => !killedIds.includes(c.id))
                    .map(c => tappedIds.includes(c.id) ? { ...c, tapped: true } : c);
                  s.shared_life_total = newLife;
                  if (hordeLibraryAdditions > 0) {
                    s.horde_library_size = (s.horde_library_size || 0) + hordeLibraryAdditions;
                    s.horde_graveyard_size = Math.max(0, (s.horde_graveyard_size || 0) - hordeLibraryAdditions);
                  }
                  return s;
                });
                if (newLife <= 0) setGameResult('horde_wins');
              }}
            />

            <HordeBoardState
              creatures={session.horde_board_state || []}
              onUpdate={updateHordeBoard}
            />

            {/* Wave log */}
            {(session.horde_wave_log || []).length > 0 && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-2">Wave History</p>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {[...session.horde_wave_log].reverse().map((entry, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="text-white/30">T{entry.turn}</span>
                      <span className="text-red-400">{entry.cards_revealed} card{entry.cards_revealed !== 1 ? 's' : ''} revealed</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Players turn order */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-white/50" />
                <span className="text-white font-bold text-sm">Turn Order</span>
              </div>
              <div className="flex gap-2 flex-wrap mb-2">
                {players.map((p, i) => {
                  const isActive = !isHordeTurn && i === session.current_turn_player;
                  const accent = PLAYER_COLORS[p.color || COLORS_LIST[i % COLORS_LIST.length]];
                  return (
                    <div key={i}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${isActive ? 'bg-white/15' : 'bg-white/5 border-white/10'}`}
                      style={{ borderColor: isActive ? accent + 'aa' : undefined, color: isActive ? '#fff' : 'rgba(255,255,255,0.5)' }}>
                      <span className="w-1.5 h-1.5 rounded-full inline-block mr-1.5" style={{ background: accent }} />
                      {p.name || `P${i + 1}`}
                      {isActive && <span className="ml-1 text-[9px]">▶</span>}
                    </div>
                  );
                })}
              </div>
              <button
                onClick={passTurnToNextHuman}
                className="w-full py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95"
                style={{
                  background: isHordeTurn ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.1)',
                  border: isHordeTurn ? '1px solid rgba(34,197,94,0.4)' : '1px solid rgba(255,255,255,0.15)',
                  color: isHordeTurn ? '#86efac' : 'rgba(255,255,255,0.6)',
                }}
              >
                <ChevronRight className="w-4 h-4" />
                {isHordeTurn
                  ? 'End Horde Turn → Player 1'
                  : `End Turn → ${session.current_turn_player + 1 >= session.player_count ? 'Horde' : `Player ${session.current_turn_player + 2}`}`}
              </button>
            </div>
          </div>

          {/* Game over overlay */}
          <AnimatePresence>
            {gameResult && (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
              >
                <motion.div
                  initial={{ scale: 0.8, y: 20 }} animate={{ scale: 1, y: 0 }}
                  className="mx-6 rounded-3xl p-8 text-center border"
                  style={{
                    background: gameResult === 'players_win' ? 'linear-gradient(135deg,#064e3b,#065f46)' : 'linear-gradient(135deg,#450a0a,#7f1d1d)',
                    borderColor: gameResult === 'players_win' ? '#22c55e88' : '#dc262688',
                  }}
                >
                  <div className="text-6xl mb-4">{gameResult === 'players_win' ? '🏆' : '💀'}</div>
                  <h2 className="text-white font-black text-2xl mb-2">
                    {gameResult === 'players_win' ? 'PLAYERS WIN!' : 'HORDE WINS!'}
                  </h2>
                  <p className="text-white/60 text-sm mb-6">
                    {gameResult === 'players_win'
                      ? 'The Horde has been defeated. The survivors prevail!'
                      : 'The Horde has overwhelmed the survivors. All is lost.'}
                  </p>
                  <div className="flex gap-3">
                    <button onClick={resetGame} className="flex-1 py-3 rounded-xl bg-white/10 text-white font-bold active:scale-95">
                      Play Again
                    </button>
                    <a href={pageHref(createPageUrl('Lobby'))} className="flex-1 py-3 rounded-xl bg-white/20 text-white font-bold text-center active:scale-95">
                      Lobby
                    </a>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── RIGHT PANEL: board view ── */}
        <div className="flex flex-col h-full w-1/2 overflow-hidden">
          {/* HUD overlay at top of board */}
          <div className="flex-shrink-0 relative z-10 px-3 pt-3">
            <HordeHUD session={session} onLifeChange={updateSharedLife} onPassTurn={passTurnToNextHuman} />
          </div>
          {/* Board fills the rest, above the fixed tab bar */}
          <div className="flex-1 overflow-hidden" style={{ paddingBottom: 'calc(72px + env(safe-area-inset-bottom, 0px))' }}>
            <HordeBoardView
              creatures={session.horde_board_state || []}
              onUpdate={updateHordeBoard}
            />
          </div>
        </div>

      </div>

      {/* ── Bottom tab bar (always on top, outside slider) ── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t"
        style={{
          background: 'rgba(10,10,20,0.97)',
          borderColor: 'rgba(255,255,255,0.1)',
          paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)',
          paddingTop: '8px',
          minHeight: '56px',
        }}
      >
        {TABS.map(tab => {
          const active = activeView === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveView(tab.id)}
              className="flex flex-col items-center gap-1 px-8 py-1 transition-all active:scale-95"
              style={{ color: active ? '#ef4444' : 'rgba(255,255,255,0.35)' }}
            >
              {tab.icon}
              <span className="text-[10px] font-bold tracking-wide uppercase">{tab.label}</span>
              {active && <div className="w-5 h-0.5 rounded-full bg-red-500 mt-0.5" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}