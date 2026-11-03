import React, { useState, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, BookOpen, Skull, Plus, Minus, RotateCcw, Trash2 } from 'lucide-react';

// ── Counter types (mirrors Horde) ─────────────────────────────────────────────
const COUNTER_TYPES = [
  { id: '+1+1',   label: '+1/+1',  color: '#22c55e' },
  { id: '-1-1',   label: '-1/-1',  color: '#ef4444' },
  { id: 'damage', label: 'Dmg',    color: '#f97316' },
  { id: 'loyalty',label: 'Loyal',  color: '#a78bfa' },
  { id: 'charge', label: 'Charge', color: '#facc15' },
];

// ── Single battlefield card ───────────────────────────────────────────────────
function BattlefieldCard({ card, isOwner, onTap, onCounter, onSendToGraveyard }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const holdRef = React.useRef(null);

  const handlePointerDown = () => {
    if (!isOwner) return;
    holdRef.current = setTimeout(() => setMenuOpen(true), 500);
  };
  const handlePointerUp = () => clearTimeout(holdRef.current);

  const net = (card.counters?.['+1+1'] || 0) - (card.counters?.['-1-1'] || 0);

  return (
    <div className="relative flex-shrink-0">
      <div
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onClick={() => isOwner && onTap && onTap(card.id)}
        className="relative cursor-pointer select-none"
        style={{
          transform: `rotate(${card.tapped ? 20 : 0}deg)`,
          transition: 'transform 0.2s',
          width: 56,
          height: 78,
        }}
      >
        {card.image_url ? (
          <img src={card.image_url} alt={card.name}
            className="w-full h-full object-cover rounded-lg shadow-lg pointer-events-none"
            draggable={false} />
        ) : (
          <div className="w-full h-full rounded-lg bg-slate-700 border border-white/20 flex items-center justify-center p-1">
            <span className="text-white/60 text-[8px] text-center leading-tight">{card.name}</span>
          </div>
        )}
        {/* Counter badge */}
        {net !== 0 && (
          <div className={`absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black border border-black/40
            ${net > 0 ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
            {net > 0 ? `+${net}` : net}
          </div>
        )}
        {card.counters?.loyalty > 0 && (
          <div className="absolute -bottom-1.5 -right-1.5 w-5 h-5 rounded-full bg-purple-500 border border-black/40 flex items-center justify-center text-[9px] font-black text-white">
            {card.counters.loyalty}
          </div>
        )}
      </div>

      {/* Context menu */}
      <AnimatePresence>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-50" onClick={() => setMenuOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="absolute z-50 left-0 top-full mt-1 w-44 rounded-2xl bg-slate-900 border border-white/20 shadow-2xl overflow-hidden p-2 space-y-1"
            >
              <p className="text-white/50 text-[9px] uppercase tracking-widest px-1 pb-1">{card.name}</p>

              {/* Tap/Untap */}
              <button onClick={() => { onTap(card.id); setMenuOpen(false); }}
                className="w-full text-left px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-bold">
                {card.tapped ? '↺ Untap' : '↷ Tap'}
              </button>

              {/* Counters */}
              {COUNTER_TYPES.map(ct => (
                <div key={ct.id} className="flex items-center gap-1 px-1">
                  <span className="text-[10px] font-bold w-12 flex-shrink-0" style={{ color: ct.color }}>{ct.label}</span>
                  <button onClick={() => onCounter(card.id, ct.id, -1)}
                    className="w-6 h-6 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:bg-white/15 text-xs">−</button>
                  <span className="text-white text-xs font-black w-5 text-center">{card.counters?.[ct.id] || 0}</span>
                  <button onClick={() => onCounter(card.id, ct.id, 1)}
                    className="w-6 h-6 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:bg-white/15 text-xs">+</button>
                </div>
              ))}

              {/* Send to graveyard */}
              <button onClick={() => { onSendToGraveyard(card); setMenuOpen(false); }}
                className="w-full text-left px-3 py-1.5 rounded-xl bg-red-900/30 hover:bg-red-900/60 border border-red-700/30 text-red-300 text-xs font-bold flex items-center gap-1.5 mt-1">
                <Trash2 className="w-3 h-3" /> Destroy
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Battlefield Panel ─────────────────────────────────────────────────────────
export function BattlefieldPanel({ cards, isOwner, onTap, onCounter, onSendToGraveyard }) {
  const [scale, setScale] = useState(1);

  return (
    <div className="rounded-xl bg-black/20 border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/10">
        <span className="text-white/50 text-xs font-bold">Battlefield · {cards.length}</span>
        {isOwner && (
          <div className="flex items-center gap-1">
            {cards.some(c => c.tapped) && (
              <button onClick={() => onTap('ALL')}
                className="px-2 py-0.5 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-300 text-[10px] font-bold flex items-center gap-1">
                <RotateCcw className="w-2.5 h-2.5" /> Untap All
              </button>
            )}
            <button onClick={() => setScale(s => Math.max(0.6, s - 0.2))}
              className="w-5 h-5 rounded bg-white/5 border border-white/10 text-white/40 flex items-center justify-center text-xs">−</button>
            <button onClick={() => setScale(s => Math.min(2.5, s + 0.2))}
              className="w-5 h-5 rounded bg-white/5 border border-white/10 text-white/40 flex items-center justify-center text-xs">+</button>
          </div>
        )}
      </div>

      {/* Cards */}
      <div className="p-2 flex flex-wrap gap-2 min-h-[60px]">
        {cards.length === 0 ? (
          <div className="w-full text-center text-white/15 text-xs py-3">Empty</div>
        ) : cards.map(card => (
          <div key={card.id} style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>
            <BattlefieldCard
              card={card}
              isOwner={isOwner}
              onTap={onTap}
              onCounter={onCounter}
              onSendToGraveyard={onSendToGraveyard}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Graveyard Panel (exile integrated) ───────────────────────────────────────
export function GraveyardPanel({ cards, isOwner, onMoveToField, onToggleExile }) {
  const [open, setOpen] = useState(false);
  const [previewExiled, setPreviewExiled] = useState(null); // id of exiled card being previewed

  const gyCards = cards.filter(c => !c.exiled);
  const exiledCards = cards.filter(c => c.exiled);

  return (
    <div className="rounded-xl bg-black/20 border border-white/10 overflow-hidden">
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2 active:bg-white/5">
        <div className="flex items-center gap-2">
          <Skull className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-white/50 text-xs font-bold">
            Graveyard · {gyCards.length}
            {exiledCards.length > 0 && (
              <span className="ml-1.5 text-white/25">({exiledCards.length} exiled)</span>
            )}
          </span>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-white/30 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-white/10">
            <div className="p-2 space-y-1 max-h-56 overflow-y-auto">
              {cards.length === 0 && (
                <div className="text-white/20 text-xs text-center py-3">Empty</div>
              )}
              {cards.map(card => {
                const isExiled = !!card.exiled;
                const isPreviewing = previewExiled === card.id;
                return (
                  <div key={card.id}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-xl ${isExiled ? 'bg-white/3 border border-white/5' : 'bg-white/5 border border-white/10'}`}
                    style={{ opacity: isExiled && !isPreviewing ? 0.45 : 1 }}>
                    {/* Thumbnail */}
                    {card.image_url && (
                      <img src={card.image_url} alt={card.name}
                        className={`w-7 h-10 object-cover rounded flex-shrink-0 ${isExiled && !isPreviewing ? 'grayscale' : ''}`}
                        draggable={false} />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className={`text-xs font-bold truncate ${isExiled ? 'text-white/30' : 'text-white/70'}`}>{card.name}</div>
                      {isExiled && <div className="text-[9px] text-orange-400/60 font-bold uppercase tracking-widest">Exiled</div>}
                    </div>
                    {/* Owner controls */}
                    {isOwner && (
                      <div className="flex flex-col gap-0.5 flex-shrink-0">
                        {!isExiled && (
                          <button onClick={() => onMoveToField(card, 'graveyard')}
                            className="px-1.5 py-0.5 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-300 text-[9px] font-bold">
                            ↑ Field
                          </button>
                        )}
                        {isExiled ? (
                          <button onClick={() => setPreviewExiled(isPreviewing ? null : card.id)}
                            className="px-1.5 py-0.5 rounded-lg bg-orange-500/15 border border-orange-500/30 text-orange-300 text-[9px] font-bold">
                            {isPreviewing ? 'Hide' : 'View'}
                          </button>
                        ) : (
                          <button onClick={() => onToggleExile(card.id)}
                            className="px-1.5 py-0.5 rounded-lg bg-white/5 border border-white/10 text-white/30 text-[9px] font-bold">
                            ⬡ Exile
                          </button>
                        )}
                        {isExiled && (
                          <button onClick={() => onToggleExile(card.id)}
                            className="px-1.5 py-0.5 rounded-lg bg-white/5 border border-white/10 text-white/30 text-[9px] font-bold">
                            ↩ Return
                          </button>
                        )}
                      </div>
                    )}
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

// ── Library Widget ────────────────────────────────────────────────────────────
export function LibraryWidget({ count, isOwner, onDraw, onMill }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-950/40 border border-blue-700/30">
      <BookOpen className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
      <div className="flex-1">
        <span className="text-blue-300 font-black text-sm">{count}</span>
        <span className="text-white/25 text-[9px] ml-1">Library</span>
      </div>
      {isOwner && (
        <div className="flex gap-1">
          <button onClick={onDraw}
            className="px-2 py-0.5 rounded-lg bg-blue-500/20 border border-blue-500/30 text-blue-300 text-[10px] font-bold active:scale-95">
            Draw
          </button>
          <button onClick={onMill}
            className="px-2 py-0.5 rounded-lg bg-white/5 border border-white/10 text-white/30 text-[10px] font-bold active:scale-95">
            Mill
          </button>
        </div>
      )}
    </div>
  );
}