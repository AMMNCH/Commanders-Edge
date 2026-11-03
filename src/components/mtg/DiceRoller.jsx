import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { playSound } from './SoundEffects';
import { base44 } from '@/api/base44Client';

const DICE_TYPES = [
  { sides: 4,  label: 'D4',  color: '#06b6d4', bg: 'bg-cyan-600' },
  { sides: 6,  label: 'D6',  color: '#3b82f6', bg: 'bg-blue-600' },
  { sides: 8,  label: 'D8',  color: '#8b5cf6', bg: 'bg-purple-600' },
  { sides: 10, label: 'D10', color: '#ec4899', bg: 'bg-pink-600' },
  { sides: 12, label: 'D12', color: '#ef4444', bg: 'bg-red-600' },
  { sides: 20, label: 'D20', color: '#f59e0b', bg: 'bg-amber-500' },
];

// Simple dice face SVGs
const DieFace = ({ value, sides, color, size = 96 }) => {
  const isNat20 = sides === 20 && value === 20;
  const isNat1 = value === 1;
  const faceColor = isNat20 ? '#fbbf24' : isNat1 ? '#dc2626' : color;

  return (
    <svg width={size} height={size} viewBox="0 0 96 96">
      {sides === 6 ? (
        <rect x="4" y="4" width="88" height="88" rx="16" fill={faceColor} />
      ) : sides === 4 ? (
        <polygon points="48,6 92,88 4,88" fill={faceColor} />
      ) : sides === 8 ? (
        <polygon points="48,4 92,48 48,92 4,48" fill={faceColor} />
      ) : sides === 12 ? (
        <polygon points="48,4 78,16 92,46 82,78 56,92 40,92 14,78 4,46 18,16" fill={faceColor} />
      ) : sides === 20 ? (
        <polygon points="48,4 88,28 88,68 48,92 8,68 8,28" fill={faceColor} />
      ) : (
        <polygon points="48,4 86,30 78,74 18,74 10,30" fill={faceColor} />
      )}
      <text
        x="48" y="58"
        textAnchor="middle"
        fill={isNat20 ? '#000' : '#fff'}
        fontSize={value >= 10 ? '30' : '34'}
        fontWeight="900"
        fontFamily="system-ui, sans-serif"
      >
        {value}
      </text>
    </svg>
  );
};

export default function DiceRoller() {
  const [selected, setSelected] = useState(DICE_TYPES[5]);
  const [result, setResult] = useState(null);
  const [rolling, setRolling] = useState(false);
  const [history, setHistory] = useState([]);
  const rollIdRef = useRef(0);

  const rollDice = async () => {
    if (rolling) return;
    setRolling(true);
    setResult(null);
    playSound('dice');

    const thisRoll = ++rollIdRef.current;
    const sides = selected.sides;

    // Quick visual shuffle — local, instant
    let shuffleCount = 0;
    const shuffleInterval = setInterval(() => {
      setResult({ value: Math.floor(Math.random() * sides) + 1, shuffling: true });
      shuffleCount++;
      if (shuffleCount >= 6) clearInterval(shuffleInterval);
    }, 60);

    // Fetch real roll via LLM
    let finalValue;
    try {
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate a single random integer between 1 and ${sides} inclusive. Seed: ${Date.now()}-${Math.random()}`,
        response_json_schema: {
          type: "object",
          properties: { roll: { type: "integer" } },
          required: ["roll"]
        }
      });
      finalValue = Math.max(1, Math.min(sides, response.roll || Math.floor(Math.random() * sides) + 1));
    } catch {
      finalValue = Math.floor(Math.random() * sides) + 1;
    }

    clearInterval(shuffleInterval);

    if (thisRoll !== rollIdRef.current) return;

    setResult({ value: finalValue, shuffling: false });
    setHistory(prev => [{ dice: selected.label, value: finalValue, color: selected.color, id: Date.now() }, ...prev.slice(0, 5)]);
    setRolling(false);
  };

  const isNat20 = selected.sides === 20 && result?.value === 20;
  const isNat1 = result?.value === 1;

  return (
    <div className="rounded-2xl bg-slate-800/90 border border-slate-600/50 overflow-hidden">
      <div className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-yellow-400" />
          <span className="text-white/80 font-semibold">Dice Roller</span>
        </div>

        {/* Dice type selector */}
        <div className="grid grid-cols-6 gap-1.5 mb-4">
          {DICE_TYPES.map((dice) => (
            <button
              key={dice.sides}
              onClick={() => { setSelected(dice); setResult(null); }}
              className={`py-2 rounded-lg text-xs font-bold transition-all active:scale-90 ${
                selected.sides === dice.sides
                  ? `${dice.bg} text-white shadow-md`
                  : 'bg-white/10 text-white/50'
              }`}
            >
              {dice.label}
            </button>
          ))}
        </div>

        {/* Roll area */}
        <div className="flex items-center gap-4">
          <button
            onClick={rollDice}
            disabled={rolling}
            className={`flex-1 py-4 rounded-xl ${selected.bg} text-white font-bold text-lg active:scale-95 transition-transform disabled:opacity-60`}
          >
            Roll {selected.label}
          </button>

          <div className="w-24 h-24 flex items-center justify-center">
            <AnimatePresence mode="wait">
              {result !== null && (
                <motion.div
                  key={result.shuffling ? 'shuffle' : result.value}
                  initial={result.shuffling ? {} : { scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={result.shuffling ? { duration: 0 } : { type: 'spring', stiffness: 600, damping: 25 }}
                  className="relative"
                >
                  <DieFace value={result.value} sides={selected.sides} color={selected.color} />
                  {!result.shuffling && isNat20 && (
                    <div className="absolute -top-1 -right-1 text-lg">🎉</div>
                  )}
                  {!result.shuffling && isNat1 && (
                    <div className="absolute -top-1 -right-1 text-lg">💀</div>
                  )}
                </motion.div>
              )}
              {result === null && !rolling && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="w-24 h-24 rounded-xl border-2 border-dashed border-white/20 flex items-center justify-center"
                >
                  <span className="text-white/30 text-2xl">?</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* History row */}
        {history.length > 0 && (
          <div className="mt-3 pt-3 border-t border-white/10 flex gap-2 flex-wrap">
            {history.map((roll, i) => (
              <span
                key={roll.id}
                className="px-2.5 py-1 rounded-lg bg-white/10 text-white text-xs font-medium"
                style={{ opacity: 1 - i * 0.15 }}
              >
                {roll.dice} <span className="font-black" style={{ color: roll.color }}>{roll.value}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}