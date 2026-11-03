import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '@/api/backend';
import { Clock, Users, ArrowRight, Skull, Swords, Trash2 } from 'lucide-react';

const STORAGE_KEY = 'mtg_recent_games';

export function saveRecentGame({ code, game_mode, playerIndex, playerName }) {
  const existing = getStoredGames();
  const filtered = existing.filter(g => g.code !== code);
  const updated = [{ code, game_mode, playerIndex, playerName, last_played: Date.now() }, ...filtered].slice(0, 5);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

function getStoredGames() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function formatDuration(isoStart) {
  if (!isoStart) return '—';
  const ms = Date.now() - new Date(isoStart).getTime();
  const mins = Math.floor(ms / 60000);
  const hrs = Math.floor(mins / 60);
  if (hrs > 0) return `${hrs}h ${mins % 60}m`;
  return `${mins}m`;
}

export default function RecentGames({ onJoin }) {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = getStoredGames();
    if (stored.length === 0) { setLoading(false); return; }

    Promise.all(
      stored.map(g =>
        (db.GameSession.peek || db.GameSession.filter)({ code: g.code })
          .then(res => res?.[0] ? { ...g, session: res[0] } : null)
          .catch(() => null)
      )
    ).then(results => {
      setGames(results.filter(Boolean));
      setLoading(false);
    });
  }, []);

  const removeGame = (code) => {
    const stored = getStoredGames().filter(g => g.code !== code);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    setGames(prev => prev.filter(g => g.code !== code));
  };

  if (loading || games.length === 0) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4">
      <p className="text-white/30 text-xs font-semibold uppercase tracking-wider mb-2 px-1">Recent Games</p>
      <div className="space-y-2">
        <AnimatePresence>
          {games.map(g => {
            const s = g.session;
            const isHorde = s.game_mode === 'horde_commander';
            const activePlayers = s.players?.length || s.player_count || '?';
            const duration = formatDuration(s.turn_started_at);
            const isEnded = s.status === 'ended';

            return (
              <motion.div key={g.code} layout exit={{ opacity: 0, x: -20 }}
                className={`rounded-2xl border p-3 flex items-center gap-3 ${isHorde ? 'bg-red-950/40 border-red-800/30' : 'bg-white/8 border-white/15'}`}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isHorde ? 'bg-red-700/40' : 'bg-purple-700/40'}`}>
                  {isHorde ? <Skull className="w-4 h-4 text-red-300" /> : <Swords className="w-4 h-4 text-purple-300" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-black text-base tracking-widest">{g.code}</span>
                    {isEnded && <span className="text-[9px] font-bold bg-white/10 text-white/40 px-1.5 py-0.5 rounded">ENDED</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="flex items-center gap-1 text-white/40 text-xs">
                      <Users className="w-3 h-3" />
                      {activePlayers} players
                    </span>
                    <span className="flex items-center gap-1 text-white/40 text-xs">
                      <Clock className="w-3 h-3" />
                      {duration}
                    </span>
                    <span className="text-white/25 text-xs">Turn {s.turn_number || 1}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button onClick={() => removeGame(g.code)}
                    className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/5 text-white/20 active:bg-white/10">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  {!isEnded && (
                    <button onClick={() => onJoin(g)}
                      className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-black active:scale-95 transition-transform ${isHorde ? 'bg-red-700/50 text-red-200 border border-red-600/40' : 'bg-purple-600/50 text-purple-200 border border-purple-500/40'}`}>
                      <ArrowRight className="w-3.5 h-3.5" />
                      Rejoin
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}