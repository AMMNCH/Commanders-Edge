import React, { useState, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Minus, Plus, Link, BookOpen, Skull, RotateCcw } from 'lucide-react';
import { BattlefieldPanel, GraveyardPanel } from './ZonePanel';

const PHASES = [
  { id: 'untap', label: 'Untap' },
  { id: 'upkeep', label: 'Upkeep' },
  { id: 'draw', label: 'Draw' },
  { id: 'main1', label: 'Main 1' },
  { id: 'combat', label: 'Combat' },
  { id: 'main2', label: 'Main 2' },
  { id: 'end', label: 'End' },
];

export default function PlayerZone({
  player,
  isOwner,
  isMyTurn,
  currentPhase,
  accentColor,
  flipped = false,
  onLifeChange,
  onTap,
  onCounter,
  onDraw,
  onMill,
  onSendToGraveyard,
  onMoveToField,
  onToggleExile,
  onPhaseChange,
  onEndTurn,
}) {
  const [lastChange, setLastChange] = useState(null);
  const lastChangeTimer = useRef(null);

  const adjustLife = (delta) => {
    clearTimeout(lastChangeTimer.current);
    setLastChange(prev => (prev || 0) + delta);
    lastChangeTimer.current = setTimeout(() => setLastChange(null), 800);
    onLifeChange && onLifeChange(delta);
  };

  if (!player) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-white/20 text-sm">Waiting for opponent...</p>
      </div>
    );
  }

  const life = player.life ?? 20;
  const isDead = life <= 0;
  const isDanger = life <= 5 && !isDead;
  const gyCards = player.graveyard || [];
  const exileCount = gyCards.filter(c => c.exiled).length;

  return (
    <div className={`flex flex-col h-full min-h-0 ${flipped ? 'flex-col-reverse' : ''}`}>

      {/* ── Stats bar ───────────────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 flex items-center gap-3 px-3 py-2 border-b border-white/10"
        style={{ background: isMyTurn ? accentColor + '18' : 'rgba(0,0,0,0.3)' }}
      >
        {/* Name + deck */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {isMyTurn && <span className="text-yellow-400 text-[10px] font-black">▶</span>}
            <span className="text-white font-bold text-sm truncate">{player.name || (isOwner ? 'You' : 'Opponent')}</span>
          </div>
          {player.deck_name && (
            <div className="text-white/30 text-[10px] truncate flex items-center gap-1">
              <Link className="w-2.5 h-2.5 flex-shrink-0" />{player.deck_name}
            </div>
          )}
        </div>

        {/* Library */}
        <div className="flex items-center gap-1 bg-blue-950/50 border border-blue-700/30 rounded-lg px-2 py-1">
          <BookOpen className="w-3 h-3 text-blue-400" />
          <span className="text-blue-300 font-black text-sm">{player.library_count ?? 99}</span>
        </div>

        {/* Graveyard */}
        <div className="flex items-center gap-1 bg-black/40 border border-white/10 rounded-lg px-2 py-1">
          <Skull className="w-3 h-3 text-gray-400" />
          <span className="text-white/50 font-black text-sm">{gyCards.length - exileCount}</span>
          {exileCount > 0 && <span className="text-orange-400/60 text-[9px] font-bold">+{exileCount}⬡</span>}
        </div>

        {/* Hand count */}
        <div className="text-center">
          <div className="text-white/40 font-bold text-sm">{player.hand_count ?? 7}</div>
          <div className="text-white/20 text-[8px]">HAND</div>
        </div>

        {/* Life counter */}
        <div className="flex items-center gap-1.5">
          {isOwner && (
            <button onPointerDown={() => adjustLife(-1)}
              className="w-9 h-9 rounded-xl bg-black/50 border border-white/15 flex items-center justify-center active:bg-red-600/50 touch-none select-none">
              <Minus className="w-4 h-4 text-white/70" />
            </button>
          )}
          <div className="text-center relative w-14">
            <AnimatePresence>
              {lastChange && (
                <motion.span key={Date.now()} initial={{ opacity: 1, y: 0 }} animate={{ opacity: 0, y: lastChange > 0 ? -20 : 20 }}
                  transition={{ duration: 0.7 }}
                  className={`absolute -top-4 left-0 right-0 text-xs font-black pointer-events-none ${lastChange > 0 ? 'text-green-300' : 'text-red-300'}`}>
                  {lastChange > 0 ? `+${lastChange}` : lastChange}
                </motion.span>
              )}
            </AnimatePresence>
            <div className={`text-3xl font-black tabular-nums leading-none ${isDead ? 'text-gray-500' : isDanger ? 'text-red-300' : 'text-white'}`}>{life}</div>
            <div className="text-white/20 text-[8px]">LIFE</div>
          </div>
          {isOwner && (
            <button onPointerDown={() => adjustLife(1)}
              className="w-9 h-9 rounded-xl bg-black/50 border border-white/15 flex items-center justify-center active:bg-green-600/50 touch-none select-none">
              <Plus className="w-4 h-4 text-white/70" />
            </button>
          )}
        </div>
      </div>

      {/* ── Phase bar (owner only) ───────────────────────────────────────────── */}
      {isOwner && isMyTurn && (
        <div className="flex-shrink-0 flex gap-1 px-3 py-1.5 border-b border-white/10 overflow-x-auto bg-black/20">
          {PHASES.map(ph => (
            <button key={ph.id} onClick={() => onPhaseChange(ph.id)}
              className={`flex-shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${
                currentPhase === ph.id ? 'text-black' : 'bg-white/5 border border-white/10 text-white/30 hover:text-white/60'
              }`}
              style={currentPhase === ph.id ? { background: accentColor } : {}}>
              {ph.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Battlefield (main scrollable area) ──────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        <BattlefieldPanel
          cards={player.battlefield || []}
          isOwner={isOwner}
          onTap={onTap}
          onCounter={onCounter}
          onSendToGraveyard={onSendToGraveyard}
        />

        {/* Draw / Mill row for owner */}
        {isOwner && (
          <div className="flex gap-2">
            <button onClick={onDraw}
              className="flex-1 py-2 rounded-xl bg-blue-500/20 border border-blue-500/30 text-blue-300 text-xs font-bold active:scale-95 transition-transform">
              📥 Draw Card
            </button>
            <button onClick={onMill}
              className="flex-1 py-2 rounded-xl bg-white/5 border border-white/10 text-white/30 text-xs font-bold active:scale-95 transition-transform">
              Mill
            </button>
          </div>
        )}

        <GraveyardPanel
          cards={gyCards}
          isOwner={isOwner}
          onMoveToField={onMoveToField}
          onToggleExile={onToggleExile}
        />
      </div>

      {/* ── End turn button (owner only) ─────────────────────────────────────── */}
      {isOwner && (
        <div className="flex-shrink-0 px-3 py-2 border-t border-white/10 bg-black/30">
          <button
            onClick={onEndTurn}
            disabled={!isMyTurn}
            className={`w-full py-2.5 rounded-xl font-black text-sm transition-all active:scale-95 ${
              isMyTurn ? 'text-black' : 'bg-white/5 border border-white/10 text-white/20 cursor-not-allowed'
            }`}
            style={isMyTurn ? { background: accentColor } : {}}>
            {isMyTurn ? 'End Turn →' : "Opponent's Turn"}
          </button>
        </div>
      )}
    </div>
  );
}