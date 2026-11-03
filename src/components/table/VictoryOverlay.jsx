import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Trophy, RotateCcw, Undo2, LayoutGrid, Clock, Layers } from 'lucide-react';
import { accentOf } from '@/lib/theme';
import { deathReason } from '@/lib/table';

const OUT = { life: 'life', poison: 'poison', commander: 'cmdr dmg', conceded: 'conceded' };

export default function VictoryOverlay({ state, onRematch, onUndo, onNewTable }) {
  const winner = state.players.find((p) => p.id === state.winnerId);
  const accent = accentOf(winner?.color);

  useEffect(() => {
    if (!winner) return undefined;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return undefined;
    const colors = [accent, '#d4a64a', '#ffffff'];
    confetti({ particleCount: 140, spread: 90, origin: { y: 0.6 }, colors });
    const id = setTimeout(() => confetti({ particleCount: 80, spread: 120, origin: { y: 0.4 }, colors }), 500);
    return () => clearTimeout(id);
  }, [winner?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!winner) return null;
  const mins = Math.max(1, Math.round(((state.endedAt || Date.now()) - state.startedAt) / 60000));

  return (
    <motion.div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-6"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <motion.div initial={{ scale: 0.85, y: 20 }} animate={{ scale: 1, y: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 22 }}
        className="w-full max-w-sm rounded-3xl overflow-hidden border border-white/15 bg-[#100e16] text-white text-center">
        <div className="relative h-36 flex items-end justify-center pb-4"
          style={{
            background: winner.art
              ? `linear-gradient(180deg, transparent, #100e16), url("${winner.art}") center / cover`
              : `radial-gradient(circle at 50% 30%, ${accent}88, #100e16 70%)`,
          }}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-2xl" style={{ background: accent }}>
            <Trophy className="w-8 h-8 text-black/80" />
          </div>
        </div>
        <div className="px-6 pb-6">
          <p className="label-caps text-gold">Victory</p>
          <h2 className="font-display text-3xl mt-1">{winner.name}</h2>
          {winner.commander && <p className="text-white/50 text-sm mt-0.5">{winner.commander}</p>}

          <div className="flex justify-center gap-4 mt-4 text-white/60 text-xs">
            <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{mins} min</span>
            <span className="flex items-center gap-1"><Layers className="w-3.5 h-3.5" />{state.turn.number || 0} turn{state.turn.number === 1 ? '' : 's'}</span>
          </div>

          <div className="mt-4 space-y-1 text-left">
            {state.players.filter((p) => p.id !== winner.id).map((p) => (
              <div key={p.id} className="flex items-center gap-2 text-sm text-white/60">
                <span className="w-2 h-2 rounded-full" style={{ background: accentOf(p.color) }} />
                <span className="flex-1 truncate">{p.name}</span>
                <span className="text-white/35 text-xs">{OUT[deathReason(p)] || ''}</span>
              </div>
            ))}
          </div>

          <p className="text-white/35 text-[11px] mt-4">Saved to your game history.</p>
          <div className="grid grid-cols-3 gap-2 mt-3">
            <button onClick={onUndo} className="tile-sm"><Undo2 className="w-4 h-4" />Undo</button>
            <button onClick={onNewTable} className="tile-sm"><LayoutGrid className="w-4 h-4" />New table</button>
            <button onClick={onRematch} className="tile-sm !bg-gold !text-black !border-transparent"><RotateCcw className="w-4 h-4" />Rematch</button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
