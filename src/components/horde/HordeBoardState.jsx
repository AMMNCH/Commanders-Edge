import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Sword, Plus, X, RotateCcw } from 'lucide-react';

export default function HordeBoardState({ creatures = [], onUpdate }) {
  const [showAdd, setShowAdd] = useState(false);
  const [newCreature, setNewCreature] = useState({ name: '', power: 2, toughness: 2, is_token: true });

  const tapToggle = (id) => {
    onUpdate(creatures.map(c => c.id === id ? { ...c, tapped: !c.tapped } : c));
  };

  const remove = (id) => {
    onUpdate(creatures.filter(c => c.id !== id));
  };

  const addCreature = () => {
    if (!newCreature.name.trim()) return;
    const creature = {
      ...newCreature,
      id: Date.now().toString(),
      has_haste: true,
      is_goaded: true,
      is_defender: false,
      tapped: false,
    };
    onUpdate([...creatures, creature]);
    setNewCreature({ name: '', power: 2, toughness: 2, is_token: true });
    setShowAdd(false);
  };

  const untapAll = () => {
    onUpdate(creatures.map(c => ({ ...c, tapped: false })));
  };

  return (
    <div className="bg-red-950/30 border border-red-800/40 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sword className="w-4 h-4 text-red-400" />
          <span className="text-red-200 font-bold text-sm">Horde Board</span>
          <span className="text-red-400/60 text-xs">({creatures.length} creatures)</span>
        </div>
        <div className="flex items-center gap-2">
          {creatures.some(c => c.tapped) && (
            <button onClick={untapAll}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-500/20 border border-blue-500/40 text-blue-300 text-xs active:scale-95">
              <RotateCcw className="w-3 h-3" /> Untap All
            </button>
          )}
          <button onClick={() => setShowAdd(v => !v)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500/20 border border-red-500/40 text-red-300 text-xs active:scale-95">
            <Plus className="w-3 h-3" /> Add
          </button>
        </div>
      </div>

      {/* Add creature form */}
      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mb-3">
            <div className="bg-black/30 rounded-xl p-3 space-y-2 border border-white/10">
              <input
                value={newCreature.name}
                onChange={e => setNewCreature(p => ({ ...p, name: e.target.value }))}
                placeholder="Creature name (e.g. Zombie 2/2)"
                className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-white text-sm placeholder-white/30 focus:outline-none focus:border-red-500"
                style={{ WebkitUserSelect: 'text', userSelect: 'text' }}
              />
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-white/40 text-xs">Power</label>
                  <div className="flex items-center gap-1 mt-1">
                    <button onClick={() => setNewCreature(p => ({ ...p, power: Math.max(0, p.power - 1) }))}
                      className="w-7 h-7 rounded-lg bg-white/10 text-white text-sm active:bg-white/20">-</button>
                    <span className="flex-1 text-center text-white font-bold">{newCreature.power}</span>
                    <button onClick={() => setNewCreature(p => ({ ...p, power: p.power + 1 }))}
                      className="w-7 h-7 rounded-lg bg-white/10 text-white text-sm active:bg-white/20">+</button>
                  </div>
                </div>
                <div className="flex-1">
                  <label className="text-white/40 text-xs">Toughness</label>
                  <div className="flex items-center gap-1 mt-1">
                    <button onClick={() => setNewCreature(p => ({ ...p, toughness: Math.max(1, p.toughness - 1) }))}
                      className="w-7 h-7 rounded-lg bg-white/10 text-white text-sm active:bg-white/20">-</button>
                    <span className="flex-1 text-center text-white font-bold">{newCreature.toughness}</span>
                    <button onClick={() => setNewCreature(p => ({ ...p, toughness: p.toughness + 1 }))}
                      className="w-7 h-7 rounded-lg bg-white/10 text-white text-sm active:bg-white/20">+</button>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowAdd(false)}
                  className="flex-1 py-1.5 rounded-lg bg-white/5 text-white/50 text-sm">Cancel</button>
                <button onClick={addCreature}
                  className="flex-1 py-1.5 rounded-lg bg-red-600 text-white text-sm font-bold active:scale-95">Add to Board</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Creatures grid */}
      {creatures.length === 0 ? (
        <p className="text-white/20 text-xs text-center py-3">No creatures in play</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {creatures.map(c => (
            <motion.div
              key={c.id}
              layout
              className={`relative flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all ${
                c.tapped
                  ? 'bg-white/5 border-white/10 text-white/30 italic'
                  : 'bg-red-900/40 border-red-600/50 text-red-200'
              }`}
              style={{ transform: c.tapped ? 'rotate(10deg)' : 'none' }}
            >
              <button onClick={() => remove(c.id)}
                className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-slate-800 border border-white/20 flex items-center justify-center text-white/40 active:text-red-400">
                <X className="w-2.5 h-2.5" />
              </button>
              <span className="text-[10px] max-w-[70px] truncate leading-tight">{c.name}</span>
              <span className="text-sm font-black">{c.power}/{c.toughness}</span>
              <button onClick={() => tapToggle(c.id)}
                className="text-[9px] text-white/30 underline active:text-white/60">
                {c.tapped ? 'untap' : 'tap'}
              </button>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}