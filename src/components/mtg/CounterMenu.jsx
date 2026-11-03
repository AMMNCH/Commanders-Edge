import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X } from 'lucide-react';

export const ALL_COUNTERS = [
  { id: 'poison',      label: 'Poison',       icon: '☠️',  bg: 'bg-green-900/70',   border: 'border-green-500/50',  lethal: 10 },
  { id: 'energy',      label: 'Energy',       icon: '⚡',  bg: 'bg-yellow-900/70',  border: 'border-yellow-500/50', lethal: null },
  { id: 'experience',  label: 'Experience',   icon: '🌟',  bg: 'bg-amber-900/70',   border: 'border-amber-500/50',  lethal: null },
  { id: 'rad',         label: 'Rad',          icon: '☢️',  bg: 'bg-lime-900/70',    border: 'border-lime-500/50',   lethal: null },
  { id: 'storm',       label: 'Storm',        icon: '🌩️', bg: 'bg-blue-900/70',    border: 'border-blue-500/50',   lethal: null },
  { id: 'lore',        label: 'Lore',         icon: '📚',  bg: 'bg-indigo-900/70',  border: 'border-indigo-500/50', lethal: null },
  { id: 'loyalty',     label: 'Loyalty',      icon: '🛡️', bg: 'bg-violet-900/70',  border: 'border-violet-500/50', lethal: null },
  { id: '+1/+1',       label: '+1/+1',        icon: '⚔️', bg: 'bg-emerald-900/70', border: 'border-emerald-500/50',lethal: null },
  { id: '-1/-1',       label: '-1/-1',        icon: '💔',  bg: 'bg-rose-900/70',    border: 'border-rose-500/50',   lethal: null },
  { id: 'dungeon',     label: 'Dungeon',      icon: '🏰',  bg: 'bg-stone-900/70',   border: 'border-stone-500/50',  lethal: null },
  { id: 'aegis',       label: 'Aegis',        icon: '🔮',  bg: 'bg-cyan-900/70',    border: 'border-cyan-500/50',   lethal: null },
  { id: 'acorn',       label: 'Acorn',        icon: '🌰',  bg: 'bg-orange-900/70',  border: 'border-orange-500/50', lethal: null },
  { id: 'infection',   label: 'Infect',       icon: '🦠',  bg: 'bg-green-900/70',   border: 'border-green-400/50',  lethal: 10 },
  { id: 'ticket',      label: 'Ticket',       icon: '🎟️', bg: 'bg-pink-900/70',    border: 'border-pink-500/50',   lethal: null },
  { id: 'gold',        label: 'Gold',         icon: '🪙',  bg: 'bg-yellow-800/70',  border: 'border-yellow-400/50', lethal: null },
  { id: 'treasure',    label: 'Treasure',     icon: '💎',  bg: 'bg-amber-800/70',   border: 'border-amber-400/50',  lethal: null },
  { id: 'bounty',      label: 'Bounty',       icon: '🎯',  bg: 'bg-red-900/70',     border: 'border-red-400/50',    lethal: null },
  { id: 'day',         label: 'Day/Night',    icon: '🌙',  bg: 'bg-slate-800/70',   border: 'border-slate-400/50',  lethal: null },
  { id: 'loot',        label: 'Loot',         icon: '🎁',  bg: 'bg-teal-900/70',    border: 'border-teal-500/50',   lethal: null },
  { id: 'stun',        label: 'Stun',         icon: '💫',  bg: 'bg-purple-900/70',  border: 'border-purple-400/50', lethal: null },
];

export default function CounterMenu({ activeIds, onAdd }) {
  const [open, setOpen] = useState(false);
  const available = ALL_COUNTERS.filter(c => !activeIds.includes(c.id));

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white/60 text-sm font-medium active:bg-white/20 transition-colors"
      >
        <Plus className="w-4 h-4" />
        Add Counter
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 z-40 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 400, damping: 35 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-[#100e16] border-t border-white/10 rounded-t-3xl p-5"
              style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-bold text-lg">Add Counter</h3>
                <button onClick={() => setOpen(false)} className="p-2 rounded-full bg-white/10">
                  <X className="w-5 h-5 text-white/70" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2 max-h-80 overflow-y-auto">
                {available.map(counter => (
                  <button
                    key={counter.id}
                    onClick={() => { onAdd(counter); setOpen(false); }}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border ${counter.bg} ${counter.border} active:scale-95 transition-transform`}
                  >
                    <span className="text-2xl">{counter.icon}</span>
                    <span className="text-white/80 text-xs font-medium">{counter.label}</span>
                  </button>
                ))}
                {available.length === 0 && (
                  <p className="col-span-3 text-center text-white/40 py-8">All counters added!</p>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}