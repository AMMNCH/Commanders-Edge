import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Minus, Plus, RotateCcw } from 'lucide-react';
import { playSound } from './SoundEffects';

const PLAYER_COLORS = [
  { key: 'purple', bg: 'from-purple-900 to-violet-800', border: 'border-purple-500/50', accent: 'bg-purple-500' },
  { key: 'blue',   bg: 'from-blue-900 to-cyan-800',    border: 'border-blue-500/50',   accent: 'bg-blue-500' },
  { key: 'red',    bg: 'from-red-900 to-orange-800',   border: 'border-red-500/50',    accent: 'bg-red-500' },
  { key: 'green',  bg: 'from-green-900 to-emerald-800',border: 'border-green-500/50',  accent: 'bg-green-500' },
  { key: 'gold',   bg: 'from-yellow-900 to-amber-800', border: 'border-yellow-500/50', accent: 'bg-yellow-500' },
  { key: 'white',  bg: 'from-slate-700 to-slate-600',  border: 'border-slate-400/50',  accent: 'bg-slate-300' },
];

export default function LifeCounter({ playerName = "Player", startingLife = 40, colorKey = "purple", index = 0 }) {
  const [life, setLife] = useState(startingLife);
  const [lastChange, setLastChange] = useState(null);
  const [hitFlash, setHitFlash] = useState(false);
  const tapTimer = useRef(null);
  const tapCount = useRef(0);

  const colorConfig = PLAYER_COLORS.find(c => c.key === colorKey) || PLAYER_COLORS[index % PLAYER_COLORS.length];

  // Danger level 0–1
  const danger = Math.max(0, Math.min(1, 1 - (life / startingLife)));
  const isDanger = life <= 10;
  const isDead = life <= 0;

  // Danger overlay color
  const getDangerStyle = () => {
    if (life <= 0) return 'rgba(180,0,0,0.55)';
    if (life <= 5) return `rgba(160,0,0,${0.15 + danger * 0.4})`;
    if (life <= 10) return `rgba(200,50,0,${danger * 0.35})`;
    return 'transparent';
  };

  const handleChange = (amount) => {
    playSound(amount > 0 ? 'increment' : 'decrement');
    setLife(prev => prev + amount);
    setLastChange(amount);
    if (amount < 0) {
      setHitFlash(true);
      setTimeout(() => setHitFlash(false), 200);
    }
    setTimeout(() => setLastChange(null), 700);
  };

  const handleTap = (e, amount) => {
    e.preventDefault();
    e.stopPropagation();
    tapCount.current += 1;
    if (tapTimer.current) clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => {
      if (tapCount.current >= 2) {
        handleChange(amount * 5);
      } else {
        handleChange(amount);
      }
      tapCount.current = 0;
    }, 220);
  };

  const handleReset = () => {
    playSound('reset');
    setLife(startingLife);
  };

  return (
    <div className={`relative rounded-2xl bg-gradient-to-br ${colorConfig.bg} border-2 ${colorConfig.border} overflow-hidden`}>
      {/* Hit flash overlay */}
      <div
        className="absolute inset-0 pointer-events-none transition-all duration-150 rounded-2xl"
        style={{ backgroundColor: hitFlash ? 'rgba(255,0,0,0.3)' : getDangerStyle() }}
      />

      {/* Danger pulse border */}
      {isDanger && !isDead && (
        <div className="absolute inset-0 rounded-2xl border-2 border-red-500 animate-pulse pointer-events-none opacity-60" />
      )}

      <div className="relative p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Heart className={`w-4 h-4 fill-current ${isDead ? 'text-gray-500' : 'text-red-400'}`} />
            <span className="text-white/80 font-semibold text-sm">{playerName}</span>
          </div>
          <button
            onClick={handleReset}
            className="p-1.5 rounded-full bg-white/10 active:bg-white/25 transition-colors"
          >
            <RotateCcw className="w-4 h-4 text-white/60" />
          </button>
        </div>

        <div className="flex items-center justify-between gap-2">
          <button
            onPointerDown={(e) => handleTap(e, -1)}
            className="w-14 h-14 rounded-xl bg-black/40 border border-white/15 flex items-center justify-center active:bg-red-600/50 transition-colors touch-none"
          >
            {isDead ? <span className="text-2xl">💀</span> : <Minus className="w-7 h-7 text-white" />}
          </button>

          <div className="relative flex-1 flex justify-center">
            <AnimatePresence mode="popLayout">
              <motion.span
                key={life}
                initial={{ y: lastChange > 0 ? 15 : -15, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
                className={`text-6xl font-black tabular-nums leading-none ${
                  isDead ? 'text-gray-500' : isDanger ? 'text-red-300' : 'text-white'
                }`}
              >
                {life}
              </motion.span>
            </AnimatePresence>
            <AnimatePresence>
              {lastChange && (
                <motion.span
                  initial={{ opacity: 1, y: 0, x: '-50%' }}
                  animate={{ opacity: 0, y: -28 }}
                  transition={{ duration: 0.6 }}
                  className={`absolute -top-1 left-1/2 text-base font-bold pointer-events-none ${lastChange > 0 ? 'text-green-400' : 'text-red-400'}`}
                >
                  {lastChange > 0 ? '+' : ''}{lastChange}
                </motion.span>
              )}
            </AnimatePresence>

            {/* Gravestone overlay when dead */}
            <AnimatePresence>
              {isDead && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.5, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
                  className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
                >
                  <svg width="44" height="52" viewBox="0 0 44 52" fill="none" xmlns="http://www.w3.org/2000/svg">
                    {/* Base */}
                    <rect x="4" y="44" width="36" height="6" rx="2" fill="#6b7280" />
                    {/* Stone body */}
                    <path d="M8 44 V20 Q8 8 22 8 Q36 8 36 20 V44 Z" fill="#4b5563" />
                    {/* RIP text area */}
                    <rect x="14" y="22" width="16" height="10" rx="2" fill="#374151" opacity="0.6" />
                    <text x="22" y="30" textAnchor="middle" fontSize="6" fill="#9ca3af" fontWeight="bold" fontFamily="serif">RIP</text>
                    {/* Cross */}
                    <rect x="20" y="12" width="4" height="12" rx="1" fill="#9ca3af" />
                    <rect x="15" y="15" width="14" height="4" rx="1" fill="#9ca3af" />
                  </svg>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            onPointerDown={(e) => handleTap(e, 1)}
            className="w-14 h-14 rounded-xl bg-black/40 border border-white/15 flex items-center justify-center active:bg-green-600/50 transition-colors touch-none"
          >
            {isDead ? <span className="text-2xl">🪽</span> : <Plus className="w-7 h-7 text-white" />}
          </button>
        </div>

        <p className="text-center text-white/30 text-xs mt-1.5">Double-tap ±5</p>
      </div>
    </div>
  );
}