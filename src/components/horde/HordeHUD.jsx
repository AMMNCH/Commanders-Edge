import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Heart, BookOpen, Skull, Swords, Minus, Plus, ChevronRight, Zap } from 'lucide-react';

export default function HordeHUD({ session, onLifeChange, onPassTurn }) {
  const [lifeStep, setLifeStep] = useState(1);

  const sharedLife = session?.shared_life_total ?? 0;
  const startingLife = Math.max(40, 100 - ((session?.player_count || 4) - 1) * 15);
  const librarySize = session?.horde_library_size ?? 100;
  const graveyardSize = session?.horde_graveyard_size ?? 0;
  const boardCount = (session?.horde_board_state || []).length;
  const isHordeTurn = session?.current_turn_player === -1;
  const players = session?.players || [];
  const currentPlayerIdx = session?.current_turn_player ?? 0;
  const currentPlayer = isHordeTurn ? null : players[currentPlayerIdx];

  // Derived stats
  const totalPower = (session?.horde_board_state || []).reduce((sum, c) => {
    const net = (c.counters?.['+1+1'] || 0) - (c.counters?.['-1-1'] || 0);
    return sum + (c.power || 0) + net;
  }, 0);
  const tappedCount = (session?.horde_board_state || []).filter(c => c.tapped).length;
  const pct = Math.max(0, Math.min(100, (sharedLife / startingLife) * 100));
  const isDanger = sharedLife <= Math.floor(startingLife * 0.25);
  const isDead = sharedLife <= 0;

  const nextLabel = isHordeTurn
    ? `→ P1`
    : currentPlayerIdx + 1 >= (session?.player_count || 4) ? '→ Horde' : `→ P${currentPlayerIdx + 2}`;

  return (
    <div className={`rounded-xl border transition-all ${
      isDead ? 'bg-red-950/60 border-red-600/70' :
      isDanger ? 'bg-red-950/30 border-red-700/40' :
      'bg-black/40 border-white/10'
    }`}>
      {/* Top row: life + pass turn */}
      <div className="flex items-center gap-2 px-2 pt-2 pb-1.5">
        {/* Life controls */}
        <button
          onClick={() => onLifeChange(Math.max(0, sharedLife - lifeStep))}
          disabled={isDead}
          className="w-8 h-8 rounded-lg bg-red-500/20 border border-red-500/30 flex items-center justify-center active:scale-90 disabled:opacity-30 flex-shrink-0"
        >
          <Minus className="w-3.5 h-3.5 text-red-300" />
        </button>

        {/* Life display */}
        <div className="flex-1 flex flex-col items-center">
          <div className={`text-xl font-black tabular-nums leading-none ${isDead ? 'text-red-400' : isDanger ? 'text-orange-300' : 'text-white'}`}>
            {sharedLife}
            <span className="text-white/25 text-[10px] font-normal ml-1">/ {startingLife}</span>
          </div>
          {/* Life bar */}
          <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden mt-1">
            <motion.div
              className="h-full rounded-full"
              animate={{ width: `${pct}%` }}
              transition={{ type: 'spring', stiffness: 120, damping: 22 }}
              style={{ background: isDead ? '#ef4444' : isDanger ? '#f97316' : '#22c55e' }}
            />
          </div>
        </div>

        <button
          onClick={() => onLifeChange(sharedLife + lifeStep)}
          className="w-8 h-8 rounded-lg bg-green-500/20 border border-green-500/30 flex items-center justify-center active:scale-90 flex-shrink-0"
        >
          <Plus className="w-3.5 h-3.5 text-green-300" />
        </button>

        {/* Step selector */}
        <div className="flex flex-col gap-0.5">
          {[1, 5, 10].map(s => (
            <button key={s} onClick={() => setLifeStep(s)}
              className={`w-6 h-5 rounded text-[9px] font-bold transition-all ${lifeStep === s ? 'bg-white/20 text-white' : 'bg-white/5 text-white/30'}`}>
              {s}
            </button>
          ))}
        </div>

        {/* Pass turn */}
        {onPassTurn && (
          <button onClick={onPassTurn}
            className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-bold active:scale-95 flex-shrink-0 ${
              isHordeTurn ? 'bg-green-600/25 border border-green-500/40 text-green-300' : 'bg-white/10 border border-white/15 text-white/60'
            }`}>
            <ChevronRight className="w-3 h-3" />
            {nextLabel}
          </button>
        )}
      </div>

      {/* Turn + horde attack indicator */}
      {isHordeTurn && (
        <motion.div
          animate={{ opacity: [1, 0.5, 1] }}
          transition={{ duration: 1.1, repeat: Infinity }}
          className="mx-2 mb-1.5 py-0.5 px-2 rounded-md bg-red-900/40 border border-red-600/30 flex items-center justify-center gap-1"
        >
          <Swords className="w-2.5 h-2.5 text-red-400" />
          <span className="text-red-300 font-black text-[9px] uppercase tracking-widest">Horde Attacks</span>
        </motion.div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-5 gap-1 px-2 pb-2">
        <StatPill icon={<BookOpen className="w-2.5 h-2.5 text-blue-400" />} value={librarySize} label="Lib" />
        <StatPill icon={<Skull className="w-2.5 h-2.5 text-gray-400" />} value={graveyardSize} label="GY" />
        <StatPill icon={<Swords className="w-2.5 h-2.5 text-red-400" />} value={boardCount} label="Board" highlight={boardCount > 0} />
        <StatPill icon={<Zap className="w-2.5 h-2.5 text-yellow-400" />} value={totalPower} label="Power" highlight={totalPower > 0} />
        <StatPill icon={<Heart className="w-2.5 h-2.5 text-purple-400" />} value={tappedCount} label="Tapped" />
      </div>
    </div>
  );
}

function StatPill({ icon, value, label, highlight }) {
  return (
    <div className={`flex flex-col items-center py-1 rounded-lg border ${highlight ? 'bg-white/8 border-white/15' : 'bg-white/4 border-white/8'}`}>
      {icon}
      <span className={`font-black text-xs tabular-nums leading-none mt-0.5 ${highlight ? 'text-white' : 'text-white/60'}`}>{value}</span>
      <span className="text-white/25 text-[8px] leading-none mt-0.5">{label}</span>
    </div>
  );
}