import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Skull, Minus, Plus } from 'lucide-react';
import { playSound } from './SoundEffects';

export default function PoisonCounter() {
  const [poison, setPoison] = useState(0);
  const [pulse, setPulse] = useState(false);

  const handleChange = (amount) => {
    const newValue = Math.max(0, Math.min(10, poison + amount));
    if (newValue !== poison) {
      playSound('poison');
      setPoison(newValue);
      setPulse(true);
      setTimeout(() => setPulse(false), 300);
    }
  };

  const poisonLevel = poison / 10;
  const isLethal = poison >= 10;

  return (
    <motion.div
      className={`relative rounded-2xl overflow-hidden border-2 transition-colors duration-300 ${
        isLethal ? 'border-red-500 bg-red-900/50' : 'border-green-500/50 bg-gradient-to-br from-green-900/80 to-emerald-900/80'
      }`}
      animate={pulse ? { scale: [1, 1.02, 1] } : {}}
      initial={{ opacity: 0, scale: 0.9 }}
      whileInView={{ opacity: 1, scale: 1 }}
    >
      {/* Toxic drip effect */}
      <div 
        className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-green-400/30 to-transparent transition-all duration-500"
        style={{ height: `${poisonLevel * 100}%` }}
      />
      
      <div className="relative p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <motion.div
              animate={isLethal ? { rotate: [0, -10, 10, 0] } : {}}
              transition={{ repeat: Infinity, duration: 0.5 }}
            >
              <Skull className={`w-5 h-5 ${isLethal ? 'text-red-400' : 'text-green-400'}`} />
            </motion.div>
            <span className="text-white/80 font-medium text-sm">Poison</span>
          </div>
          {isLethal && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="text-xs font-bold text-red-400 bg-red-500/20 px-2 py-0.5 rounded-full"
            >
              LETHAL
            </motion.span>
          )}
        </div>

        <div className="flex items-center justify-center gap-3">
          <motion.button
            whileTap={{ scale: 0.8 }}
            onClick={() => handleChange(-1)}
            className="w-10 h-10 rounded-xl bg-black/30 border border-white/20 flex items-center justify-center"
          >
            <Minus className="w-5 h-5 text-white" />
          </motion.button>

          <div className="flex gap-1">
            {[...Array(10)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ scale: 0 }}
                animate={{ 
                  scale: i < poison ? 1 : 0.6,
                  opacity: i < poison ? 1 : 0.3
                }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className={`w-3 h-6 rounded-full ${
                  i < poison ? 'bg-green-400' : 'bg-white/20'
                }`}
              />
            ))}
          </div>

          <motion.button
            whileTap={{ scale: 0.8 }}
            onClick={() => handleChange(1)}
            className="w-10 h-10 rounded-xl bg-black/30 border border-white/20 flex items-center justify-center"
          >
            <Plus className="w-5 h-5 text-white" />
          </motion.button>
        </div>

        <AnimatePresence mode="wait">
          <motion.p
            key={poison}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="text-center text-2xl font-bold text-white mt-2"
          >
            {poison}
          </motion.p>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}