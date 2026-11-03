import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Swords, Plus, Minus, ChevronDown } from 'lucide-react';
import { playSound } from './SoundEffects';

const COLORS = [
  'from-blue-600 to-blue-800',
  'from-red-600 to-red-800',
  'from-green-600 to-green-800',
  'from-purple-600 to-purple-800',
  'from-amber-600 to-amber-800',
  'from-slate-500 to-slate-700',
];

export default function CommanderDamage({ playerCount = 4 }) {
  const [expanded, setExpanded] = useState(false);
  const [damage, setDamage] = useState({});

  const opponents = Array.from({ length: playerCount }, (_, i) => ({
    id: i + 1,
    name: `Player ${i + 1}`,
    color: COLORS[i % COLORS.length],
  }));

  const handleChange = (id, amount) => {
    playSound('commander');
    setDamage(prev => ({ ...prev, [id]: Math.max(0, (prev[id] || 0) + amount) }));
  };

  const totalDamage = Object.values(damage).reduce((a, b) => a + b, 0);

  return (
    <div className="rounded-2xl bg-gradient-to-br from-amber-900/80 to-orange-900/80 border border-amber-500/50 overflow-hidden">
      <button
        className="w-full p-3.5 flex items-center justify-between active:bg-white/5 transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-center gap-2">
          <Swords className="w-4 h-4 text-amber-400" />
          <span className="text-white font-semibold text-sm">Commander Damage</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-amber-400 font-bold">{totalDamage}</span>
          <ChevronDown
            className="w-4 h-4 text-white/50 transition-transform duration-200"
            style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
          />
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 grid grid-cols-2 gap-2">
              {opponents.map(opp => {
                const dmg = damage[opp.id] || 0;
                const lethal = dmg >= 21;
                return (
                  <div
                    key={opp.id}
                    className={`rounded-xl bg-gradient-to-r ${opp.color} p-2.5`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white/80 text-xs font-medium">{opp.name}</span>
                      {lethal && <span className="text-red-300 text-xs">⚔️</span>}
                    </div>
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => handleChange(opp.id, -1)}
                        className="w-7 h-7 rounded-lg bg-black/30 flex items-center justify-center active:bg-red-600/40"
                      >
                        <Minus className="w-3.5 h-3.5 text-white" />
                      </button>
                      <span className={`text-2xl font-black w-10 text-center ${lethal ? 'text-red-300' : 'text-white'}`}>
                        {dmg}
                      </span>
                      <button
                        onClick={() => handleChange(opp.id, 1)}
                        className="w-7 h-7 rounded-lg bg-black/30 flex items-center justify-center active:bg-green-600/40"
                      >
                        <Plus className="w-3.5 h-3.5 text-white" />
                      </button>
                    </div>
                    <div className="mt-1.5 h-1 bg-black/30 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-200 ${lethal ? 'bg-red-400' : 'bg-white/50'}`}
                        style={{ width: `${Math.min(100, (dmg / 21) * 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}