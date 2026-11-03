import React from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Flame, Skull } from 'lucide-react';

export default function HordeLibrary({ librarySize = 100, graveyardSize = 0, onMillDamage, totalDamage = 0 }) {
  const pct = Math.max(0, Math.min(100, (librarySize / (librarySize + graveyardSize || 1)) * 100));
  const isEmpty = librarySize <= 0;

  return (
    <div className={`rounded-2xl border p-4 ${isEmpty ? 'bg-green-950/40 border-green-600/50' : 'bg-slate-900/60 border-white/10'}`}>
      <div className="flex items-center gap-2 mb-3">
        <BookOpen className={`w-4 h-4 ${isEmpty ? 'text-green-400' : 'text-white/60'}`} />
        <span className="text-white font-bold text-sm">Horde Library</span>
        {isEmpty && <span className="text-green-400 text-xs font-bold ml-auto animate-pulse">⚔ LIBRARY EMPTY!</span>}
      </div>

      {/* Library bar */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1 h-3 bg-white/10 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            animate={{ width: `${pct}%` }}
            transition={{ type: 'spring', stiffness: 100, damping: 20 }}
            style={{ background: isEmpty ? '#22c55e' : librarySize < 20 ? '#ef4444' : '#dc2626' }}
          />
        </div>
        <div className="text-right flex-shrink-0">
          <div className={`text-2xl font-black tabular-nums ${isEmpty ? 'text-green-400' : librarySize < 20 ? 'text-red-300' : 'text-white'}`}>
            {librarySize}
          </div>
          <div className="text-white/30 text-[10px]">cards left</div>
        </div>
      </div>

      {/* Graveyard */}
      <div className="flex items-center gap-2 mb-4">
        <Skull className="w-3 h-3 text-white/30" />
        <span className="text-white/40 text-xs">{graveyardSize} milled to graveyard</span>
        {totalDamage > 0 && (
          <span className="ml-auto text-xs text-red-400 font-bold">
            <Flame className="w-3 h-3 inline mr-0.5" />{totalDamage} total damage dealt
          </span>
        )}
      </div>

      {/* Mill damage input */}
      <div>
        <p className="text-white/40 text-xs mb-2">Deal damage to Horde (mills cards):</p>
        <div className="flex gap-2 flex-wrap">
          {[1, 2, 3, 5, 10].map(dmg => (
            <button
              key={dmg}
              onClick={() => onMillDamage(dmg)}
              disabled={isEmpty || librarySize < dmg}
              className="flex-1 min-w-[40px] py-2 rounded-xl text-sm font-black border transition-all active:scale-95 disabled:opacity-30"
              style={{
                background: 'rgba(220,38,38,0.2)',
                borderColor: 'rgba(220,38,38,0.4)',
                color: '#fca5a5',
              }}
            >
              -{dmg}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}