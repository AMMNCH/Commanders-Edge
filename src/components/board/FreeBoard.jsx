/**
 * FreeBoard: a free-form tabletop (the Horde board's interaction model).
 * Drag cards anywhere, pinch to resize, double-tap to tap/untap, hold for a
 * menu. Positions are stored on each card (x, y, scale) so other players see
 * the same layout. `readOnly` boards (an opponent's) only allow viewing.
 */
import React, { useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Minus, Plus, RotateCcw } from 'lucide-react';
import CardImage from '@/components/mtg/CardImage';
import CardZoom from '@/components/mtg/CardZoom';

export const BOARD_COUNTERS = [
  { id: '+1+1', label: '+1/+1', color: '#22c55e' },
  { id: '-1-1', label: '−1/−1', color: '#ef4444' },
  { id: 'damage', label: 'Damage', color: '#f97316' },
  { id: 'loyalty', label: 'Loyalty', color: '#a78bfa' },
  { id: 'charge', label: 'Charge', color: '#facc15' },
];

const CARD_W = 96;
const CARD_H = Math.round(CARD_W * 88 / 63);
const GAP = 12;

/** Where a card without a saved position goes: a tidy grid, left to right. */
function autoPos(index, width) {
  const cols = Math.max(1, Math.floor((width - GAP) / (CARD_W + GAP)));
  return { x: GAP + (index % cols) * (CARD_W + GAP), y: GAP + Math.floor(index / cols) * (CARD_H + GAP) };
}

function stats(card) {
  if (card.power == null || card.toughness == null) return null;
  const net = (card.counters?.['+1+1'] || 0) - (card.counters?.['-1-1'] || 0);
  const p = parseInt(card.power, 10);
  const t = parseInt(card.toughness, 10);
  if (Number.isNaN(p) || Number.isNaN(t)) return `${card.power}/${card.toughness}`;
  return `${p + net}/${t + net}`;
}

