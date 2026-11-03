import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Shield, Minus, Plus } from 'lucide-react';

export default function SharedLifeCounter({ sharedLife, startingLife = 100, onUpdate }) {
  const [lastChange, setLastChange] = useState(null);
  const lastChangeTimer = useRef(null);

  const pct = Math.max(0, Math.min(100, (sharedLife / startingLife) * 100));
  const isDanger = sharedLife <= 20;
  const isDead = sharedLife <= 0;

  const change = (delta) => {
    clearTimeout(lastChangeTimer.current);
    setLastChange(prev => (prev || 0) + delta);
    lastChangeTimer.current = setTimeout(() => setLastChange(null), 900);
    onUpdate(Math.max(0, sharedLife + delta));
  };

  return (
    <div className={`rounded-2xl border-2 p-4 transition-all ${isDead ? 'bg-red-950/60 border-red-600/80' : isDanger ? 'bg-red-950/30 border-red-700/50' : 'bg-green-950/20 border-green-800/30'}`}>
      <div className="flex items-center gap-2 mb-2">
        <Heart className={`w-4 h-4 ${isDead ? 'text-red-500' : isDanger ? 'text-red-400' : 'text-green-400'}`} />
        <span className="text-white font-bold text-sm">Shared Life Total</span>
        <Shield className="w-3 h-3 text-white/20 ml-auto" />
        <span className="text-white/30 text-xs">All Players</span>
      </div>

      {/* Life bar */}
      <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-3">
        <motion.div
          className="h-full rounded-full transition-colors"
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 100, damping: 20 }}
          style={{ background: isDead ? '#ef4444' : isDanger ? '#f97316' : '#22c55e' }}
        />
      </div>

      {/* Life display + buttons */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => change(-1)}
          disabled={isDead}
          className="w-14 h-14 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center active:scale-95 disabled:opacity-30"
        >
          <Minus className="w-6 h-6 text-red-300" />
        </button>

        <div className="flex-1 relative text-center">
          <AnimatePresence>
            {lastChange && (
              <motion.span
                key={Date.now()}
                initial={{ opacity: 1, y: 0 }}
                animate={{ opacity: 0, y: lastChange > 0 ? -30 : 30 }}
                transition={{ duration: 0.7 }}
                className={`absolute left-1/2 -translate-x-1/2 text-lg font-black pointer-events-none ${lastChange > 0 ? 'text-green-300' : 'text-red-300'}`}
                style={{ top: lastChange > 0 ? '-2rem' : 'auto', bottom: lastChange < 0 ? '-2rem' : 'auto' }}
              >
                {lastChange > 0 ? `+${lastChange}` : lastChange}
              </motion.span>
            )}
          </AnimatePresence>
          <div className={`text-5xl font-black tabular-nums leading-none ${isDead ? 'text-red-400' : isDanger ? 'text-orange-300' : 'text-white'}`}>
            {sharedLife}
          </div>
          <div className="text-white/30 text-xs mt-0.5">of {startingLife}</div>
          {isDead && <div className="text-red-400 text-xs font-bold mt-1 animate-pulse">PLAYERS LOSE</div>}
        </div>

        <button
          onClick={() => change(1)}
          className="w-14 h-14 rounded-2xl bg-green-500/20 border border-green-500/40 flex items-center justify-center active:scale-95"
        >
          <Plus className="w-6 h-6 text-green-300" />
        </button>
      </div>
    </div>
  );
}