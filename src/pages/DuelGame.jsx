/**
 * DuelGame — Full-screen 1v1 remote duel board
 * Hand zone: cards loaded from Archidekt deck, tap to play to battlefield
 */

import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { db, functions } from '@/api/backend';
import { createPageUrl } from '@/utils';
import {
  Minus, Plus, BookOpen, Skull, RotateCcw, Trash2, ChevronDown,
  MessageSquare, LogOut, Link, X, Hand
} from 'lucide-react';
import VoiceChat from '@/components/duel/VoiceChat';
import DuelChatLog from '@/components/duel/DuelChatLog';

// ─── Constants ────────────────────────────────────────────────────────────────
const ACCENTS = ['#60a5fa', '#f87171'];
const PHASES = ['untap', 'upkeep', 'draw', 'main1', 'combat', 'main2', 'end'];
const COUNTER_TYPES = [
  { id: '+1+1',   label: '+1/+1',  color: '#22c55e' },
  { id: '-1-1',   label: '-1/-1',  color: '#ef4444' },
  { id: 'damage', label: 'Damage', color: '#f97316' },
  { id: 'loyalty',label: 'Loyalty',color: '#a78bfa' },
  { id: 'charge', label: 'Charge', color: '#facc15' },
];

function uid() { return Math.random().toString(36).slice(2, 10); }
function sysMsg(text) {
  return { player_index: -1, player_name: 'System', message: text, timestamp: new Date().toISOString(), type: 'system' };
}
function actMsg(idx, name, text) {
  return { player_index: idx, player_name: name, message: text, timestamp: new Date().toISOString(), type: 'action' };
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── BattlefieldCard ──────────────────────────────────────────────────────────
function BattlefieldCard({ card, onTap, onCounter, onDestroy }) {
  const [menu, setMenu] = useState(false);
  const holdRef = useRef(null);
  const net = (card.counters?.['+1+1'] || 0) - (card.counters?.['-1-1'] || 0);

  return (
    <div className="relative flex-shrink-0">
      <div
        onPointerDown={() => { holdRef.current = setTimeout(() => setMenu(true), 500); }}
        onPointerUp={() => clearTimeout(holdRef.current)}
        onPointerLeave={() => clearTimeout(holdRef.current)}
        onClick={() => !menu && onTap && onTap(card.id)}
        className="select-none cursor-pointer"
        style={{ transform: `rotate(${card.tapped ? 20 : 0}deg)`, transition: 'transform 0.2s', width: 60, height: 84 }}
      >
        {card.image_url
          ? <img src={card.image_url} alt={card.name} className="w-full h-full object-cover rounded-lg shadow-lg pointer-events-none" draggable={false} />
          : (
            <div className="w-full h-full rounded-lg bg-slate-700 border border-white/20 flex items-center justify-center p-1">
              <span className="text-white/60 text-[8px] text-center leading-tight">{card.name}</span>
            </div>
          )
        }
        {net !== 0 && (
          <div className={`absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black border border-black/40 ${net > 0 ? 'bg-green-500' : 'bg-red-500'} text-white`}>
            {net > 0 ? `+${net}` : net}
          </div>
        )}
        {(card.counters?.loyalty > 0) && (
          <div className="absolute -bottom-1.5 -right-1.5 w-5 h-5 rounded-full bg-purple-500 border border-black/40 flex items-center justify-center text-[9px] font-black text-white">
            {card.counters.loyalty}
          </div>
        )}
      </div>

      <AnimatePresence>
        {menu && (
          <>
            <div className="fixed inset-0 z-50" onClick={() => setMenu(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              className="absolute z-50 left-0 top-full mt-1 w-48 rounded-2xl bg-[#100e16] border border-white/20 shadow-2xl p-2 space-y-1"
            >
              <p className="text-white/40 text-[9px] uppercase tracking-widest px-1 pb-1 truncate">{card.name}</p>
              <button onClick={() => { onTap && onTap(card.id); setMenu(false); }}
                className="w-full text-left px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-bold">
                {card.tapped ? '↺ Untap' : '↷ Tap'}
              </button>
              {COUNTER_TYPES.map(ct => (
                <div key={ct.id} className="flex items-center gap-1.5 px-1">
                  <span className="text-[10px] font-bold w-14 flex-shrink-0" style={{ color: ct.color }}>{ct.label}</span>
                  <button onClick={() => onCounter && onCounter(card.id, ct.id, -1)} className="w-6 h-6 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/60 text-xs">−</button>
                  <span className="text-white text-xs font-black w-5 text-center">{card.counters?.[ct.id] || 0}</span>
                  <button onClick={() => onCounter && onCounter(card.id, ct.id, 1)} className="w-6 h-6 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/60 text-xs">+</button>
                </div>
              ))}
              <button onClick={() => { onDestroy && onDestroy(card); setMenu(false); }}
                className="w-full text-left px-3 py-1.5 rounded-xl bg-red-900/30 border border-red-700/30 text-red-300 text-xs font-bold flex items-center gap-1.5 mt-1">
                <Trash2 className="w-3 h-3" /> Destroy
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── HandCard ─────────────────────────────────────────────────────────────────
// Tap to play to battlefield. Hold for a preview/discard option.
function HandCard({ card, onPlay, onDiscard }) {
  const [preview, setPreview] = useState(false);
  const holdRef = useRef(null);

  return (
    <div className="relative flex-shrink-0">
      <motion.div
        onPointerDown={() => { holdRef.current = setTimeout(() => setPreview(true), 500); }}
        onPointerUp={() => clearTimeout(holdRef.current)}
        onPointerLeave={() => clearTimeout(holdRef.current)}
        onClick={() => { clearTimeout(holdRef.current); if (!preview) onPlay(card); }}
        whileTap={{ scale: 0.92, y: -8 }}
        className="relative cursor-pointer select-none"
        style={{ width: 56, height: 78 }}
      >
        {card.image_url
          ? <img src={card.image_url} alt={card.name} className="w-full h-full object-cover rounded-lg shadow-xl border-2 border-white/20 pointer-events-none" draggable={false} />
          : (
            <div className="w-full h-full rounded-lg bg-slate-600 border-2 border-white/30 flex items-center justify-center p-1">
              <span className="text-white/70 text-[8px] text-center leading-tight font-bold">{card.name}</span>
            </div>
          )
        }
        {/* Play hint overlay */}
        <div className="absolute inset-0 rounded-lg bg-green-500/0 hover:bg-green-500/10 transition-colors" />
      </motion.div>

      {/* Hold preview menu */}
      <AnimatePresence>
        {preview && (
          <>
            <div className="fixed inset-0 z-50" onClick={() => setPreview(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: -10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}
              className="absolute z-50 bottom-full mb-2 left-0 w-44 rounded-2xl bg-[#100e16] border border-white/20 shadow-2xl p-2 space-y-1"
            >
              {card.image_url && (
                <img src={card.image_url} alt={card.name} className="w-full rounded-xl mb-2" draggable={false} />
              )}
              <p className="text-white/50 text-[9px] uppercase tracking-widest px-1 truncate">{card.name}</p>
              <button onClick={() => { onPlay(card); setPreview(false); }}
                className="w-full px-3 py-2 rounded-xl bg-green-600/30 border border-green-500/40 text-green-300 text-xs font-bold">
                ▶ Play to Battlefield
              </button>
              <button onClick={() => { onDiscard(card); setPreview(false); }}
                className="w-full px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-white/30 text-xs font-bold">
                🗑 Discard
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── GraveyardDrawer ──────────────────────────────────────────────────────────
function GraveyardDrawer({ cards, isOwner, onReturnToField, onToggleExile }) {
  const [open, setOpen] = useState(false);
  const real = cards.filter(c => !c.exiled);
  const exiled = cards.filter(c => c.exiled);

  return (
    <div className="rounded-xl bg-black/20 border border-white/10 overflow-hidden">
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center justify-between px-3 py-2 active:bg-white/5">
        <div className="flex items-center gap-2">
          <Skull className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-white/50 text-xs font-bold">
            Graveyard · {real.length}
            {exiled.length > 0 ? ` · ${exiled.length} exiled` : ''}
          </span>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-white/30 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden border-t border-white/10">
            <div className="p-2 space-y-1 max-h-48 overflow-y-auto">
              {cards.length === 0 && <p className="text-white/20 text-xs text-center py-2">Empty</p>}
              {cards.map(card => (
                <div key={card.id} className={`flex items-center gap-2 px-2 py-1.5 rounded-xl border ${card.exiled ? 'border-orange-700/20 bg-orange-900/10 opacity-60' : 'border-white/10 bg-white/5'}`}>
                  {card.image_url && <img src={card.image_url} alt={card.name} className="w-6 h-9 object-cover rounded flex-shrink-0" draggable={false} />}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold truncate text-white/70">{card.name}</div>
                    {card.exiled && <div className="text-[9px] text-orange-400/70 font-bold">EXILED</div>}
                  </div>
                  {isOwner && (
                    <div className="flex flex-col gap-0.5 flex-shrink-0">
                      {!card.exiled && (
                        <button onClick={() => onReturnToField(card)} className="px-1.5 py-0.5 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-300 text-[9px] font-bold">↑ Field</button>
                      )}
                      <button onClick={() => onToggleExile(card.id)} className="px-1.5 py-0.5 rounded-lg bg-white/5 border border-white/10 text-white/30 text-[9px] font-bold">
                        {card.exiled ? '↩ Return' : '⬡ Exile'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── PlayerHalf ───────────────────────────────────────────────────────────────
function PlayerHalf({
  player, isOwner, isMyTurn, currentPhase, accentColor,
  onLifeChange, onTap, onCounter, onDestroy, onDraw, onMill,
  onPlayFromHand, onDiscardFromHand,
  onReturnToField, onToggleExile, onPhaseChange, onEndTurn,
  deckLoading,
}) {
  const [lifeDelta, setLifeDelta] = useState(null);
  const lifeDeltaTimer = useRef(null);

  const bumpLife = (d) => {
    clearTimeout(lifeDeltaTimer.current);
    setLifeDelta(prev => (prev || 0) + d);
    lifeDeltaTimer.current = setTimeout(() => setLifeDelta(null), 800);
    onLifeChange && onLifeChange(d);
  };

  if (!player) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-2 p-6">
        <div className="text-white/20 text-4xl">👤</div>
        <p className="text-white/30 text-sm font-bold">Waiting for opponent</p>
        <p className="text-white/15 text-xs">Share the game code</p>
      </div>
    );
  }

  const life = player.life ?? 20;
  const isDead = life <= 0;
  const isDanger = life <= 5 && !isDead;
  const bf = player.battlefield || [];
  const gy = player.graveyard || [];
  const hand = player.hand || [];
  const hasTapped = bf.some(c => c.tapped);

  return (
    <div className="flex flex-col h-full">

      {/* Stats Header */}
      <div className="flex-shrink-0 flex items-center gap-2 px-3 py-2 border-b border-white/10"
        style={{ background: isMyTurn ? accentColor + '20' : 'rgba(0,0,0,0.4)' }}>

        {/* Name / deck */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {isMyTurn && <span className="text-yellow-400 text-[10px] font-black animate-pulse">▶</span>}
            <span className="text-white font-bold text-sm truncate">{player.name || (isOwner ? 'You' : 'Opponent')}</span>
          </div>
          {player.deck_name && (
            <div className="text-white/25 text-[10px] truncate flex items-center gap-1">
              <Link className="w-2.5 h-2.5 flex-shrink-0" />{player.deck_name}
            </div>
          )}
        </div>

        {/* Library */}
        <div className="flex items-center gap-1 bg-blue-950/50 border border-blue-700/30 rounded-lg px-2 py-1">
          <BookOpen className="w-3 h-3 text-blue-400" />
          <span className="text-blue-300 font-black text-sm tabular-nums">{player.library_count ?? 99}</span>
        </div>

        {/* Graveyard */}
        <div className="flex items-center gap-1 bg-black/40 border border-white/10 rounded-lg px-2 py-1">
          <Skull className="w-3 h-3 text-gray-400" />
          <span className="text-white/50 font-black text-sm tabular-nums">{gy.filter(c => !c.exiled).length}</span>
        </div>

        {/* Life */}
        <div className="flex items-center gap-1.5">
          {isOwner && (
            <button onPointerDown={() => bumpLife(-1)} className="w-10 h-10 rounded-xl bg-black/50 border border-white/15 flex items-center justify-center active:bg-red-600/50 select-none touch-none">
              <Minus className="w-4 h-4 text-white/80" />
            </button>
          )}
          <div className="relative text-center w-14">
            <AnimatePresence>
              {lifeDelta !== null && (
                <motion.span key={Date.now()} initial={{ opacity: 1, y: 0 }} animate={{ opacity: 0, y: lifeDelta > 0 ? -20 : 20 }}
                  transition={{ duration: 0.7 }}
                  className={`absolute -top-4 left-0 right-0 text-xs font-black pointer-events-none ${lifeDelta > 0 ? 'text-green-300' : 'text-red-300'}`}>
                  {lifeDelta > 0 ? `+${lifeDelta}` : lifeDelta}
                </motion.span>
              )}
            </AnimatePresence>
            <div className={`text-3xl font-black tabular-nums leading-none ${isDead ? 'text-gray-500' : isDanger ? 'text-red-300' : 'text-white'}`}>{life}</div>
            <div className="text-white/20 text-[8px]">LIFE</div>
          </div>
          {isOwner && (
            <button onPointerDown={() => bumpLife(1)} className="w-10 h-10 rounded-xl bg-black/50 border border-white/15 flex items-center justify-center active:bg-green-600/50 select-none touch-none">
              <Plus className="w-4 h-4 text-white/80" />
            </button>
          )}
        </div>
      </div>

      {/* Phase bar — owner only */}
      {isOwner && (
        <div className="flex-shrink-0 flex gap-1 px-3 py-1.5 border-b border-white/10 overflow-x-auto bg-black/20">
          {PHASES.map(ph => (
            <button key={ph} onClick={() => onPhaseChange && onPhaseChange(ph)}
              className={`flex-shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${currentPhase === ph ? 'text-black' : 'bg-white/5 border border-white/10 text-white/30'}`}
              style={currentPhase === ph ? { background: accentColor } : {}}>
              {ph === 'main1' ? 'Main 1' : ph === 'main2' ? 'Main 2' : ph.charAt(0).toUpperCase() + ph.slice(1)}
            </button>
          ))}
        </div>
      )}

      {/* ── HAND ZONE ─────────────────────────────────────────────────────────── */}
      {isOwner && (
        <div className="flex-shrink-0 border-b border-white/10 bg-black/30">
          {/* Hand header */}
          <div className="flex items-center justify-between px-3 pt-2 pb-1">
            <div className="flex items-center gap-2">
              <Hand className="w-3.5 h-3.5 text-white/40" />
              <span className="text-white/40 text-xs font-bold">Hand · {hand.length}</span>
              {deckLoading && <span className="text-amber-400/60 text-[10px]">loading deck…</span>}
            </div>
            <div className="flex gap-1.5">
              <button onClick={onDraw}
                className="px-2.5 py-1 rounded-lg bg-blue-500/20 border border-blue-500/30 text-blue-300 text-[10px] font-bold active:scale-95 transition-transform">
                📥 Draw
              </button>
              <button onClick={onMill}
                className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-white/30 text-[10px] font-bold active:scale-95 transition-transform">
                Mill
              </button>
            </div>
          </div>

          {/* Card fan */}
          <div className="flex gap-2 px-3 pb-3 overflow-x-auto" style={{ minHeight: 96 }}>
            {hand.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-white/15 text-xs italic">— empty hand · tap Draw to add cards —</p>
              </div>
            ) : hand.map(card => (
              <HandCard
                key={card.id}
                card={card}
                onPlay={onPlayFromHand}
                onDiscard={onDiscardFromHand}
              />
            ))}
          </div>

          {hand.length > 0 && (
            <p className="text-white/15 text-[9px] text-center pb-1.5">Tap card to play · Hold for options</p>
          )}
        </div>
      )}

      {/* Scrollable content (battlefield + graveyard) */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">

        {/* Battlefield */}
        <div className="flex items-center justify-between">
          <span className="text-white/30 text-xs font-bold">Battlefield · {bf.length}</span>
          {isOwner && hasTapped && (
            <button onClick={() => onTap && onTap('ALL')} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-300 text-[10px] font-bold active:scale-95">
              <RotateCcw className="w-2.5 h-2.5" /> Untap All
            </button>
          )}
        </div>

        <div className="min-h-[80px] p-2 rounded-xl bg-black/20 border border-white/8 flex flex-wrap gap-3">
          {bf.length === 0
            ? <p className="w-full text-center text-white/10 text-xs self-center">— empty —</p>
            : bf.map(card => (
              <BattlefieldCard
                key={card.id}
                card={card}
                onTap={isOwner ? onTap : undefined}
                onCounter={isOwner ? onCounter : undefined}
                onDestroy={isOwner ? onDestroy : undefined}
              />
            ))
          }
        </div>

        {/* Graveyard */}
        <GraveyardDrawer
          cards={gy}
          isOwner={isOwner}
          onReturnToField={onReturnToField}
          onToggleExile={onToggleExile}
        />
      </div>

      {/* End Turn */}
      {isOwner && (
        <div className="flex-shrink-0 px-3 py-2 bg-black/30 border-t border-white/10">
          <button onClick={onEndTurn}
            className={`w-full py-3 rounded-xl font-black text-sm transition-all active:scale-95 ${isMyTurn ? 'text-black shadow-lg' : 'bg-white/5 border border-white/10 text-white/20'}`}
            style={isMyTurn ? { background: accentColor } : {}}>
            {isMyTurn ? 'End Turn →' : "Opponent's Turn…"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main DuelGame ────────────────────────────────────────────────────────────
export default function DuelGame() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const myIdx = parseInt(params.get('playerIndex') || '0');
  const oppIdx = 1 - myIdx;

  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [unreadChat, setUnreadChat] = useState(0);
  const [deckLoading, setDeckLoading] = useState(false);

  // Local deck (shuffled library cards — not synced, each player manages their own)
  const [deckCards, setDeckCards] = useState([]);

  const gameIdRef = useRef(null);
  const prevChatLen = useRef(0);
  const deckLoadedRef = useRef(false);

  // Life debounce
  const lifeBaseRef = useRef(null);
  const lifePendingRef = useRef(0);
  const lifeTimerRef = useRef(null);
  const [displayLife, setDisplayLife] = useState(null);

  // ── Load game ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!code) { setLoading(false); return; }
    db.DuelGame.filter({ code }).then(results => {
      if (results?.length > 0) {
        const g = results[0];
        setGame(g);
        gameIdRef.current = g.id;
        lifeBaseRef.current = g.players?.[myIdx]?.life ?? 20;
        prevChatLen.current = g.chat_log?.length || 0;
      }
      setLoading(false);
    });
  }, [code]);

  // ── Load Archidekt deck once game is ready ───────────────────────────────────
  useEffect(() => {
    if (!game || deckLoadedRef.current) return;
    const deckUrl = game.players?.[myIdx]?.deck_url;
    if (!deckUrl) return;
    deckLoadedRef.current = true;
    setDeckLoading(true);

    functions.invoke('fetchArchidektDeck', { deck_url: deckUrl }).then(res => {
      // The function returns { deck: { cards } }; drop tokens from the library.
      const raw = (res?.data?.deck?.cards || res?.data?.cards || []).filter(c => !c.is_token);
      // Expand by quantity and shuffle
      const expanded = [];
      raw.forEach(card => {
        for (let q = 0; q < (card.quantity || 1); q++) {
          expanded.push({ id: uid(), name: card.name, image_url: card.image_url || '' });
        }
      });
      const shuffled = shuffle(expanded);
      setDeckCards(shuffled);
      setDeckLoading(false);

      // If hand is empty, auto-deal 7
      setGame(prevGame => {
        if (!prevGame) return prevGame;
        const existingHand = prevGame.players?.[myIdx]?.hand || [];
        if (existingHand.length > 0) return prevGame;
        const hand = shuffled.slice(0, 7);
        const remaining = shuffled.slice(7);
        setDeckCards(remaining);
        const players = prevGame.players.map((p, i) =>
          i === myIdx ? { ...p, hand, hand_count: hand.length, library_count: (p.library_count ?? 99) - hand.length } : p
        );
        const newGame = { ...prevGame, players };
        db.DuelGame.update(gameIdRef.current, newGame);
        return newGame;
      });
    }).catch(() => setDeckLoading(false));
  }, [game?.id]);

  // ── Real-time subscription ───────────────────────────────────────────────────
  useEffect(() => {
    return db.DuelGame.subscribe(event => {
      if (event.type !== 'update' && event.type !== 'create') return;
      if (gameIdRef.current && event.id !== gameIdRef.current) return;
      if (!gameIdRef.current) gameIdRef.current = event.id;

      setGame(event.data);
      if (lifePendingRef.current === 0) {
        lifeBaseRef.current = event.data?.players?.[myIdx]?.life ?? 20;
        setDisplayLife(null);
      }
      const newLen = event.data?.chat_log?.length || 0;
      if (!showChat && newLen > prevChatLen.current) setUnreadChat(u => u + (newLen - prevChatLen.current));
      prevChatLen.current = newLen;
    });
  }, [myIdx, showChat]);

  // ── Save helper ──────────────────────────────────────────────────────────────
  const save = (newGame) => {
    if (!gameIdRef.current) return;
    setGame(newGame);
    db.DuelGame.update(gameIdRef.current, newGame);
  };

  const addLog = (g, entry) => ({ ...g, chat_log: [...(g.chat_log || []), entry] });

  // ── Life ─────────────────────────────────────────────────────────────────────
  const handleLifeChange = (delta) => {
    lifePendingRef.current += delta;
    setDisplayLife(prev => {
      const base = prev !== null ? prev : (lifeBaseRef.current ?? game?.players?.[myIdx]?.life ?? 20);
      return base + delta;
    });
    clearTimeout(lifeTimerRef.current);
    lifeTimerRef.current = setTimeout(() => {
      const d = lifePendingRef.current;
      lifePendingRef.current = 0;
      if (!d || !game) { setDisplayLife(null); return; }
      const newLife = (lifeBaseRef.current ?? game.players[myIdx].life ?? 20) + d;
      lifeBaseRef.current = newLife;
      const players = game.players.map((p, i) => i === myIdx ? { ...p, life: newLife } : p);
      save(addLog({ ...game, players }, actMsg(myIdx, game.players[myIdx]?.name, `${d > 0 ? 'gained' : 'lost'} ${Math.abs(d)} life (now ${newLife})`)));
      setDisplayLife(null);
    }, 600);
  };

  // ── Tap ──────────────────────────────────────────────────────────────────────
  const handleTap = (cardId) => {
    if (!game) return;
    const p = game.players[myIdx];
    let newBf, logEntry;
    if (cardId === 'ALL') {
      newBf = (p.battlefield || []).map(c => ({ ...c, tapped: false }));
      logEntry = actMsg(myIdx, p.name, 'untapped all');
    } else {
      const card = (p.battlefield || []).find(c => c.id === cardId);
      newBf = (p.battlefield || []).map(c => c.id === cardId ? { ...c, tapped: !c.tapped } : c);
      logEntry = actMsg(myIdx, p.name, `${card?.tapped ? 'untapped' : 'tapped'} ${card?.name || 'a card'}`);
    }
    const players = game.players.map((pl, i) => i === myIdx ? { ...pl, battlefield: newBf } : pl);
    save(addLog({ ...game, players }, logEntry));
  };

  // ── Counter ───────────────────────────────────────────────────────────────────
  const handleCounter = (cardId, counterType, delta) => {
    if (!game) return;
    const newBf = (game.players[myIdx].battlefield || []).map(c => {
      if (c.id !== cardId) return c;
      const counters = { ...(c.counters || {}) };
      counters[counterType] = Math.max(0, (counters[counterType] || 0) + delta);
      return { ...c, counters };
    });
    const players = game.players.map((p, i) => i === myIdx ? { ...p, battlefield: newBf } : p);
    save({ ...game, players });
  };

  // ── Destroy ───────────────────────────────────────────────────────────────────
  const handleDestroy = (card) => {
    if (!game) return;
    const p = game.players[myIdx];
    const newBf = (p.battlefield || []).filter(c => c.id !== card.id);
    const newGy = [...(p.graveyard || []), { id: card.id, name: card.name, image_url: card.image_url }];
    const players = game.players.map((pl, i) => i === myIdx ? { ...pl, battlefield: newBf, graveyard: newGy } : pl);
    save(addLog({ ...game, players }, actMsg(myIdx, p.name, `sent ${card.name} to graveyard`)));
  };

  // ── Draw ──────────────────────────────────────────────────────────────────────
  const handleDraw = () => {
    if (!game) return;
    const p = game.players[myIdx];
    if ((p.library_count ?? 99) <= 0) return;

    let drawnCard;
    if (deckCards.length > 0) {
      drawnCard = deckCards[0];
      setDeckCards(prev => prev.slice(1));
    } else {
      drawnCard = { id: uid(), name: '(card)', image_url: '' };
    }

    const players = game.players.map((pl, i) => i === myIdx
      ? { ...pl, library_count: (pl.library_count ?? 99) - 1, hand: [...(pl.hand || []), drawnCard], hand_count: (pl.hand || []).length + 1 }
      : pl);
    save(addLog({ ...game, players }, actMsg(myIdx, p.name, `drew ${drawnCard.name !== '(card)' ? drawnCard.name : 'a card'}`)));
  };

  // ── Mill ──────────────────────────────────────────────────────────────────────
  const handleMill = () => {
    if (!game) return;
    const p = game.players[myIdx];
    if ((p.library_count ?? 99) <= 0) return;

    let milledCard = { id: uid(), name: '(milled)', image_url: '' };
    if (deckCards.length > 0) {
      milledCard = { ...deckCards[0], id: uid() };
      setDeckCards(prev => prev.slice(1));
    }

    const players = game.players.map((pl, i) => i === myIdx
      ? { ...pl, library_count: (pl.library_count ?? 99) - 1, graveyard: [...(pl.graveyard || []), milledCard] }
      : pl);
    save(addLog({ ...game, players }, actMsg(myIdx, p.name, `milled ${milledCard.name !== '(milled)' ? milledCard.name : 'a card'}`)));
  };

  // ── Play from hand ────────────────────────────────────────────────────────────
  const handlePlayFromHand = (card) => {
    if (!game) return;
    const p = game.players[myIdx];
    const newHand = (p.hand || []).filter(c => c.id !== card.id);
    const newBf = [...(p.battlefield || []), { ...card, tapped: false, counters: {} }];
    const players = game.players.map((pl, i) => i === myIdx ? { ...pl, hand: newHand, hand_count: newHand.length, battlefield: newBf } : pl);
    save(addLog({ ...game, players }, actMsg(myIdx, p.name, `played ${card.name} to battlefield`)));
  };

  // ── Discard from hand ─────────────────────────────────────────────────────────
  const handleDiscardFromHand = (card) => {
    if (!game) return;
    const p = game.players[myIdx];
    const newHand = (p.hand || []).filter(c => c.id !== card.id);
    const newGy = [...(p.graveyard || []), { id: card.id, name: card.name, image_url: card.image_url }];
    const players = game.players.map((pl, i) => i === myIdx ? { ...pl, hand: newHand, hand_count: newHand.length, graveyard: newGy } : pl);
    save(addLog({ ...game, players }, actMsg(myIdx, p.name, `discarded ${card.name}`)));
  };

  // ── Return to field ───────────────────────────────────────────────────────────
  const handleReturnToField = (card) => {
    if (!game) return;
    const p = game.players[myIdx];
    const newGy = (p.graveyard || []).filter(c => c.id !== card.id);
    const newBf = [...(p.battlefield || []), { ...card, tapped: false, exiled: undefined, counters: {} }];
    const players = game.players.map((pl, i) => i === myIdx ? { ...pl, graveyard: newGy, battlefield: newBf } : pl);
    save(addLog({ ...game, players }, actMsg(myIdx, p.name, `returned ${card.name} to battlefield`)));
  };

  // ── Exile toggle ──────────────────────────────────────────────────────────────
  const handleToggleExile = (cardId) => {
    if (!game) return;
    const p = game.players[myIdx];
    const card = (p.graveyard || []).find(c => c.id === cardId);
    const newGy = (p.graveyard || []).map(c => c.id === cardId ? { ...c, exiled: !c.exiled } : c);
    const players = game.players.map((pl, i) => i === myIdx ? { ...pl, graveyard: newGy } : pl);
    save(addLog({ ...game, players }, actMsg(myIdx, p.name, `${card?.exiled ? 'un-exiled' : 'exiled'} ${card?.name || 'a card'}`)));
  };

  // ── Phase / Turn ──────────────────────────────────────────────────────────────
  const handlePhaseChange = (phase) => {
    if (!game) return;
    save({ ...game, phase });
  };

  const handleEndTurn = () => {
    if (!game) return;
    const next = 1 - game.current_turn;
    const players = game.players.map((p, i) =>
      i === myIdx ? { ...p, battlefield: (p.battlefield || []).map(c => ({ ...c, tapped: false })) } : p
    );
    const newTurn = (game.turn_number || 1) + 1;
    save(addLog({ ...game, players, current_turn: next, turn_number: newTurn, phase: 'untap', turn_started_at: new Date().toISOString() },
      sysMsg(`Turn ${newTurn}: ${game.players[next]?.name || `Player ${next + 1}`}'s turn`)));
  };

  const handleSendChat = (message) => {
    if (!game) return;
    const entry = { player_index: myIdx, player_name: game.players[myIdx]?.name || `Player ${myIdx + 1}`, message, timestamp: new Date().toISOString(), type: 'chat' };
    save(addLog(game, entry));
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="fixed inset-0 bg-obsidian flex items-center justify-center">
      <div className="text-white/30 text-sm">Loading duel…</div>
    </div>
  );

  if (!game) return (
    <div className="fixed inset-0 bg-obsidian flex flex-col items-center justify-center gap-4">
      <div className="text-white/60 font-bold">Game not found</div>
      <button onClick={() => window.location.href = createPageUrl('DuelLobby')}
        className="px-4 py-2 rounded-xl bg-amber-500/30 border border-amber-500/50 text-amber-300 font-bold text-sm">
        Back to Lobby
      </button>
    </div>
  );

  const isMyTurn = game.current_turn === myIdx;
  const myPlayer = game.players?.[myIdx];
  const oppPlayer = game.players?.[oppIdx];
  const myPlayerDisplay = myPlayer
    ? { ...myPlayer, life: displayLife !== null ? displayLife : myPlayer.life }
    : null;

  return (
    <div className="fixed inset-0 bg-obsidian flex flex-col overflow-hidden">

      {/* Top bar */}
      <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 bg-black/70 border-b border-white/10 z-20">
        <div className="flex items-center gap-2">
          <span className="text-lg">⚔️</span>
          <div>
            <span className="text-white/25 text-xs">{game.code} · Turn {game.turn_number}</span>
            <div className={`text-xs font-bold ${isMyTurn ? 'text-blue-300' : 'text-red-300'}`}>
              {isMyTurn ? '▶ Your Turn' : `▶ ${oppPlayer?.name || 'Opponent'}'s Turn`}
              {' · '}{game.phase || 'main1'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {game.voice_channel_id && myPlayer && (
            <VoiceChat channelId={game.voice_channel_id} playerIndex={myIdx} playerName={myPlayer.name || `P${myIdx + 1}`} />
          )}
          <button onClick={() => { setShowChat(v => !v); setUnreadChat(0); }}
            className="relative w-9 h-9 rounded-xl bg-white/8 border border-white/10 flex items-center justify-center text-white/40">
            <MessageSquare className="w-4 h-4" />
            {unreadChat > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center">{unreadChat}</span>
            )}
          </button>
          <button onClick={() => window.location.href = createPageUrl('DuelLobby')}
            className="w-9 h-9 rounded-xl bg-white/8 border border-white/10 flex items-center justify-center text-white/30">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Waiting banner */}
      {game.status === 'waiting' && (
        <div className="flex-shrink-0 bg-amber-500/15 border-b border-amber-500/30 px-4 py-1 text-center">
          <p className="text-amber-300 text-xs font-bold">⏳ Waiting for opponent · Code: <span className="font-black text-amber-200 tracking-widest">{game.code}</span></p>
        </div>
      )}

      {/* Split table */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">

        {/* Opponent — top / left, read-only */}
        <div className="flex-1 min-h-0 border-b lg:border-b-0 lg:border-r overflow-hidden"
          style={{ borderColor: ACCENTS[oppIdx] + '40', background: `linear-gradient(to bottom, ${ACCENTS[oppIdx]}08, transparent)` }}>
          <PlayerHalf
            player={oppPlayer}
            isOwner={false}
            isMyTurn={game.current_turn === oppIdx}
            accentColor={ACCENTS[oppIdx]}
          />
        </div>

        {/* Divider */}
        <div className="flex-shrink-0 flex items-center justify-center bg-black/60 px-2 py-1 lg:py-0 lg:flex-col">
          <span className="text-white/10 text-xs font-black lg:rotate-90">VS</span>
        </div>

        {/* My half — bottom / right, interactive */}
        <div className="flex-1 min-h-0 overflow-hidden"
          style={{ background: `linear-gradient(to top, ${ACCENTS[myIdx]}08, transparent)` }}>
          <PlayerHalf
            player={myPlayerDisplay}
            isOwner={true}
            isMyTurn={isMyTurn}
            currentPhase={game.phase}
            accentColor={ACCENTS[myIdx]}
            deckLoading={deckLoading}
            onLifeChange={handleLifeChange}
            onTap={handleTap}
            onCounter={handleCounter}
            onDestroy={handleDestroy}
            onDraw={handleDraw}
            onMill={handleMill}
            onPlayFromHand={handlePlayFromHand}
            onDiscardFromHand={handleDiscardFromHand}
            onReturnToField={handleReturnToField}
            onToggleExile={handleToggleExile}
            onPhaseChange={handlePhaseChange}
            onEndTurn={handleEndTurn}
          />
        </div>
      </div>

      {/* Chat drawer */}
      <AnimatePresence>
        {showChat && (
          <>
            <motion.div className="fixed inset-0 z-40 bg-black/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowChat(false)} />
            <motion.div
              className="fixed bottom-0 left-0 right-0 z-50 h-[65vh] bg-[#100e16] border-t border-white/15 rounded-t-3xl flex flex-col overflow-hidden"
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 320 }}>
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                <span className="text-white font-bold text-sm">Game Log & Chat</span>
                <button onClick={() => setShowChat(false)} className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
                  <X className="w-4 h-4 text-white/60" />
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <DuelChatLog
                  chatLog={game.chat_log || []}
                  playerIndex={myIdx}
                  playerName={myPlayer?.name || `Player ${myIdx + 1}`}
                  onSend={handleSendChat}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}