function CardMenu({ card, pos, accent, onClose, onCounter, actions }) {
  const width = 190;
  let left = Math.min(Math.max(8, pos.x - width / 2), window.innerWidth - width - 8);
  let top = pos.y;
  const estHeight = 120 + BOARD_COUNTERS.length * 34 + actions.length * 38;
  if (top + estHeight > window.innerHeight - 8) top = Math.max(8, window.innerHeight - estHeight - 8);
  return createPortal(
    <>
      <div className="fixed inset-0 z-[9998]" onPointerDown={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: -6 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.14 }}
        className="fixed z-[9999] rounded-2xl bg-[#100e16] border border-white/20 shadow-2xl p-3"
        style={{ left, top, width }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="pb-2 mb-2 border-b border-white/10">
          <p className="text-white text-xs font-bold truncate">{card.name}</p>
          {stats(card) && <p className="text-sm font-black" style={{ color: accent }}>{stats(card)}</p>}
        </div>
        {onCounter && (
          <div className="space-y-1.5">
            {BOARD_COUNTERS.map((ct) => (
              <div key={ct.id} className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold flex-1" style={{ color: ct.color }}>{ct.label}</span>
                <button onClick={() => onCounter(card.id, ct.id, -1)} aria-label={`Remove ${ct.label}`}
                  className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/70 active:bg-white/20"><Minus className="w-3.5 h-3.5" /></button>
                <span className="w-6 text-center text-white text-sm font-black tabular-nums">{card.counters?.[ct.id] || 0}</span>
                <button onClick={() => onCounter(card.id, ct.id, 1)} aria-label={`Add ${ct.label}`}
                  className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/70 active:bg-white/20"><Plus className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
        )}
        <div className="mt-2.5 space-y-1.5">
          {actions.map((a) => (
            <button key={a.label} onClick={() => { a.onClick(card); onClose(); }}
              className={`w-full py-2 rounded-xl text-xs font-bold border ${a.danger ? 'bg-red-900/40 border-red-600/40 text-red-200' : 'bg-white/5 border-white/10 text-white/85'}`}>
              {a.label}
            </button>
          ))}
        </div>
        <button onClick={onClose} className="w-full mt-1.5 py-1 text-[10px] text-white/35">Close</button>
      </motion.div>
    </>,
    document.body
  );
}

function BoardCard({ card, index, boardWidth, readOnly, accent, onTap, onMove, onMenu }) {
  const ref = useRef(null);
  const start = card.x != null ? { x: card.x, y: card.y } : autoPos(index, boardWidth);
  // Your own cards keep their live position locally while you drag; an
  // opponent's cards always follow the synced position.
  const posRef = useRef(start);
  const scaleRef = useRef(card.scale || 1);
  const [, force] = useState(0);
  const drag = useRef(null);
  const moved = useRef(false);
  const pinch = useRef(null);
  const holdTimer = useRef(null);
  const held = useRef(false);
  const lastTap = useRef(0);
  const persist = useRef(null);

  const pos = readOnly ? start : posRef.current;
  const scale = readOnly ? (card.scale || 1) : scaleRef.current;

  const save = () => {
    clearTimeout(persist.current);
    persist.current = setTimeout(() => onMove?.(card.id, Math.round(posRef.current.x), Math.round(posRef.current.y), +scaleRef.current.toFixed(2)), 400);
  };

  const openMenu = () => {
    const r = ref.current?.getBoundingClientRect();
    if (r) onMenu(card, { x: r.left + r.width / 2, y: r.bottom + 8 });
  };

  const onPointerDown = (e) => {
    if (pinch.current) return;
    e.stopPropagation();
    moved.current = false;
    held.current = false;
    drag.current = { x: e.clientX - posRef.current.x, y: e.clientY - posRef.current.y };
    if (!readOnly) e.currentTarget.setPointerCapture?.(e.pointerId);
    holdTimer.current = setTimeout(() => { if (!moved.current) { held.current = true; drag.current = null; openMenu(); } }, 450);
  };
  const onPointerMove = (e) => {
    if (!drag.current || pinch.current || readOnly) return;
    const nx = e.clientX - drag.current.x;
    const ny = e.clientY - drag.current.y;
    if (Math.abs(nx - posRef.current.x) > 3 || Math.abs(ny - posRef.current.y) > 3) {
      moved.current = true;
      clearTimeout(holdTimer.current);
    }
    posRef.current = { x: Math.max(-CARD_W / 2, nx), y: Math.max(-20, ny) };
    force((n) => n + 1);
  };
  const onPointerUp = () => {
    clearTimeout(holdTimer.current);
    const wasDrag = drag.current;
    drag.current = null;
    if (held.current) return;
    if (moved.current) { save(); return; }
    if (!wasDrag) return;
    if (readOnly) { openMenu(); return; }
    const now = Date.now();
    if (now - lastTap.current < 320) { lastTap.current = 0; onTap?.(card.id); } else lastTap.current = now;
  };

  const touchDist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  const onTouchStart = (e) => {
    if (readOnly || e.touches.length !== 2) return;
    clearTimeout(holdTimer.current);
    drag.current = null;
    pinch.current = touchDist(e.touches);
  };
  const onTouchMove = (e) => {
    if (!pinch.current || e.touches.length !== 2) return;
    const d = touchDist(e.touches);
    scaleRef.current = Math.min(2.5, Math.max(0.5, scaleRef.current * (d / pinch.current)));
    pinch.current = d;
    force((n) => n + 1);
  };
  const onTouchEnd = (e) => {
    if (pinch.current && e.touches.length < 2) { pinch.current = null; save(); }
  };

  const counters = Object.entries(card.counters || {}).filter(([, v]) => v > 0);
  const st = stats(card);

  return (
    <div
      ref={ref}
      role="button"
      aria-label={`${card.name}${card.tapped ? ', tapped' : ''}`}
      className="absolute select-none"
      style={{
        left: pos.x, top: pos.y, width: CARD_W,
        transform: `scale(${scale}) rotate(${card.tapped ? 20 : 0}deg)`,
        transformOrigin: 'top left',
        transition: drag.current || pinch.current ? 'none' : 'transform .18s',
        touchAction: 'none',
        zIndex: drag.current ? 30 : 10,
        cursor: readOnly ? 'pointer' : 'grab',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => { clearTimeout(holdTimer.current); drag.current = null; }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className={`relative rounded-[7px] border-2 shadow-2xl ${card.tapped ? 'opacity-75' : ''}`}
        style={{ borderColor: card.tapped ? 'rgba(255,255,255,0.2)' : `${accent}cc` }}>
        <CardImage card={card} className="w-full rounded-[5px] pointer-events-none" style={{ aspectRatio: '63/88' }} />
        {(st || card.tapped) && (
          <div className="absolute bottom-0 inset-x-0 bg-black/75 rounded-b-[5px] px-1.5 py-0.5 flex items-center justify-between">
            <span className="text-[9px] font-bold text-white/60">{card.tapped ? 'TAPPED' : ''}</span>
            {st && <span className="text-[11px] font-black" style={{ color: accent }}>{st}</span>}
          </div>
        )}
        {counters.map(([k, v], i) => {
          const ct = BOARD_COUNTERS.find((c) => c.id === k);
          return (
            <span key={k} className="absolute -right-2 w-6 h-6 rounded-full text-[10px] font-black flex items-center justify-center border border-black/40 shadow text-white"
              style={{ top: 4 + i * 26, background: ct?.color || '#888' }}>{v}</span>
          );
        })}
      </div>
    </div>
  );
}

export default function FreeBoard({
  cards, readOnly = false, accent = '#d4a64a', title = 'Battlefield',
  onTap, onCounter, onMove, onUntapAll, actions = [], emptyText,
}) {
  const boardRef = useRef(null);
  const [menu, setMenu] = useState(null); // { id, pos }
  const [zoom, setZoom] = useState(null);
  const width = boardRef.current?.clientWidth || 360;
  const menuCard = menu ? cards.find((c) => c.id === menu.id) : null;
  // An opponent's card just opens full screen; your own opens the action menu.
  const openMenu = useCallback((card, pos) => (readOnly ? setZoom(card) : setMenu({ id: card.id, pos })), [readOnly]);

  const menuActions = [
    { label: '🔍 View full screen', onClick: (c) => setZoom(c) },
    { label: menuCard?.tapped ? '↺ Untap' : '↷ Tap', onClick: (c) => onTap?.(c.id) },
    ...actions,
  ];

  return (
    <div className="relative rounded-2xl overflow-hidden border border-white/10 h-full min-h-[240px]"
      style={{ background: `linear-gradient(180deg, rgba(5,4,8,0.9), ${accent}14)` }}>
      <div className="absolute inset-0 opacity-[0.05] pointer-events-none"
        style={{ backgroundImage: 'repeating-linear-gradient(0deg,#fff 0,#fff 1px,transparent 1px,transparent 40px),repeating-linear-gradient(90deg,#fff 0,#fff 1px,transparent 1px,transparent 40px)' }} />
      <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between px-3 py-1.5 bg-black/55 backdrop-blur-sm border-b border-white/10">
        <span className="text-xs font-bold" style={{ color: accent }}>{title} · {cards.length}</span>
        <div className="flex items-center gap-2">
          <span className="text-white/30 text-[9px]">{readOnly ? 'tap a card to view' : 'drag · 2× tap · hold · pinch'}</span>
          {!readOnly && cards.some((c) => c.tapped) && (
            <button onClick={onUntapAll} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-sky-500/20 border border-sky-400/40 text-sky-200 text-[10px] font-bold">
              <RotateCcw className="w-2.5 h-2.5" /> Untap all
            </button>
          )}
        </div>
      </div>
      <div ref={boardRef} className="absolute inset-0 top-8 overflow-hidden" style={{ touchAction: readOnly ? 'pan-y' : 'none' }}
        onPointerDown={() => setMenu(null)}>
        {cards.length === 0 && (
          <p className="absolute inset-0 flex items-center justify-center text-white/20 text-xs px-6 text-center">{emptyText || 'No cards on the battlefield'}</p>
        )}
        {cards.map((c, i) => (
          <BoardCard key={c.id} card={c} index={i} boardWidth={width} readOnly={readOnly} accent={accent}
            onTap={onTap} onMove={onMove} onMenu={openMenu} />
        ))}
      </div>
      {menuCard && (
        <CardMenu card={menuCard} pos={menu.pos} accent={accent} onClose={() => setMenu(null)}
          onCounter={readOnly ? null : onCounter} actions={menuActions} />
      )}
      <AnimatePresence>
        {zoom && <CardZoom cards={[zoom]} onClose={() => setZoom(null)} />}
      </AnimatePresence>
    </div>
  );
}
