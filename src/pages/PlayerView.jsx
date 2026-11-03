import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db, patchDoc } from '@/api/backend';
import { Minus, Plus, Bell, Leaf, ChevronDown, ArrowRight, MoreHorizontal, Users, Repeat, SkipForward, LogOut, Trophy, SlidersHorizontal, BarChart2, Search, Skull, Swords, Droplet, Pencil } from 'lucide-react';
import { createPageUrl } from '@/utils';
import TurnTimer from '@/components/mtg/TurnTimer';
import DiceRoller from '@/components/mtg/DiceRoller';
import { InlineSpinWheel } from '@/components/mtg/LifeWheelPicker';
import { playSound, initAudio } from '@/components/mtg/SoundEffects';
import CardShareModal from '@/components/mtg/CardShareModal';
import CardOverlay from '@/components/mtg/CardOverlay';
import CounterWidget from '@/components/mtg/CounterWidget';
import CounterMenu from '@/components/mtg/CounterMenu';
import { accentOf } from '@/lib/theme';
import { getSettings } from '@/lib/settings';
import HordeHUD from '@/components/horde/HordeHUD';
import HordeBoardPanel from '@/components/horde/HordeBoardPanel';
import { saveRecentGame } from '@/components/lobby/RecentGames';

const PLAYER_COLORS = {
  purple: { bg: 'from-purple-950 to-violet-900', border: 'border-purple-500/60', accent: '#a855f7' },
  blue:   { bg: 'from-blue-950 to-cyan-900',    border: 'border-blue-500/60',   accent: '#3b82f6' },
  red:    { bg: 'from-red-950 to-orange-900',   border: 'border-red-500/60',    accent: '#ef4444' },
  green:  { bg: 'from-green-950 to-emerald-900',border: 'border-green-500/60',  accent: '#22c55e' },
  gold:   { bg: 'from-yellow-950 to-amber-900', border: 'border-yellow-500/60', accent: '#eab308' },
  white:  { bg: 'from-slate-800 to-slate-700',  border: 'border-slate-400/60',  accent: '#94a3b8' },
  teal:   { bg: 'from-teal-950 to-teal-900',    border: 'border-teal-500/60',   accent: '#2dd4bf' },
  pink:   { bg: 'from-pink-950 to-rose-900',    border: 'border-pink-500/60',   accent: '#f472b6' },
};
const COLORS_LIST = ['purple','blue','red','green','gold','white'];

