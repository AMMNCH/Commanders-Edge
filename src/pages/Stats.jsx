import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Trophy, Clock, Trash2, Swords, Crown } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { listGames, deleteGame, clearHistory } from '@/lib/history';
import { computeStats } from '@/lib/table';
import { accentOf } from '@/lib/theme';

function fmtDuration(ms) {
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function fmtDate(ts) {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const OUT = { life: 'Life', poison: 'Poison', commander: 'Cmdr dmg', conceded: 'Conceded' };

export default function Stats() {
  const [games, setGames] = useState(listGames);
  const [confirmClear, setConfirmClear] = useState(false);
  const stats = useMemo(() => computeStats(games), [games]);
  const maxWins = Math.max(1, ...stats.players.map((p) => p.wins));

  const remove = (id) => { deleteGame(id); setGames(listGames()); };

  return (
    <div className="min-h-[100dvh] bg-arcane text-white">
      <div className="max-w-md mx-auto px-4 pb-16" style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}>
        <div className="flex items-center gap-3 py-2">
          <Link to={createPageUrl('Lobby')} aria-label="Back"
            className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-white/70" />
          </Link>
          <div>
            <h1 className="font-display text-2xl tracking-wide">Game history</h1>
            <p className="text-white/45 text-xs">Games played on this device</p>
          </div>
        </div>

        {games.length === 0 ? (
          <div className="card-glass p-8 mt-6 text-center">
            <Trophy className="w-10 h-10 text-gold mx-auto" />
            <p className="font-display text-lg mt-3">No games yet</p>
            <p className="text-white/50 text-sm mt-1">Finish a game at a table and it will show up here, with wins for each player.</p>
            <Link to={createPageUrl('Table')} className="btn-gold inline-block mt-5 px-8">Start a table</Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2 mt-4">
              {[
                { label: 'Games', value: stats.totalGames },
                { label: 'Avg length', value: fmtDuration(stats.avgDurationMs) },
                { label: 'Players', value: stats.players.length },
              ].map((s) => (
                <div key={s.label} className="card-glass p-3 text-center">
                  <div className="font-display text-2xl tabular-nums">{s.value}</div>
                  <div className="label-caps mt-1">{s.label}</div>
                </div>
              ))}
            </div>

            <p className="label-caps mt-6 mb-2">Leaderboard</p>
            <div className="card-glass divide-y divide-white/5">
              {stats.players.map((p, i) => (
                <div key={p.name} className="flex items-center gap-3 px-3 py-2.5">
                  <span className="w-6 text-center font-display text-white/40">{i === 0 && p.wins > 0 ? <Crown className="w-4 h-4 text-gold mx-auto" /> : i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-semibold truncate">{p.name}</span>
                      <span className="text-xs text-white/50 tabular-nums flex-shrink-0">{p.wins}W · {p.games}G · {Math.round(p.winRate * 100)}%</span>
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <motion.div className="h-full rounded-full bg-gold" initial={{ width: 0 }} animate={{ width: `${(p.wins / maxWins) * 100}%` }} />
                    </div>
                    {p.favoriteCommander && <div className="text-[11px] text-white/40 mt-1 truncate">Usually plays {p.favoriteCommander}</div>}
                  </div>
                </div>
              ))}
            </div>

            <p className="label-caps mt-6 mb-2">Recent games</p>
            <div className="space-y-2">
              {games.map((g) => (
                <div key={g.id} className="card-glass p-3">
                  <div className="flex items-center gap-2">
                    <Trophy className={`w-4 h-4 ${g.winnerName ? 'text-gold' : 'text-white/25'}`} />
                    <span className="font-semibold flex-1 truncate">{g.winnerName ? `${g.winnerName} won` : 'No winner recorded'}</span>
                    <button onClick={() => remove(g.id)} aria-label="Delete game" className="p-1.5 rounded-lg text-white/30 active:bg-white/10">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-white/45 mt-1">
                    <span>{fmtDate(g.startedAt)}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{fmtDuration(g.durationMs)}</span>
                    <span>{g.turns} turns</span>
                    <span>{g.startingLife} life</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {g.players.map((p) => (
                      <span key={p.id} className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] border ${p.id === g.winnerId ? 'border-gold/50 bg-gold/10 text-white' : 'border-white/10 bg-white/5 text-white/55'}`}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: accentOf(p.color) }} />
                        {p.name}
                        {p.commander && <span className="text-white/35">· {p.commander}</span>}
                        {p.outBy && <span className="text-white/30">· {OUT[p.outBy]}</span>}
                        {p.commanderDamageDealt > 0 && <span className="text-amber-300/70 flex items-center gap-0.5"><Swords className="w-2.5 h-2.5" />{p.commanderDamageDealt}</span>}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 text-center">
              {confirmClear ? (
                <div className="flex items-center justify-center gap-2">
                  <span className="text-sm text-white/60">Delete all history?</span>
                  <button onClick={() => { clearHistory(); setGames([]); setConfirmClear(false); }} className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-200 text-sm font-bold">Delete</button>
                  <button onClick={() => setConfirmClear(false)} className="px-3 py-1.5 rounded-lg bg-white/10 text-sm">Cancel</button>
                </div>
              ) : (
                <button onClick={() => setConfirmClear(true)} className="text-xs text-white/35 underline underline-offset-4">Clear history</button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
