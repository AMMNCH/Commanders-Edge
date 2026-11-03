import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { Heart, Clock, Skull, Crown, Zap, Target, Trophy, ChevronLeft, Swords, Timer, ArrowLeft } from 'lucide-react';
import { createPageUrl } from '@/utils';
import TurnTimer from '@/components/mtg/TurnTimer';

const PLAYER_COLORS = {
  purple: '#a855f7', blue: '#3b82f6', red: '#ef4444',
  green: '#22c55e', gold: '#eab308', white: '#94a3b8',
};
const COLORS_LIST = ['purple', 'blue', 'red', 'green', 'gold', 'white'];

// ── Mini-game: Archenemy Vote ──────────────────────────────────────────────
function ArchenemyVote({ players }) {
  const [votes, setVotes] = useState({});
  const [myVote, setMyVote] = useState(null);
  const total = Object.values(votes).reduce((a, b) => a + b, 0);

  const vote = (idx) => {
    if (myVote !== null) {
      setVotes(prev => {
        const next = { ...prev };
        next[myVote] = Math.max(0, (next[myVote] || 1) - 1);
        next[idx] = (next[idx] || 0) + 1;
        return next;
      });
    } else {
      setVotes(prev => ({ ...prev, [idx]: (prev[idx] || 0) + 1 }));
    }
    setMyVote(idx);
  };

  const topIdx = total > 0
    ? Object.entries(votes).sort((a, b) => b[1] - a[1])[0]?.[0]
    : null;

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Target className="w-4 h-4 text-red-400" />
        <span className="text-white font-bold text-sm">Archenemy Vote</span>
        <span className="text-white/30 text-xs ml-auto">Tap to vote</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {players.filter(p => p.life > 0).map((p, i) => {
          const pct = total > 0 ? ((votes[i] || 0) / total) * 100 : 0;
          const isTop = String(i) === topIdx && (votes[i] || 0) > 0;
          const isMyVote = myVote === i;
          return (
            <button
              key={i}
              onClick={() => vote(i)}
              className={`relative rounded-xl p-2.5 border text-left overflow-hidden transition-all ${
                isMyVote ? 'border-red-400/60 bg-red-500/20' : 'border-white/10 bg-white/5'
              }`}
            >
              <div
                className="absolute inset-y-0 left-0 bg-red-500/20 transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
              <div className="relative flex items-center justify-between">
                <span className="text-white text-xs font-semibold truncate">{p.name || `P${i+1}`}</span>
                <span className="text-red-400 text-xs font-bold ml-1">{votes[i] || 0}</span>
              </div>
              {isTop && <div className="absolute top-1 right-1 text-xs">⚔️</div>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Mini-game: Speed Round ─────────────────────────────────────────────────
function SpeedRound() {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [scores, setScores] = useState([]);
  const intervalRef = useRef(null);

  const start = () => {
    setElapsed(0);
    setRunning(true);
    intervalRef.current = setInterval(() => setElapsed(e => e + 10), 10);
  };

  const stop = () => {
    clearInterval(intervalRef.current);
    setRunning(false);
    const t = elapsed;
    setScores(prev => [...prev, t].sort((a, b) => a - b).slice(0, 5));
  };

  useEffect(() => () => clearInterval(intervalRef.current), []);

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Zap className="w-4 h-4 text-yellow-400" />
        <span className="text-white font-bold text-sm">Speed Round</span>
        <span className="text-white/30 text-xs ml-auto">Stop it fast!</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex-1 text-center">
          <div className={`text-3xl font-black tabular-nums ${running ? 'text-yellow-300' : 'text-white/40'}`}>
            {(elapsed / 1000).toFixed(2)}s
          </div>
        </div>
        <button
          onPointerDown={running ? stop : start}
          className={`px-4 py-2 rounded-xl font-bold text-sm transition-all active:scale-95 ${
            running
              ? 'bg-red-500 text-white'
              : 'bg-yellow-500 text-black'
          }`}
        >
          {running ? 'STOP' : 'START'}
        </button>
      </div>
      {scores.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {scores.map((s, i) => (
            <span key={i} className={`text-xs px-2 py-0.5 rounded-full ${i === 0 ? 'bg-yellow-500/30 text-yellow-300' : 'bg-white/10 text-white/50'}`}>
              {i === 0 ? '🏆 ' : ''}{(s / 1000).toFixed(2)}s
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Mini-game: Bounty ──────────────────────────────────────────────────────
function BountyBoard({ players }) {
  const [bounties, setBounties] = useState({});
  const [selected, setSelected] = useState(null);

  const setBounty = (idx) => {
    setSelected(idx);
    setBounties(prev => {
      const next = { ...prev };
      if (next[idx]) delete next[idx]; else next[idx] = true;
      return next;
    });
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="w-4 h-4 text-amber-400" />
        <span className="text-white font-bold text-sm">Bounty Board</span>
        <span className="text-white/30 text-xs ml-auto">First to eliminate wins</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {players.filter(p => p.life > 0).map((p, i) => (
          <button
            key={i}
            onClick={() => setBounty(i)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
              bounties[i]
                ? 'bg-amber-500/30 border-amber-400/60 text-amber-300'
                : 'bg-white/5 border-white/10 text-white/50'
            }`}
          >
            {bounties[i] && <span>🎯</span>}
            {p.name || `P${i+1}`}
          </button>
        ))}
      </div>
      {Object.keys(bounties).length > 0 && (
        <p className="text-amber-400/60 text-xs mt-2">
          Bounty active on {Object.keys(bounties).length} player{Object.keys(bounties).length > 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
}

// ── Turn time tracker ──────────────────────────────────────────────────────
function TurnTimeStats({ session }) {
  // Build per-player average turn time from current elapsed (simple approximation)
  const players = session?.players || [];
  const currentIdx = session?.current_turn_player ?? 0;
  const turnStart = session?.turn_started_at ? new Date(session.turn_started_at) : null;
  const currentElapsed = turnStart ? Math.floor((Date.now() - turnStart.getTime()) / 1000) : 0;

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Timer className="w-4 h-4 text-cyan-400" />
        <span className="text-white font-bold text-sm">Turn Timers</span>
      </div>
      <div className="space-y-2">
        {players.map((p, i) => {
          const isActive = i === currentIdx;
          const colorKey = p.color || COLORS_LIST[i % COLORS_LIST.length];
          const accent = PLAYER_COLORS[colorKey] || '#a855f7';
          const secs = isActive ? currentElapsed : 0;
          const warn = secs > 120;
          return (
            <div key={i} className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: accent }} />
              <span className="text-white/70 text-xs flex-1 truncate">{p.name || `P${i+1}`}</span>
              {isActive ? (
                <span className={`text-xs font-mono font-bold ${warn ? 'text-red-400' : 'text-green-300'}`}>
                  {String(Math.floor(secs / 60)).padStart(2, '0')}:{String(secs % 60).padStart(2, '0')} ▶
                </span>
              ) : (
                <span className="text-white/20 text-xs font-mono">--:--</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Scoreboard ────────────────────────────────────────────────────────
export default function Scoreboard() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const [session, setSession] = useState(null);
  const [tab, setTab] = useState('scores'); // 'scores' | 'games'

  useEffect(() => {
    const load = async () => {
      if (!code) return;
      const results = await base44.entities.GameSession.filter({ code });
      if (results?.length > 0) setSession(results[0]);
    };
    load();
  }, [code]);

  useEffect(() => {
    const unsub = base44.entities.GameSession.subscribe((event) => {
      if ((event.type === 'update' || event.type === 'create') && event.data?.code === code) {
        setSession(event.data);
      }
    });
    return () => unsub();
  }, [code]);

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-white/40 text-lg animate-pulse">Loading scoreboard...</div>
      </div>
    );
  }

  const players = session.players || [];
  const sorted = [...players].sort((a, b) => b.life - a.life);
  const alive = players.filter(p => p.life > 0);
  const dead = players.filter(p => p.life <= 0);
  const leader = sorted.find(p => p.life > 0);
  const totalLife = players.reduce((s, p) => s + Math.max(0, p.life), 0);
  const avgLife = alive.length > 0 ? Math.round(totalLife / alive.length) : 0;
  const currentPlayer = players[session.current_turn_player];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex flex-col pt-safe-top">

      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <a href={createPageUrl('Lobby')}
            className="flex items-center justify-center w-8 h-8 rounded-xl bg-white/10 border border-white/15 text-white/50 active:bg-white/20 flex-shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </a>
          <div>
            <h1 className="text-white font-black text-xl tracking-tight">Scoreboard</h1>
            <p className="text-white/30 text-xs">#{code} · Turn {session.turn_number}</p>
          </div>
        </div>
        <TurnTimer startedAt={session.turn_started_at} isMyTurn={false} />
      </div>

      {/* Active turn banner */}
      {currentPlayer && (
        <div
          className="mx-4 mb-3 py-2 px-4 rounded-xl flex items-center gap-2"
          style={{ background: `${PLAYER_COLORS[currentPlayer.color || 'purple']}22`, border: `1px solid ${PLAYER_COLORS[currentPlayer.color || 'purple']}55` }}
        >
          <Swords className="w-4 h-4 flex-shrink-0" style={{ color: PLAYER_COLORS[currentPlayer.color || 'purple'] }} />
          <span className="text-white font-bold text-sm">{currentPlayer.name || `Player ${session.current_turn_player + 1}`}</span>
          <span className="text-white/40 text-xs ml-1">is taking their turn</span>
        </div>
      )}

      {/* Tab switcher */}
      <div className="mx-4 mb-3 flex gap-1 bg-white/5 rounded-xl p-1 flex-shrink-0">
        {[['scores', 'Standings'], ['games', 'Mini-Games']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 py-1.5 rounded-lg text-sm font-bold transition-all ${
              tab === key ? 'bg-white/15 text-white' : 'text-white/40'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-8 space-y-3">
        <AnimatePresence mode="wait">
          {tab === 'scores' ? (
            <motion.div key="scores" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="space-y-3">

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Alive', value: alive.length, icon: '❤️' },
                  { label: 'Avg Life', value: avgLife, icon: '📊' },
                  { label: 'Turn', value: session.turn_number, icon: '🔄' },
                ].map(s => (
                  <div key={s.label} className="bg-white/5 border border-white/10 rounded-xl p-2.5 text-center">
                    <div className="text-lg">{s.icon}</div>
                    <div className="text-white font-black text-lg leading-none">{s.value}</div>
                    <div className="text-white/30 text-xs">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Player cards with life bars */}
              {sorted.map((player, rank) => {
                const originalIdx = players.findIndex(p => p.name === player.name && p.color === player.color);
                const isActive = originalIdx === session.current_turn_player;
                const colorKey = player.color || COLORS_LIST[originalIdx % COLORS_LIST.length];
                const accent = PLAYER_COLORS[colorKey] || '#a855f7';
                const isDead = player.life <= 0;
                const isDanger = !isDead && player.life <= 10;
                const isLeader = !isDead && player === leader;
                const lifePct = Math.max(0, Math.min(100, (player.life / (session.starting_life || 40)) * 100));

                return (
                  <motion.div
                    key={rank}
                    layout
                    animate={{ scale: isActive ? 1.01 : 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    className="rounded-2xl overflow-hidden border"
                    style={{
                      borderColor: isActive ? accent + 'aa' : isDead ? '#ffffff11' : '#ffffff15',
                      background: isDead ? 'rgba(0,0,0,0.3)' : `linear-gradient(135deg, ${accent}18 0%, rgba(0,0,0,0.2) 100%)`,
                    }}
                  >
                    <div className="p-3">
                      <div className="flex items-center gap-3">
                        {/* Rank / status icon */}
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ background: isDead ? '#ffffff0a' : accent + '22' }}>
                          {isDead
                            ? <Skull className="w-5 h-5 text-gray-500" />
                            : isLeader
                              ? <Crown className="w-5 h-5" style={{ color: accent }} />
                              : <span className="text-white/40 font-black text-base">#{rank + 1}</span>
                          }
                        </div>

                        {/* Name + badges */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`font-bold text-sm ${isDead ? 'text-gray-500 line-through' : 'text-white'}`}>
                              {player.name || `Player ${originalIdx + 1}`}
                            </span>
                            {isActive && (
                              <span className="text-xs px-1.5 py-0.5 rounded-full font-bold"
                                style={{ background: accent + '33', color: accent }}>▶ NOW</span>
                            )}
                            {player.played_land && (
                              <span className="text-xs text-green-400 bg-green-500/15 px-1.5 py-0.5 rounded-full">🌿</span>
                            )}
                            {player.poison > 0 && (
                              <span className="text-xs text-green-300 bg-green-900/40 px-1.5 py-0.5 rounded-full">☠ {player.poison}</span>
                            )}
                          </div>
                          {/* Life bar */}
                          <div className="mt-1.5 h-1.5 rounded-full bg-white/10 overflow-hidden">
                            <motion.div
                              className="h-full rounded-full"
                              animate={{ width: `${lifePct}%` }}
                              transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                              style={{
                                background: isDead ? '#4b5563' : isDanger ? '#ef4444' : accent,
                              }}
                            />
                          </div>
                        </div>

                        {/* Life number */}
                        <div className={`text-3xl font-black tabular-nums flex-shrink-0 ${
                          isDead ? 'text-gray-600' : isDanger ? 'text-red-300' : 'text-white'
                        }`}>
                          {player.life}
                        </div>
                      </div>
                    </div>

                    {/* Active player glow strip */}
                    {isActive && (
                      <div className="h-0.5" style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />
                    )}
                  </motion.div>
                );
              })}

              {/* Turn time stats */}
              <TurnTimeStats session={session} />

            </motion.div>
          ) : (
            <motion.div key="games" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="space-y-3">
              <p className="text-white/30 text-xs text-center pb-1">Between-turn mini-games</p>
              <ArchenemyVote players={players} />
              <BountyBoard players={players} />
              <SpeedRound />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}