export default function PlayerView() {
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get('sessionId');
  const playerIndex = parseInt(params.get('playerIndex') || '0');
  const playerName = (() => {
    const raw = params.get('playerName') || `Player ${playerIndex + 1}`;
    try { return decodeURIComponent(raw); } catch (_) { return raw; }
  })();
  const joinCode = params.get('code');

  const [session, setSession] = useState(null);
  const [flashing, setFlashing] = useState(false);
  const [showDice, setShowDice] = useState(false);
  const [reminderText, setReminderText] = useState('');
  const [editingReminder, setEditingReminder] = useState(false);
  const [hitFlash, setHitFlash] = useState(false);
  const [lastChange, setLastChange] = useState(null);
  const lastChangeTimer = useRef(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showSeatPicker, setShowSeatPicker] = useState(false);
  const [showCardShare, setShowCardShare] = useState(false);
  const [activeCounters, setActiveCounters] = useState([]);
  const [cardOverlay, setCardOverlay] = useState(null);
  const seenCardTimestampRef = useRef(null);
  const [pirMode, setPirMode] = useState(false);
  const [showWheel, setShowWheel] = useState(false);
  const [playerAcknowledgedTurn, setPlayerAcknowledgedTurn] = useState(null);
  const [showCatchUp, setShowCatchUp] = useState(false);
  const pirStartLife = useRef(null);
  const [localLife, setLocalLife] = useState(null);
  const sessionIdRef = useRef(null);
  const holdTimer = useRef(null);
  const holdInterval = useRef(null);
  const holdStep = useRef(0);
  const pendingDelta = useRef(0);
  const audioCtxRef = useRef(null);

  const [notFound, setNotFound] = useState(false);
  const resolveSession = useCallback(async () => {
    try {
      await resolveSessionInner();
    } catch (e) {
      console.error(e);
    }
    if (!sessionIdRef.current) setNotFound(true);
  }, [sessionId, joinCode]); // eslint-disable-line react-hooks/exhaustive-deps

  const resolveSessionInner = useCallback(async () => {
    if (sessionId === 'NEW' && joinCode) {
      const results = await db.GameSession.filter({ code: joinCode });
      if (results?.length > 0) {
        sessionIdRef.current = results[0].id;
        setSession(results[0]);
      }
    } else if (joinCode) {
      const results = await db.GameSession.filter({ code: joinCode });
      if (results?.length > 0) {
        sessionIdRef.current = results[0].id;
        setSession(results[0]);
      }
    } else if (sessionId) {
      const found = await db.GameSession.get(sessionId).catch(() => null);
      if (found) {
        sessionIdRef.current = found.id;
        setSession(found);
      }
    } else {
      // No params: load the most recent active session for preview/testing
      const s = await db.GameSession.filter({ status: 'active' }, '-created_date', 1);
      if (s?.length > 0) {
        sessionIdRef.current = s[0].id;
        setSession(s[0]);
      } else {
        // Fall back to any session
        const all = await db.GameSession.list('-created_date', 1);
        if (all?.length > 0) {
          sessionIdRef.current = all[0].id;
          setSession(all[0]);
        }
      }
    }
  }, [sessionId, joinCode]);

  useEffect(() => {
    const init = () => {
      initAudio();
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
    };
    document.addEventListener('touchstart', init, { once: true });
    document.addEventListener('click', init, { once: true });
    resolveSession();
  }, []);

  useEffect(() => {
    const unsub = db.GameSession.subscribe((event) => {
      if ((event.type === 'update' || event.type === 'create') &&
          (!sessionIdRef.current || event.id === sessionIdRef.current)) {
        const newSession = event.data;
        setSession(newSession);
        if (!sessionIdRef.current) sessionIdRef.current = event.id;
        // Sync localLife from DB when not holding
        if (pendingDelta.current === 0) setLocalLife(null);

        // Show card overlay if a new card was shared by someone else
        const newCard = newSession?.shared_card;
        if (newCard?.timestamp
          && newCard.shared_by_index !== playerIndex
          && newCard.timestamp !== seenCardTimestampRef.current) {
          seenCardTimestampRef.current = newCard.timestamp;
          setCardOverlay(newCard);
        }
      }
    });
    return () => unsub();
  }, [playerIndex]);

  // Flash + chime when the turn passes to me.
  const prevTurnRef = useRef(null);
  useEffect(() => {
    const cur = session?.current_turn_player;
    if (cur === undefined) return;
    if (prevTurnRef.current !== null && prevTurnRef.current !== cur && cur === playerIndex) {
      setFlashing(true);
      playSound('increment');
      try { navigator.vibrate?.([30, 60, 30]); } catch (_) { /* ignore */ }
      const id = setTimeout(() => setFlashing(false), 2000);
      prevTurnRef.current = cur;
      return () => clearTimeout(id);
    }
    prevTurnRef.current = cur;
    return undefined;
  }, [session?.current_turn_player, playerIndex]);

  const myPlayer = session?.players?.[playerIndex] || null;
  const isMyTurn = session?.current_turn_player === playerIndex;
  const colorKey = myPlayer?.color || COLORS_LIST[playerIndex % COLORS_LIST.length];
  const colors = PLAYER_COLORS[colorKey] || PLAYER_COLORS.purple;
  const baseLife = myPlayer?.life ?? session?.starting_life ?? 40;
  const displayLife = localLife !== null ? localLife : baseLife;
  const isDanger = displayLife <= 10;
  const isDead = displayLife <= 0;

  // Optimistic local update, then apply the same change to the freshest server
  // copy so we never overwrite what other players changed in the meantime.
  const sessionRef = useRef(null);
  sessionRef.current = session;
  const patchSession = async (updater) => {
    if (!sessionIdRef.current || !sessionRef.current) return;
    setSession(updater(JSON.parse(JSON.stringify(sessionRef.current))));
    try {
      const saved = await patchDoc('GameSession', sessionIdRef.current, updater, sessionRef.current);
      if (saved) setSession(saved);
    } catch (e) {
      console.error('Sync failed', e);
    }
  };

  const changeCommanderDamage = (fromIdx, delta) => {
    playSound('commander');
    const affectsLife = getSettings().cmdDamageAffectsLife;
    patchSession(s => {
      const me = s.players[playerIndex];
      const dmg = { ...(me.commander_damage || {}) };
      const cur = dmg[fromIdx] || 0;
      const next = Math.max(0, cur + delta);
      dmg[fromIdx] = next;
      me.commander_damage = dmg;
      if (affectsLife) me.life = (me.life ?? s.starting_life ?? 40) - (next - cur);
      return s;
    });
  };

  const changePoison = (delta) => {
    playSound('poison');
    patchSession(s => {
      const me = s.players[playerIndex];
      me.poison = Math.max(0, (me.poison || 0) + delta);
      return s;
    });
  };

  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const saveName = () => {
    const n = nameDraft.trim().slice(0, 24);
    if (n) patchSession(s => { s.players[playerIndex].name = n; return s; });
    setRenaming(false);
  };

  // --- Life change: local-first, commit on release ---
  const applyLifeDelta = (amount) => {
    playSound(amount > 0 ? 'increment' : 'decrement');
    if (amount < 0) {
      setHitFlash(true);
      setTimeout(() => setHitFlash(false), 180);
    }
    clearTimeout(lastChangeTimer.current);
    setLastChange(prev => (prev || 0) + amount);
    lastChangeTimer.current = setTimeout(() => setLastChange(null), 700);
    pendingDelta.current += amount;
    setLocalLife(prev => {
      const base = prev !== null ? prev : baseLife;
      return base + amount;
    });
  };

  const commitLifeDelta = () => {
    const delta = pendingDelta.current;
    pendingDelta.current = 0;
    if (delta === 0) return;
    patchSession(s => {
      s.players[playerIndex].life = (s.players[playerIndex].life ?? s.starting_life ?? 40) + delta;
      return s;
    });
  };

  const setLifeAbsolute = (newLife) => {
    pendingDelta.current = 0;
    setLocalLife(null);
    patchSession(s => {
      s.players[playerIndex].life = newLife;
      return s;
    });
  };

  // Hold-to-scroll with momentum acceleration
  const startHold = (e, amount) => {
    e.preventDefault();
    cancelAnimationFrame(holdInterval.current);
    clearTimeout(holdTimer.current);
    applyLifeDelta(amount);
    holdStep.current = 0;

    const tick = () => {
      holdStep.current += 1;
      const delay = Math.max(45, 270 - holdStep.current * 11);
      applyLifeDelta(amount);
      holdInterval.current = setTimeout(tick, delay);
    };
    holdTimer.current = setTimeout(tick, 450);
  };

  const stopHold = () => {
    clearTimeout(holdTimer.current);
    clearTimeout(holdInterval.current);
    holdTimer.current = null;
    holdInterval.current = null;
    holdStep.current = 0;
    commitLifeDelta();
  };

  const toggleLand = () => {
    playSound('increment');
    patchSession(s => { s.players[playerIndex].played_land = !s.players[playerIndex].played_land; return s; });
  };

  const passTurn = (force = false) => {
    if (!isMyTurn && !force) return;
    playSound('commander');
    patchSession(s => {
      const myExtras = s.players[s.current_turn_player]?.extra_turns || 0;
      if (myExtras > 0) {
        s.players[s.current_turn_player].extra_turns = myExtras - 1;
        s.turn_started_at = new Date().toISOString();
        s.turn_number = (s.turn_number || 1) + 1;
        return s;
      }
      const next = (s.current_turn_player + 1) % s.player_count;
      s.current_turn_player = next;
      s.turn_started_at = new Date().toISOString();
      s.turn_number = (s.turn_number || 1) + 1;
      if (s.players[next]) s.players[next].played_land = false;
      return s;
    });
  };

  const addExtraTurn = () => {
    playSound('commander');
    patchSession(s => {
      const cur = s.current_turn_player;
      s.players[cur].extra_turns = (s.players[cur].extra_turns || 0) + 1;
      return s;
    });
  };

  const sendCard = (cardData) => {
    patchSession(s => { s.shared_card = cardData; return s; });
  };

  const saveReminder = () => {
    patchSession(s => { s.players[playerIndex].reminder = reminderText; return s; });
    setEditingReminder(false);
  };

  // Save to recent games & initialize acknowledged turn on first session load
  useEffect(() => {
    if (!session) return;
    if (playerAcknowledgedTurn === null) {
      setPlayerAcknowledgedTurn(session.turn_number || 1);
    }
    if (session.code) {
      saveRecentGame({ code: session.code, game_mode: session.game_mode, playerIndex, playerName });
    }
  }, [session?.id]);

  // Detect catch-up needed
  useEffect(() => {
    if (!session || playerAcknowledgedTurn === null) return;
    if ((session.turn_number || 1) > playerAcknowledgedTurn) {
      setShowCatchUp(true);
    }
  }, [session?.turn_number, playerAcknowledgedTurn]);

  const isHordeMode = session?.game_mode === 'horde_commander';

  const updateSharedLife = (newLife) => {
    patchSession(s => { s.shared_life_total = newLife; return s; });
  };

  const danger = myPlayer ? Math.max(0, 1 - (displayLife / (session?.starting_life || 40))) : 0;
  const getDangerBg = () => {
    if (!myPlayer) return 'transparent';
    if (displayLife <= 0) return 'rgba(180,0,0,0.55)';
    if (displayLife <= 5) return `rgba(160,0,0,${0.15 + danger * 0.4})`;
    if (displayLife <= 10) return `rgba(200,50,0,${danger * 0.3})`;
    return 'transparent';
  };

  if (!session) {
    return (
      <div className="min-h-[100dvh] bg-arcane flex flex-col items-center justify-center gap-4 p-6 text-center">
        {!notFound && <div className="w-8 h-8 border-4 border-white/10 border-t-gold rounded-full animate-spin" />}
        <div className="text-white/50">{notFound ? `Couldn't find game ${joinCode || ''}. It may have been created on another device while offline.` : `Connecting to game${joinCode ? ` ${joinCode}` : ''}…`}</div>
        <a href={createPageUrl('Lobby')} className="text-xs text-white/35 underline underline-offset-4">Back to home</a>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gradient-to-br ${colors.bg} relative overflow-hidden`}>
      {/* Danger / hit overlay */}
      <div className="absolute inset-0 pointer-events-none transition-all duration-150 z-10"
        style={{ backgroundColor: hitFlash ? 'rgba(255,0,0,0.32)' : getDangerBg() }} />

      {/* Your-turn flash */}
      <AnimatePresence>
        {flashing && (
          <motion.div
            initial={{ opacity: 0.8 }} animate={{ opacity: [0.8,0,0.8,0,0.8,0] }} exit={{ opacity: 0 }}
            transition={{ duration: 1.5, times: [0,0.2,0.4,0.6,0.8,1] }}
            className="absolute inset-0 z-20 pointer-events-none"
            style={{ backgroundColor: colors.accent, mixBlendMode: 'screen' }}
          />
        )}
      </AnimatePresence>

      {isDanger && !isDead && (
        <div className="absolute inset-0 border-4 border-red-500 animate-pulse pointer-events-none z-10 opacity-60" />
      )}

      <div className="relative z-10 flex flex-col min-h-screen px-4" style={{ paddingTop: 'max(12px, env(safe-area-inset-top))', paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>

        {/* Header */}
        <div className="flex items-center justify-between py-2 mb-2">
          <div>
            <button onClick={() => { setNameDraft(myPlayer?.name || playerName); setRenaming(true); }} className="flex items-center gap-1.5 text-left">
              <h2 className="text-white font-black text-lg leading-none">{myPlayer?.name || playerName}</h2>
              <Pencil className="w-3 h-3 text-white/30" />
            </button>
            <p className="text-white/40 text-xs mt-0.5">Code: {session.code} · Turn {session.turn_number}</p>
          </div>
          <div className="flex items-center gap-2">
            {isHordeMode ? (
              <a
                href={createPageUrl(`HordeCommander?code=${session.code}`)}
                className="flex items-center justify-center gap-1.5 px-3 h-9 rounded-xl bg-red-900/50 border border-red-600/50 text-red-300 text-xs font-bold active:bg-red-900/70"
              >
                <Skull className="w-3.5 h-3.5" />
                Horde Board
              </a>
            ) : (
              <a
                href={createPageUrl(`Scoreboard?code=${session.code}`)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/10 border border-white/15 text-white/50 active:bg-white/20"
              >
                <BarChart2 className="w-4 h-4" />
              </a>
            )}
            <TurnTimer startedAt={session.turn_started_at} isMyTurn={isMyTurn} />
          </div>
        </div>

        {/* Catch-up banner */}
        <AnimatePresence>
          {showCatchUp && (
            <motion.div initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-8 }}
              className="mb-2 px-4 py-2.5 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-between gap-3">
              <div>
                <p className="text-amber-200 text-xs font-bold">Game has advanced</p>
                <p className="text-amber-300/60 text-[10px]">Now on Turn {session.turn_number} · You joined at Turn {playerAcknowledgedTurn}</p>
              </div>
              <button
                onClick={() => { setPlayerAcknowledgedTurn(session.turn_number); setShowCatchUp(false); }}
                className="flex-shrink-0 px-3 py-1.5 rounded-xl bg-amber-500/30 border border-amber-500/50 text-amber-200 text-xs font-black active:scale-95">
                Catch Up
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Turn banner */}
        <AnimatePresence>
          {isMyTurn && (
            <motion.div initial={{ opacity:0,y:-8 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0,y:-8 }}
              className="mb-2 py-2 rounded-xl text-center font-bold text-sm"
              style={{ backgroundColor: colors.accent+'33', color: colors.accent, border: `1px solid ${colors.accent}55` }}>
              ⚡ YOUR TURN
            </motion.div>
          )}
        </AnimatePresence>

        {/* Life Counter Card */}
        <div className={`rounded-2xl bg-black/30 border-2 ${colors.border} mb-3 overflow-hidden`}>
          {/* +/- buttons row */}
          <div className="flex items-center justify-between gap-0 px-3 pt-3 pb-1">
            <button
              onPointerDown={(e) => startHold(e, -1)}
              onPointerUp={stopHold}
              onPointerLeave={stopHold}
              onPointerCancel={stopHold}
              className="w-16 h-16 rounded-2xl bg-black/40 border border-white/15 flex items-center justify-center active:bg-red-600/50 touch-none select-none flex-shrink-0"
              style={{ WebkitUserSelect: 'none' }}
            >
              {isDead ? <span className="text-3xl">💀</span> : <Minus className="w-8 h-8 text-white" />}
            </button>

            {/* Life display */}
            <div className="flex-1 flex flex-col items-center justify-center relative" style={{ minHeight: '80px' }}>
              {/* Floating delta */}
              <AnimatePresence>
                {lastChange && (
                  <motion.span
                    key={Date.now()}
                    initial={{ opacity: 1, y: 0 }}
                    animate={{ opacity: 0, y: lastChange > 0 ? -36 : 36 }}
                    transition={{ duration: 0.7 }}
                    className={`absolute text-xl font-black pointer-events-none z-20 ${lastChange > 0 ? 'text-green-300' : 'text-red-300'}`}
                    style={{ top: lastChange > 0 ? '-1.8rem' : 'auto', bottom: lastChange < 0 ? '-1.8rem' : 'auto' }}
                  >
                    {lastChange > 0 ? `+${lastChange} 😇` : `${lastChange} 💀`}
                  </motion.span>
                )}
              </AnimatePresence>

              {/* Dead state: gravestone on top, number below */}
              {isDead ? (
                <div className="flex flex-col items-center justify-center">
                  <AnimatePresence>
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                      className="pointer-events-none"
                    >
                      <svg width="56" height="60" viewBox="0 0 44 50" fill="none" xmlns="http://www.w3.org/2000/svg">
                        {/* Stone base */}
                        <rect x="4" y="42" width="36" height="6" rx="2" fill="#6b7280" />
                        {/* Stone body */}
                        <path d="M8 42 V18 Q8 6 22 6 Q36 6 36 18 V42 Z" fill="#4b5563" />
                        {/* Inscription plaque */}
                        <rect x="14" y="20" width="16" height="10" rx="2" fill="#374151" opacity="0.6" />
                        <text x="22" y="28" textAnchor="middle" fontSize="6" fill="#9ca3af" fontWeight="bold" fontFamily="serif">RIP</text>
                        {/* Cross */}
                        <rect x="20" y="9" width="4" height="11" rx="1" fill="#9ca3af" />
                        <rect x="15" y="12" width="14" height="4" rx="1" fill="#9ca3af" />
                      </svg>
                    </motion.div>
                  </AnimatePresence>
                  {/* Dirt mound line */}
                  <div className="w-16 h-1 rounded-full bg-gray-600 opacity-60 -mt-1 mb-0.5" />
                  <span className="text-5xl font-black tabular-nums leading-none text-gray-400 opacity-70">
                    {displayLife}
                  </span>
                </div>
              ) : (
                <>
                  <span
                    className={`text-7xl font-black tabular-nums leading-none ${isDanger ? 'text-red-300' : 'text-white'}`}
                    style={pirMode ? { color: colors.accent, textShadow: `0 0 20px ${colors.accent}88` } : {}}
                  >
                    {displayLife}
                  </span>
                  {pirMode && <span className="text-xs mt-1 font-bold tracking-widest" style={{ color: colors.accent }}>🏆 PRICE IS RIGHT</span>}
                </>
              )}
            </div>

            <button
              onPointerDown={(e) => startHold(e, 1)}
              onPointerUp={stopHold}
              onPointerLeave={stopHold}
              onPointerCancel={stopHold}
              className="w-16 h-16 rounded-2xl bg-black/40 border border-white/15 flex items-center justify-center active:bg-green-600/50 touch-none select-none flex-shrink-0"
              style={{ WebkitUserSelect: 'none' }}
            >
              {isDead ? <span className="text-3xl">🪽</span> : <Plus className="w-8 h-8 text-white" />}
            </button>
          </div>

          {/* Wheel toggle row */}
          <div className="px-3 pb-1 flex justify-center">
            <button
              onClick={() => setShowWheel(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all"
              style={showWheel
                ? { background: `${colors.accent}33`, color: colors.accent, border: `1px solid ${colors.accent}55` }
                : { background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.12)' }}
            >
              <SlidersHorizontal className="w-3 h-3" />
              {showWheel ? 'Hide Wheel' : 'Scroll Wheel'}
            </button>
          </div>

          {/* Spin wheel — shown only when toggled */}
          {showWheel && (
            <>
              <div className="px-3 pb-1">
                <InlineSpinWheel
                  value={displayLife}
                  accentColor={colors.accent}
                  audioCtx={audioCtxRef.current}
                  pirMode={pirMode}
                  startLife={pirStartLife.current ?? baseLife}
                  onChange={(v) => {
                    pendingDelta.current = 0;
                    setLocalLife(v);
                  }}
                />
              </div>
              <div className="px-3 pb-3">
                <button
                  onClick={() => { if (localLife !== null) setLifeAbsolute(localLife); }}
                  className="w-full py-2 rounded-xl text-xs font-bold tracking-wide"
                  style={{ background: `${colors.accent}22`, color: colors.accent, border: `1px solid ${colors.accent}44` }}
                >
                  Set Life Total → {displayLife}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Land + Reminder */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <button onClick={toggleLand}
            className={`flex items-center justify-center gap-2 py-3 rounded-xl border font-semibold text-sm active:scale-95 transition-all ${
              myPlayer?.played_land ? 'bg-green-500/30 border-green-500/60 text-green-300' : 'bg-white/10 border-white/20 text-white/50'
            }`}>
            <Leaf className="w-4 h-4" />
            {myPlayer?.played_land ? 'Land ✓' : 'Land?'}
          </button>
          <button onClick={() => { setReminderText(myPlayer?.reminder || ''); setEditingReminder(true); }}
            className="flex items-center justify-center gap-2 py-3 rounded-xl border border-white/20 bg-white/10 text-white/50 text-sm active:scale-95">
            <Bell className="w-4 h-4" />
            {myPlayer?.reminder ? 'Note ✓' : 'Remind'}
          </button>
        </div>

        {/* Active reminder */}
        {myPlayer?.reminder && isMyTurn && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}
            className="mb-3 px-4 py-2.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-200 text-sm">
            🔔 {myPlayer.reminder}
          </motion.div>
        )}

        {/* Commander damage + poison (synced) */}
        <div className="rounded-xl bg-black/20 border border-white/10 p-3 mb-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-white/35 text-xs flex items-center gap-1.5"><Swords className="w-3.5 h-3.5 text-amber-300/70" /> Commander damage taken</p>
            <div className="flex items-center gap-1.5">
              <Droplet className={`w-3.5 h-3.5 ${(myPlayer?.poison || 0) >= 10 ? 'text-red-400' : 'text-lime-300'}`} />
              <button onClick={() => changePoison(-1)} aria-label="Remove poison" className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center"><Minus className="w-3.5 h-3.5 text-white" /></button>
              <span className={`w-6 text-center font-black tabular-nums ${(myPlayer?.poison || 0) >= 10 ? 'text-red-300' : 'text-lime-200'}`}>{myPlayer?.poison || 0}</span>
              <button onClick={() => changePoison(1)} aria-label="Add poison" className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center"><Plus className="w-3.5 h-3.5 text-white" /></button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {session.players?.map((p, i) => {
              if (i === playerIndex) return null;
              const d = myPlayer?.commander_damage?.[i] || 0;
              return (
                <div key={i} className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 border ${d >= 21 ? 'bg-red-900/40 border-red-500/50' : 'bg-white/5 border-white/10'}`}>
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: accentOf(p.color, i) }} />
                  <span className="text-white/70 text-xs flex-1 truncate">{p.name || `P${i + 1}`}</span>
                  <button onClick={() => changeCommanderDamage(i, -1)} aria-label={`Less damage from ${p.name}`} className="w-6 h-6 rounded bg-black/30 flex items-center justify-center"><Minus className="w-3 h-3 text-white" /></button>
                  <span className={`w-5 text-center text-sm font-black tabular-nums ${d >= 21 ? 'text-red-300' : d >= 15 ? 'text-amber-200' : 'text-white'}`}>{d}</span>
                  <button onClick={() => changeCommanderDamage(i, 1)} aria-label={`More damage from ${p.name}`} className="w-6 h-6 rounded bg-black/30 flex items-center justify-center"><Plus className="w-3 h-3 text-white" /></button>
                </div>
              );
            })}
          </div>
        </div>

        {/* All players */}
        <div className="rounded-xl bg-black/20 border border-white/10 p-3 mb-3">
          <p className="text-white/35 text-xs mb-2">All Players</p>
          <div className="grid grid-cols-3 gap-2">
            {session.players?.map((p, i) => (
              <div key={i} className={`text-center p-2 rounded-lg ${i === session.current_turn_player ? 'bg-white/15 ring-1 ring-white/30' : 'bg-white/5'}`}>
                <div className="text-white/50 text-xs truncate">{p.name || `P${i+1}`}</div>
                <div className={`text-xl font-black ${p.life <= 0 ? 'text-gray-500' : p.life <= 10 ? 'text-red-300' : 'text-white'}`}>{p.life}</div>
                {i === session.current_turn_player && <div className="text-xs text-yellow-400">▶</div>}
              </div>
            ))}
          </div>
        </div>

        {/* Pass Turn */}
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => passTurn(false)}
            disabled={!isMyTurn}
            className={`flex-1 py-4 rounded-2xl font-black text-base transition-all active:scale-95 flex items-center justify-center gap-2 ${
              isMyTurn ? 'text-white shadow-lg' : 'bg-white/10 text-white/30 cursor-not-allowed'
            }`}
            style={isMyTurn ? { background: `linear-gradient(135deg, ${colors.accent}cc, ${colors.accent}66)` } : {}}>
            <ArrowRight className="w-5 h-5" />
            {isMyTurn
              ? (myPlayer?.extra_turns > 0 ? `Extra Turn (${myPlayer.extra_turns})` : 'End Turn')
              : `${session.players?.[session.current_turn_player]?.name || `P${session.current_turn_player + 1}`}'s turn`}
          </button>
          <button onClick={() => setShowAdvanced(true)}
            className="w-12 rounded-2xl bg-white/8 border border-white/10 flex items-center justify-center text-white/30 active:bg-white/15">
            <MoreHorizontal className="w-5 h-5" />
          </button>
        </div>

        {/* Horde mode widgets */}
        {isHordeMode && (
          <>
            <HordeHUD session={session} onLifeChange={updateSharedLife} />
            <HordeBoardPanel
              creatures={session.horde_board_state || []}
              onUpdate={(updater) => {
                patchSession(s => {
                  const current = s.horde_board_state || [];
                  s.horde_board_state = typeof updater === 'function' ? updater(current) : updater;
                  return s;
                });
              }}
            />
          </>
        )}

        {/* Counters */}
        {activeCounters.length > 0 && (
          <div className="grid grid-cols-2 gap-2 mb-3">
            {activeCounters.map(counter => (
              <CounterWidget
                key={counter.id}
                counter={counter}
                onRemove={() => setActiveCounters(prev => prev.filter(c => c.id !== counter.id))}
              />
            ))}
          </div>
        )}

        {/* Counter + Card Lookup — same row */}
        <div className="flex gap-2 mb-3">
          <CounterMenu
            activeIds={activeCounters.map(c => c.id)}
            onAdd={(counter) => setActiveCounters(prev => [...prev, counter])}
          />
          <button onClick={() => setShowCardShare(true)}
            className="flex-1 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white/60 text-sm flex items-center justify-center gap-2 active:bg-white/20">
            <Search className="w-4 h-4" />
            Card Lookup
          </button>
        </div>

        {/* Dice roller */}
        <button onClick={() => setShowDice(v => !v)}
          className="w-full py-2.5 rounded-xl bg-white/10 border border-white/15 text-white/60 text-sm flex items-center justify-center gap-2 mb-3">
          🎲 Dice Roller
          <ChevronDown className={`w-4 h-4 transition-transform ${showDice ? 'rotate-180' : ''}`} />
        </button>
        <AnimatePresence>
          {showDice && (
            <motion.div initial={{ height:0,opacity:0 }} animate={{ height:'auto',opacity:1 }} exit={{ height:0,opacity:0 }} className="overflow-hidden mb-3">
              <DiceRoller />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Advanced options sheet ── */}
      <AnimatePresence>
        {showAdvanced && (
          <>
            <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
              className="fixed inset-0 bg-black/70 z-50" onClick={() => setShowAdvanced(false)} />
            <motion.div
              initial={{ y:'100%' }} animate={{ y:0 }} exit={{ y:'100%' }}
              transition={{ type:'spring', stiffness:400, damping:35 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-[#100e16] border-t border-white/10 rounded-t-3xl p-6 space-y-3"
              style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}>
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-white font-bold text-lg">Game Actions</h3>
                <button onClick={() => setShowAdvanced(false)} className="text-white/40 text-sm">Done</button>
              </div>
              <button onClick={() => { passTurn(true); setShowAdvanced(false); }}
                className="w-full flex items-center gap-3 py-3.5 px-4 rounded-xl bg-white/8 border border-white/10 active:bg-white/15">
                <SkipForward className="w-5 h-5 text-orange-400" />
                <div className="text-left">
                  <div className="text-white font-semibold text-sm">Force Pass Turn</div>
                  <div className="text-white/40 text-xs">Skip to next player (anyone)</div>
                </div>
              </button>
              <button onClick={() => { addExtraTurn(); setShowAdvanced(false); }}
                className="w-full flex items-center gap-3 py-3.5 px-4 rounded-xl bg-white/8 border border-white/10 active:bg-white/15">
                <Repeat className="w-5 h-5 text-purple-400" />
                <div className="text-left">
                  <div className="text-white font-semibold text-sm">Grant Extra Turn</div>
                  <div className="text-white/40 text-xs">
                    Queue for current player
                    {myPlayer?.extra_turns > 0 && <span className="text-purple-400 ml-1">({myPlayer.extra_turns} queued)</span>}
                  </div>
                </div>
              </button>
              <button onClick={() => { setShowAdvanced(false); setShowSeatPicker(true); }}
                className="w-full flex items-center gap-3 py-3.5 px-4 rounded-xl bg-white/8 border border-white/10 active:bg-white/15">
                <Users className="w-5 h-5 text-blue-400" />
                <div className="text-left">
                  <div className="text-white font-semibold text-sm">Change My Seat</div>
                  <div className="text-white/40 text-xs">Switch to a different player slot</div>
                </div>
              </button>

              <button onClick={() => {
                if (!pirMode) { pirStartLife.current = displayLife; setShowWheel(true); }
                setPirMode(v => !v);
                setShowAdvanced(false);
              }}
                className="w-full flex items-center gap-3 py-3.5 px-4 rounded-xl bg-white/8 border border-white/10 active:bg-white/15">
                <Trophy className="w-5 h-5 text-yellow-400" />
                <div className="text-left">
                  <div className="text-white font-semibold text-sm">{pirMode ? '✓ Price Is Right Mode' : 'Price Is Right Mode'}</div>
                  <div className="text-white/40 text-xs">Ascending-only wheel with showstopper sounds</div>
                </div>
              </button>

              <button onClick={() => {
                // Navigate to Lobby, clearing game session state
                window.location.href = createPageUrl('Lobby');
              }}
                className="w-full flex items-center gap-3 py-3.5 px-4 rounded-xl bg-red-900/30 border border-red-700/30 active:bg-red-900/50">
                <LogOut className="w-5 h-5 text-red-400" />
                <div className="text-left">
                  <div className="text-red-300 font-semibold text-sm">Leave Game</div>
                  <div className="text-red-400/50 text-xs">Clear session &amp; return to start</div>
                </div>
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Seat Picker ── */}
      <AnimatePresence>
        {showSeatPicker && (
          <>
            <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
              className="fixed inset-0 bg-black/70 z-50" onClick={() => setShowSeatPicker(false)} />
            <motion.div
              initial={{ y:'100%' }} animate={{ y:0 }} exit={{ y:'100%' }}
              transition={{ type:'spring', stiffness:400, damping:35 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-[#100e16] border-t border-white/10 rounded-t-3xl p-6"
              style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}>
              <h3 className="text-white font-bold text-lg mb-1">Change Seat</h3>
              <p className="text-white/40 text-sm mb-4">Select a player slot to take over.</p>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {session.players?.map((p, i) => (
                  <button key={i}
                    onClick={() => {
                      const url = new URL(window.location.href);
                      url.searchParams.set('playerIndex', i);
                      url.searchParams.set('playerName', p.name || `Player ${i+1}`);
                      window.location.href = url.toString();
                    }}
                    className={`flex items-center gap-2 p-3 rounded-xl border text-left ${
                      i === playerIndex ? 'border-white/40 bg-white/15 text-white' : 'border-white/10 bg-white/5 text-white/60'
                    }`}>
                    <div className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: accentOf(p.color, i) }} />
                    <div>
                      <div className="font-semibold text-sm">{p.name||`Player ${i+1}`}</div>
                      <div className="text-xs opacity-50">{p.life} life{i===playerIndex?' · you':''}</div>
                    </div>
                  </button>
                ))}
              </div>
              <button onClick={() => setShowSeatPicker(false)}
                className="w-full py-3 rounded-xl bg-white/10 text-white/60 font-medium">Cancel</button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Card Share Modal ── */}
      <AnimatePresence>
        {showCardShare && (
          <CardShareModal
            onClose={() => setShowCardShare(false)}
            onSend={sendCard}
            playerName={myPlayer?.name || playerName}
            playerIndex={playerIndex}
            accentColor={colors.accent}
          />
        )}
      </AnimatePresence>

      {/* ── Card Overlay (received from another player) ── */}
      {cardOverlay && (
        <CardOverlay card={cardOverlay} onDismiss={() => setCardOverlay(null)} />
      )}

      {/* ── Rename modal ── */}
      <AnimatePresence>
        {renaming && (
          <>
            <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
              className="fixed inset-0 bg-black/70 z-50" onClick={() => setRenaming(false)} />
            <motion.div
              initial={{ y:'100%' }} animate={{ y:0 }} exit={{ y:'100%' }}
              transition={{ type:'spring', stiffness:400, damping:35 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-[#100e16] border-t border-white/10 rounded-t-3xl p-6"
              style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}>
              <h3 className="font-display text-white text-lg mb-3">Your name</h3>
              <input autoFocus value={nameDraft} maxLength={24} onChange={e => setNameDraft(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveName()}
                className="input-dark mb-3" />
              <div className="flex gap-2">
                <button onClick={() => setRenaming(false)} className="flex-1 py-3 rounded-xl bg-white/10 text-white/60 font-medium">Cancel</button>
                <button onClick={saveName} className="flex-1 btn-gold !py-3">Save</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Reminder modal ── */}
      <AnimatePresence>
        {editingReminder && (
          <>
            <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
              className="fixed inset-0 bg-black/70 z-50" onClick={() => setEditingReminder(false)} />
            <motion.div
              initial={{ y:'100%' }} animate={{ y:0 }} exit={{ y:'100%' }}
              transition={{ type:'spring', stiffness:400, damping:35 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-[#100e16] border-t border-white/10 rounded-t-3xl p-6"
              style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}>
              <h3 className="text-white font-bold text-lg mb-2">Turn Reminder</h3>
              <p className="text-white/50 text-sm mb-3">Shown at the start of your turn.</p>
              <input autoFocus value={reminderText} onChange={e => setReminderText(e.target.value)}
                placeholder="e.g. Untap Seedborn Muse"
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-purple-500 mb-3" />
              <div className="flex gap-2">
                <button onClick={() => setEditingReminder(false)} className="flex-1 py-3 rounded-xl bg-white/10 text-white/60 font-medium">Cancel</button>
                <button onClick={saveReminder} className="flex-1 py-3 rounded-xl bg-purple-600 text-white font-bold">Save</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}