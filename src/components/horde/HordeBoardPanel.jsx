import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Swords, X, Plus, Minus, RotateCcw } from 'lucide-react';

const COUNTER_TYPES = [
  { id: '+1+1', label: '+1/+1', color: '#22c55e' },
  { id: '-1-1', label: '-1/-1', color: '#ef4444' },
  { id: 'damage', label: 'Dmg', color: '#f97316' },
];

function CreatureRow({ creature, onTap, onRemove, onCounter }) {
  const [expanded, setExpanded] = useState(false);

  const netP1P1 = (creature.counters?.['+1+1'] || 0) - (creature.counters?.['-1-1'] || 0);
  const effectivePower = (creature.power || 0) + netP1P1;
  const effectiveToughness = (creature.toughness || 0) + netP1P1;

  return (
    <div className={`rounded-xl border overflow-hidden ${creature.tapped ? 'border-white/10 opacity-60' : 'border-red-800/50'} bg-black/20`}>
      {/* Main row */}
      <div className="flex items-center gap-2 p-2">
        {/* Card thumb */}
        <div className="w-10 h-14 flex-shrink-0 rounded-lg overflow-hidden bg-red-900/40 flex items-center justify-center"
          style={{ transform: `rotate(${creature.tapped ? 20 : 0}deg)`, transition: 'transform 0.2s' }}>
          {creature.image_url
            ? <img src={creature.image_url} alt={creature.name} className="w-full h-full object-cover pointer-events-none" draggable={false} />
            : <span className="text-red-300 text-[10px] font-bold text-center px-1 leading-tight">{creature.name}</span>
          }
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="text-white text-xs font-bold truncate">{creature.name}</div>
          <div className="text-red-300 text-sm font-black">{effectivePower}/{effectiveToughness}</div>
          {creature.tapped && <div className="text-white/30 text-[10px]">TAPPED</div>}
          {/* Counter badges */}
          <div className="flex gap-1 mt-0.5 flex-wrap">
            {COUNTER_TYPES.map(ct => {
              const v = creature.counters?.[ct.id] || 0;
              if (!v) return null;
              return <span key={ct.id} className="text-[9px] font-black px-1 rounded-full" style={{ background: ct.color + '33', color: ct.color }}>{ct.label} {v}</span>;
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1 flex-shrink-0">
          <button onClick={() => onTap(creature.id)}
            className="px-2 py-1 rounded-lg bg-white/10 border border-white/15 text-white/60 text-[10px] font-bold active:bg-white/20">
            {creature.tapped ? 'Untap' : 'Tap'}
          </button>
          <button onClick={() => setExpanded(v => !v)}
            className="px-2 py-1 rounded-lg bg-white/10 border border-white/15 text-white/60 text-[10px] font-bold active:bg-white/20">
            Counters
          </button>
          <button onClick={() => onRemove(creature.id)}
            className="px-2 py-1 rounded-lg bg-red-900/30 border border-red-700/30 text-red-300 text-[10px] font-bold active:bg-red-900/60">
            Destroy
          </button>
        </div>
      </div>

      {/* Expandable counter controls */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-white/10"
          >
            <div className="p-2 flex flex-col gap-1.5">
              {COUNTER_TYPES.map(ct => (
                <div key={ct.id} className="flex items-center gap-2">
                  <span className="text-[10px] font-bold w-12 flex-shrink-0" style={{ color: ct.color }}>{ct.label}</span>
                  <button onClick={() => onCounter(creature.id, ct.id, -1)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/5 border border-white/10 text-white/60 active:bg-white/20">
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="text-white text-sm font-black w-5 text-center">{creature.counters?.[ct.id] || 0}</span>
                  <button onClick={() => onCounter(creature.id, ct.id, 1)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/5 border border-white/10 text-white/60 active:bg-white/20">
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function HordeBoardPanel({ creatures, onUpdate }) {
  const [open, setOpen] = useState(false);

  const tapCreature = useCallback((id) => {
    onUpdate(prev => (prev || []).map(c => c.id === id ? { ...c, tapped: !c.tapped } : c));
  }, [onUpdate]);

  const removeCreature = useCallback((id) => {
    onUpdate(prev => (prev || []).filter(c => c.id !== id));
  }, [onUpdate]);

  const addCounter = useCallback((id, counterType, delta) => {
    onUpdate(prev => (prev || []).map(c => {
      if (c.id !== id) return c;
      const counters = { ...(c.counters || {}) };
      counters[counterType] = Math.max(0, (counters[counterType] || 0) + delta);
      return { ...c, counters };
    }));
  }, [onUpdate]);

  const untapAll = useCallback(() => {
    onUpdate(prev => (prev || []).map(c => ({ ...c, tapped: false })));
  }, [onUpdate]);

  const tappedCount = creatures.filter(c => c.tapped).length;

  return (
    <div className="rounded-2xl bg-black/20 border border-red-900/40 overflow-hidden mb-3">
      {/* Header — always visible */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between p-3 active:bg-white/5"
      >
        <div className="flex items-center gap-2">
          <Swords className={`w-4 h-4 ${creatures.length > 0 ? 'text-red-400' : 'text-white/20'}`} />
          <span className="text-white font-bold text-sm">Horde Board</span>
          {creatures.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-red-500/20 border border-red-500/30 text-red-300 text-[10px] font-black">
              {creatures.length}
            </span>
          )}
          {tappedCount > 0 && (
            <span className="text-white/30 text-[10px]">{tappedCount} tapped</span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-white/40 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Expandable content */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-2 border-t border-white/10">
              {creatures.length === 0 ? (
                <div className="py-6 text-center text-white/20 text-sm">No creatures on the board</div>
              ) : (
                <>
                  {tappedCount > 0 && (
                    <button onClick={untapAll}
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-300 text-xs font-bold active:scale-95 mt-2">
                      <RotateCcw className="w-3 h-3" /> Untap All
                    </button>
                  )}
                  <div className="space-y-2 mt-2">
                    {creatures.map(c => (
                      <CreatureRow
                        key={c.id}
                        creature={{ ...c, counters: c.counters || {} }}
                        onTap={tapCreature}
                        onRemove={removeCreature}
                        onCounter={addCounter}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}