import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Minus, Plus, X } from 'lucide-react';
import { playSound } from './SoundEffects';

export default function CounterWidget({ counter, onRemove }) {
  const [value, setValue] = useState(0);
  const [flash, setFlash] = useState(null);

  const handleChange = (amount) => {
    const newVal = Math.max(0, value + amount);
    setValue(newVal);
    setFlash(amount > 0 ? 'up' : 'down');
    playSound(amount > 0 ? 'increment' : 'decrement');
    setTimeout(() => setFlash(null), 300);
  };

  const isLethal = counter.lethal && value >= counter.lethal;

  return (
    <div className={`relative rounded-xl border overflow-hidden transition-colors duration-300 ${
      isLethal
        ? 'bg-red-900/70 border-red-400/60'
        : `${counter.bg} ${counter.border}`
    }`}>
      <div className="p-3">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-lg">{counter.icon}</span>
            <span className="text-white/80 text-xs font-semibold">{counter.label}</span>
          </div>
          <div className="flex items-center gap-1">
            {isLethal && (
              <span className="text-red-300 text-xs font-bold animate-pulse">☠</span>
            )}
            <button onClick={onRemove} className="text-white/30 hover:text-white/70 p-0.5">
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => handleChange(-1)}
            className="w-8 h-8 rounded-lg bg-black/30 flex items-center justify-center active:bg-red-500/30"
          >
            <Minus className="w-4 h-4 text-white" />
          </button>

          <div className="relative">
            <AnimatePresence mode="wait">
              <motion.span
                key={value}
                initial={{ y: flash === 'up' ? 8 : -8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.1 }}
                className="text-3xl font-black text-white tabular-nums"
              >
                {value}
              </motion.span>
            </AnimatePresence>
          </div>

          <button
            onClick={() => handleChange(1)}
            className="w-8 h-8 rounded-lg bg-black/30 flex items-center justify-center active:bg-green-500/30"
          >
            <Plus className="w-4 h-4 text-white" />
          </button>
        </div>

        {counter.lethal && (
          <div className="mt-1.5 h-1 bg-black/30 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${Math.min(100, (value / counter.lethal) * 100)}%`,
                background: isLethal ? '#ef4444' : '#86efac'
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}