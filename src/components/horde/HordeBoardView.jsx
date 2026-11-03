import React, { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Minus, RotateCcw } from 'lucide-react';

const COUNTER_TYPES = [
  { id: '+1+1', label: '+1/+1', color: '#22c55e' },
  { id: '-1-1', label: '-1/-1', color: '#ef4444' },
  { id: 'damage', label: 'Dmg', color: '#f97316' },
];

// Portal menu — rendered at document root, unaffected by parent transforms
function CounterMenu({ creature, menuPos, onClose, onCounter, onRemove }) {
  const netP1P1 = (creature.counters?.['+1+1'] || 0) - (creature.counters?.['-1-1'] || 0);
  const effectivePower = (creature.power || 0) + netP1P1;
  const effectiveToughness = (creature.toughness || 0) + netP1P1;

  // Clamp to viewport
  const menuWidth = 170;
  const menuHeight = 200;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let left = menuPos.x;
  let top = menuPos.y;
  if (left + menuWidth > vw - 8) left = vw - menuWidth - 8;
  if (left < 8) left = 8;
  if (top + menuHeight > vh - 8) top = menuPos.y - menuHeight - 8;
  if (top < 8) top = 8;

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="counter-menu"
        initial={{ opacity: 0, scale: 0.88, y: -6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.88, y: -6 }}
        transition={{ duration: 0.15 }}
        className="fixed bg-[#100e16] border border-white/25 rounded-2xl p-3 shadow-2xl"
        style={{ left, top, width: menuWidth, zIndex: 99999 }}
        onClick={e => e.stopPropagation()}
        onPointerDown={e => e.stopPropagation()}
      >
        {/* Creature name + stats header */}
        <div className="mb-2 pb-2 border-b border-white/10">
          <p className="text-white/80 text-xs font-bold truncate">{creature.name}</p>
          <p className="text-red-300 text-sm font-black">{effectivePower}/{effectiveToughness}</p>
        </div>

        {/* Counter rows */}
        <div className="space-y-2">
          {COUNTER_TYPES.map(ct => (
            <div key={ct.id} className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold flex-1" style={{ color: ct.color }}>{ct.label}</span>
              <button
                onPointerDown={e => { e.stopPropagation(); onCounter(creature.id, ct.id, -1); }}
                className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/5 border border-white/10 text-white/60 active:bg-white/20"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="text-white text-sm font-black w-6 text-center">
                {creature.counters?.[ct.id] || 0}
              </span>
              <button
                onPointerDown={e => { e.stopPropagation(); onCounter(creature.id, ct.id, 1); }}
                className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/5 border border-white/10 text-white/60 active:bg-white/20"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        <button
          onPointerDown={e => { e.stopPropagation(); onRemove(creature.id); onClose(); }}
          className="w-full mt-2.5 flex items-center justify-center gap-2 px-2 py-2 rounded-xl bg-red-900/40 border border-red-600/40 text-red-300 text-xs font-bold active:bg-red-900/60"
        >
          <X className="w-3.5 h-3.5" /> Destroy
        </button>

        <button
          onPointerDown={e => { e.stopPropagation(); onClose(); }}
          className="w-full mt-1.5 text-white/30 text-[10px] py-1 active:text-white/60"
        >
          Close
        </button>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}

function CreatureCard({ creature, onRemove, onTap, onCounter, onPersistPosition, onMenuOpen }) {
  const cardRef = useRef(null);

  // Local uncontrolled position/scale — never reset from props after mount
  const posRef = useRef({ x: creature.x || 0, y: creature.y || 0 });
  const scaleRef = useRef(creature.scale || 1);
  const [renderKey, setRenderKey] = useState(0);

  const isDragging = useRef(false);
  const dragStart = useRef(null);
  const hasMoved = useRef(false);
  const isPinching = useRef(false);
  const lastPinchDist = useRef(null);
  const persistTimer = useRef(null);

  // Long-press detection
  const longPressTimer = useRef(null);
  const longPressTriggered = useRef(false);

  // Double-tap detection
  const lastTapTime = useRef(0);

  const netP1P1 = (creature.counters?.['+1+1'] || 0) - (creature.counters?.['-1-1'] || 0);
  const effectivePower = (creature.power || 0) + netP1P1;
  const effectiveToughness = (creature.toughness || 0) + netP1P1;

  const schedulePersist = useCallback(() => {
    clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      onPersistPosition(creature.id, posRef.current.x, posRef.current.y, scaleRef.current);
    }, 600);
  }, [creature.id, onPersistPosition]);

  // ── Pinch-to-zoom ──
  const handleTouchStart = useCallback((e) => {
    if (e.touches.length === 2) {
      isPinching.current = true;
      isDragging.current = false;
      clearTimeout(longPressTimer.current);
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastPinchDist.current = Math.sqrt(dx * dx + dy * dy);
      e.preventDefault();
    }
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (e.touches.length === 2 && isPinching.current && lastPinchDist.current !== null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const delta = dist / lastPinchDist.current;
      scaleRef.current = Math.min(3, Math.max(0.4, scaleRef.current * delta));
      lastPinchDist.current = dist;
      setRenderKey(k => k + 1);
      e.preventDefault();
    }
  }, []);

  const handleTouchEnd = useCallback((e) => {
    if (e.touches.length < 2) {
      isPinching.current = false;
      lastPinchDist.current = null;
      schedulePersist();
    }
  }, [schedulePersist]);

  // ── Pointer: drag + long-press ──
  const handlePointerDown = useCallback((e) => {
    if (isPinching.current) return;
    isDragging.current = true;
    hasMoved.current = false;
    longPressTriggered.current = false;
    dragStart.current = {
      x: e.clientX - posRef.current.x,
      y: e.clientY - posRef.current.y,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.stopPropagation();

    // Start long-press timer (500ms)
    longPressTimer.current = setTimeout(() => {
      if (!hasMoved.current) {
        longPressTriggered.current = true;
        isDragging.current = false;
        // Get position of card for menu anchor
        if (cardRef.current) {
          const rect = cardRef.current.getBoundingClientRect();
          onMenuOpen(creature.id, { x: rect.left + rect.width / 2 - 85, y: rect.bottom + 8 });
        }
      }
    }, 500);
  }, [creature.id, onMenuOpen]);

  const handlePointerMove = useCallback((e) => {
    if (!isDragging.current || isPinching.current) return;
    const dx = e.clientX - dragStart.current.x - posRef.current.x;
    const dy = e.clientY - dragStart.current.y - posRef.current.y;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      hasMoved.current = true;
      clearTimeout(longPressTimer.current);
    }
    posRef.current = {
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y,
    };
    setRenderKey(k => k + 1);
  }, []);

  const handlePointerUp = useCallback((e) => {
    clearTimeout(longPressTimer.current);
    if (!isDragging.current) return;
    isDragging.current = false;

    if (!longPressTriggered.current && !hasMoved.current) {
      // Double-tap → tap/untap
      const now = Date.now();
      if (now - lastTapTime.current < 350) {
        lastTapTime.current = 0;
        onTap(creature.id);
      } else {
        lastTapTime.current = now;
      }
    }

    schedulePersist();
  }, [creature.id, onTap, schedulePersist]);

  return (
    <div
      ref={cardRef}
      style={{
        position: 'absolute',
        left: 50 + posRef.current.x,
        top: 50 + posRef.current.y,
        transform: `scale(${scaleRef.current}) rotate(${creature.tapped ? 20 : 0}deg)`,
        transformOrigin: 'top left',
        zIndex: 10,
        touchAction: 'none',
        willChange: 'transform',
      }}
      className="cursor-grab active:cursor-grabbing"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className={`relative rounded-xl overflow-visible border-2 shadow-2xl select-none ${
          creature.tapped ? 'border-white/20 opacity-70' : 'border-red-600/80'
        }`}
        style={{ width: 130 }}
      >
        {creature.image_url ? (
          <img
            src={creature.image_url}
            alt={creature.name}
            className="w-full rounded-xl pointer-events-none"
            draggable={false}
          />
        ) : (
          <div className="w-full h-40 bg-red-900/60 flex flex-col items-center justify-center gap-1 rounded-xl p-2">
            <span className="text-white/70 text-xs text-center leading-tight font-semibold">{creature.name}</span>
            <span className="text-red-300 text-xl font-black">{effectivePower}/{effectiveToughness}</span>
          </div>
        )}

        {creature.image_url && (
          <div className="absolute bottom-0 left-0 right-0 bg-black/70 rounded-b-xl py-1 px-2 flex items-center justify-between">
            <span className="text-white text-[10px] font-bold truncate" style={{ maxWidth: 70 }}>{creature.name}</span>
            <span className="text-red-300 text-xs font-black ml-1">{effectivePower}/{effectiveToughness}</span>
          </div>
        )}

        {creature.tapped && (
          <div className="absolute top-1 left-1 bg-black/70 rounded-md px-1 py-0.5 text-[8px] text-white/50 font-bold">TAP</div>
        )}

        {/* Counter badges — fixed size, not affected by card scale visually but positioned on card */}
        {Object.entries(creature.counters || {}).filter(([k, v]) => v > 0 && k !== 'damage').map(([k, v], idx) => {
          const ct = COUNTER_TYPES.find(c => c.id === k);
          return (
            <div key={k}
              className="absolute rounded-full w-5 h-5 flex items-center justify-center text-[9px] font-black border border-black/30 shadow"
              style={{ background: ct?.color || '#888', color: '#fff', top: 4 + idx * 22, right: 4 }}>
              {v}
            </div>
          );
        })}

        {(creature.counters?.damage || 0) > 0 && (
          <div className="absolute rounded-full w-5 h-5 flex items-center justify-center text-[9px] font-black border border-black/30 shadow bg-orange-500 text-white"
            style={{ top: 4 + Object.entries(creature.counters || {}).filter(([k, v]) => v > 0 && k !== 'damage').length * 22, right: 4 }}>
            {creature.counters.damage}
          </div>
        )}
      </div>
    </div>
  );
}

export default function HordeBoardView({ creatures, onUpdate }) {
  const boardRef = useRef(null);
  // Menu state lives at parent level so it's outside all scaled elements
  const [activeMenu, setActiveMenu] = useState(null); // { id, pos }

  const openMenu = useCallback((id, pos) => {
    setActiveMenu({ id, pos });
  }, []);

  const closeMenu = useCallback(() => {
    setActiveMenu(null);
  }, []);

  const activeCreature = activeMenu ? creatures.find(c => c.id === activeMenu.id) : null;

  const removeCreature = useCallback((id) => {
    onUpdate(prev => (prev || []).filter(c => c.id !== id));
  }, [onUpdate]);

  const tapCreature = useCallback((id) => {
    onUpdate(prev => (prev || []).map(c => c.id === id ? { ...c, tapped: !c.tapped } : c));
  }, [onUpdate]);

  const addCounter = useCallback((id, counterType, delta) => {
    onUpdate(prev => (prev || []).map(c => {
      if (c.id !== id) return c;
      const counters = { ...(c.counters || {}) };
      counters[counterType] = Math.max(0, (counters[counterType] || 0) + delta);
      return { ...c, counters };
    }));
  }, [onUpdate]);

  const persistPosition = useCallback((id, x, y, scale) => {
    onUpdate(prev => (prev || []).map(c => c.id === id ? { ...c, x, y, scale } : c));
  }, [onUpdate]);

  const untapAll = useCallback(() => {
    onUpdate(prev => (prev || []).map(c => ({ ...c, tapped: false })));
  }, [onUpdate]);

  return (
    <div className="w-full h-full bg-gradient-to-b from-slate-950 to-red-950/30 relative overflow-hidden"
      onPointerDown={() => closeMenu()}
    >
      <div className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg,#fff 0,#fff 1px,transparent 1px,transparent 40px),repeating-linear-gradient(90deg,#fff 0,#fff 1px,transparent 1px,transparent 40px)',
        }} />

      <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-3 py-1.5 bg-black/50 backdrop-blur-sm border-b border-white/10">
        <span className="text-red-300 font-bold text-xs">🗡 {creatures.length} creatures</span>
        <div className="flex items-center gap-2">
          <span className="text-white/20 text-[9px]">hold · 2×tap · pinch · drag</span>
          {creatures.some(c => c.tapped) && (
            <button onClick={untapAll}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-500/20 border border-blue-500/40 text-blue-300 text-[10px] font-bold active:scale-95">
              <RotateCcw className="w-2.5 h-2.5" /> Untap All
            </button>
          )}
        </div>
      </div>

      <div ref={boardRef} className="absolute inset-0 pt-8" style={{ touchAction: 'none' }}>
        {creatures.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-white/20 text-sm">No creatures on the board</p>
          </div>
        ) : (
          creatures.map((c) => (
            <CreatureCard
              key={c.id}
              creature={{ ...c, counters: c.counters || {} }}
              onRemove={removeCreature}
              onTap={tapCreature}
              onCounter={addCounter}
              onPersistPosition={persistPosition}
              onMenuOpen={openMenu}
            />
          ))
        )}
      </div>

      {/* Portal menu — rendered at document.body, outside all transforms */}
      {activeCreature && (
        <CounterMenu
          creature={{ ...activeCreature, counters: activeCreature.counters || {} }}
          menuPos={activeMenu.pos}
          onClose={closeMenu}
          onCounter={addCounter}
          onRemove={removeCreature}
        />
      )}
    </div>
  );
}