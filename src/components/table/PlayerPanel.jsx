import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Swords, Droplet, Settings2, Crown, Compass, ChevronRight, Skull, X, Minus, Plus, Check } from 'lucide-react';
import useHoldRepeat from '@/hooks/useHoldRepeat';
import { playSound } from '@/components/mtg/SoundEffects';
import { buzz, getSettings } from '@/lib/settings';
import { PLAYER_PALETTE, COLOR_KEYS, panelGradient, accentOf } from '@/lib/theme';
import { deathReason, POISON_LETHAL, COMMANDER_LETHAL, TABLE_COUNTERS } from '@/lib/table';
import CommanderInput from './CommanderInput';

const DEATH_TEXT = {
  life: 'Out of life',
  poison: '10 poison counters',
  commander: '21 commander damage',
  conceded: 'Conceded',
};

/** Small −/value/+ stepper used in the overlays. */
function Stepper({ value, onChange, accent, danger, label, sub }) {
  return (
    <div className="rounded-xl bg-black/35 border border-white/10 px-2 py-1.5">
      <div className="flex items-baseline gap-1.5 min-w-0">
        <span className="text-white text-[12px] font-semibold truncate">{label}</span>
        {sub && <span className="text-white/40 text-[10px] truncate">{sub}</span>}
      </div>
      <div className="flex items-center justify-between mt-1">
        <button onClick={() => onChange(-1)} aria-label={`Decrease ${label}`}
          className="w-9 h-8 rounded-lg bg-white/10 active:bg-white/25 flex items-center justify-center">
          <Minus className="w-4 h-4 text-white" />
        </button>
        <span className={`font-display text-lg tabular-nums ${danger ? 'text-red-300' : 'text-white'}`}
          style={!danger && value > 0 ? { color: accent } : undefined}>{value}</span>
        <button onClick={() => onChange(1)} aria-label={`Increase ${label}`}
          className="w-9 h-8 rounded-lg bg-white/10 active:bg-white/25 flex items-center justify-center">
          <Plus className="w-4 h-4 text-white" />
        </button>
      </div>
    </div>
  );
}

function Overlay({ title, onClose, children }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.15 }}
      className="absolute inset-0 z-30 flex flex-col bg-[#09080d]/95 backdrop-blur-md p-2.5"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-1.5 flex-shrink-0">
        <h3 className="font-display text-white text-sm tracking-wide truncate">{title}</h3>
        <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
          <X className="w-4 h-4 text-white/70" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto overscroll-contain grid gap-1.5 content-start pr-0.5"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(128px, 1fr))' }}>{children}</div>
    </motion.div>
  );
}

export default function PlayerPanel({
  player, players, isActive, isMonarch, hasInitiative, spotlight, turnStartedAt,
  dispatch, onEndTurn, compact,
}) {
  const [pending, setPending] = useState(0);
  const [burst, setBurst] = useState(0);
  const [overlay, setOverlay] = useState(null); // 'cmd' | 'counters' | 'edit'
  const commitTimer = useRef(null);
  const burstTimer = useRef(null);
  const pendingRef = useRef(0);

  const accent = accentOf(player.color);
  const reason = deathReason({ ...player, life: player.life + pending });
  const dead = Boolean(reason);
  const life = player.life + pending;
  const lowLife = !dead && life <= 10;
  const opponents = players.filter((p) => p.id !== player.id);
  const topCmd = opponents
    .map((o) => ({ o, d: player.cmdDmg?.[o.id] || 0 }))
    .filter((x) => x.d > 0)
    .sort((a, b) => b.d - a.d);

  const commit = () => {
    clearTimeout(commitTimer.current);
    const d = pendingRef.current;
    pendingRef.current = 0;
    setPending(0);
    if (d) dispatch({ type: 'life', id: player.id, delta: d });
  };

  // Flush on unmount so a quick navigation never drops a tap.
  useEffect(() => () => {
    clearTimeout(commitTimer.current);
    clearTimeout(burstTimer.current);
    if (pendingRef.current) dispatch({ type: 'life', id: player.id, delta: pendingRef.current });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const bump = (sign, tick) => {
    // After a second of holding, jump by 5s like most physical spin-downs.
    const step = tick > 12 ? 5 : 1;
    const d = sign * step;
    pendingRef.current += d;
    setPending(pendingRef.current);
    clearTimeout(burstTimer.current);
    setBurst((b) => b + d);
    burstTimer.current = setTimeout(() => setBurst(0), 1600);
    clearTimeout(commitTimer.current);
    if (tick === 1) {
      playSound(sign > 0 ? 'increment' : 'decrement');
      buzz(6);
    }
  };
  const release = () => {
    clearTimeout(commitTimer.current);
    commitTimer.current = setTimeout(commit, 900);
  };

  const minusHandlers = useHoldRepeat((t) => bump(-1, t), release);
  const plusHandlers = useHoldRepeat((t) => bump(1, t), release);

  const background = player.art
    ? `linear-gradient(180deg, rgba(7,6,11,0.55) 0%, rgba(7,6,11,0.35) 45%, rgba(7,6,11,0.8) 100%), url("${player.art}") center 30% / cover`
    : panelGradient(player.color);

  return (
    <div
      className="relative w-full h-full overflow-hidden select-none"
      style={{ background, containerType: 'size', borderRadius: 18 }}
    >
      {/* Active-turn ring + low-life wash */}
      <div className="absolute inset-0 pointer-events-none z-10 transition-all duration-300"
        style={{
          borderRadius: 18,
          boxShadow: isActive
            ? `inset 0 0 0 3px ${accent}, inset 0 0 40px ${accent}55`
            : spotlight ? 'inset 0 0 0 3px #fff, inset 0 0 60px #ffffff66' : 'inset 0 0 0 1px rgba(255,255,255,0.08)',
          background: dead ? 'rgba(0,0,0,0.55)' : lowLife ? `rgba(220,38,38,${0.12 + (10 - life) * 0.02})` : 'transparent',
        }} />

      {/* Tap zones: left half −, right half + */}
      {!overlay && (
        <div className="absolute inset-0 z-0 flex touch-none">
          <button aria-label={`${player.name} lose life`} {...minusHandlers}
            className="flex-1 flex items-center justify-start pl-[6cqw] active:bg-black/20 transition-colors">
            <Minus className="text-white/35" style={{ width: 'min(9cqw, 13cqh)', height: 'min(9cqw, 13cqh)' }} />
          </button>
          <button aria-label={`${player.name} gain life`} {...plusHandlers}
            className="flex-1 flex items-center justify-end pr-[6cqw] active:bg-white/10 transition-colors">
            <Plus className="text-white/35" style={{ width: 'min(9cqw, 13cqh)', height: 'min(9cqw, 13cqh)' }} />
          </button>
        </div>
      )}

      {/* Controls sit on the player's own edge (away from the centre hub). */}
      <div className="absolute bottom-0 left-0 right-0 z-20 flex items-center gap-1.5 px-[3cqw] pb-[3cqh] pointer-events-none">
        {/* Name pill; on your turn it doubles as the End-turn button. */}
        <div className="pointer-events-auto flex items-center min-w-0 rounded-full backdrop-blur border overflow-hidden"
          style={isActive && !dead
            ? { background: accent, borderColor: accent }
            : { background: 'rgba(0,0,0,0.35)', borderColor: 'rgba(255,255,255,0.1)' }}>
          <button onClick={() => setOverlay('edit')} className="flex items-center gap-1.5 min-w-0 pl-2.5 pr-2 py-1">
            {!(isActive && !dead) && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: accent }} />}
            <span className={`text-[13px] font-semibold truncate max-w-[24cqw] ${isActive && !dead ? 'text-black' : 'text-white'}`}>{player.name}</span>
            {isMonarch && <Crown className={`w-3.5 h-3.5 flex-shrink-0 ${isActive && !dead ? 'text-black/70' : 'text-yellow-300'}`} />}
            {hasInitiative && <Compass className={`w-3.5 h-3.5 flex-shrink-0 ${isActive && !dead ? 'text-black/70' : 'text-sky-300'}`} />}
          </button>
          {isActive && !dead && (
            <button onClick={onEndTurn} aria-label="End turn"
              className="flex items-center gap-0.5 pl-2 pr-1.5 py-1 border-l border-black/20 text-black text-[13px] font-bold whitespace-nowrap active:bg-black/10">
              End turn <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
        {isActive && !dead && turnStartedAt && !compact && <TurnClock startedAt={turnStartedAt} />}
        <div className="flex-1" />
        <button onClick={() => setOverlay('cmd')} aria-label="Commander damage"
          className="pointer-events-auto h-8 min-w-8 px-2 rounded-full bg-black/35 backdrop-blur border border-white/10 flex items-center justify-center gap-1">
          <Swords className="w-4 h-4 text-amber-300" />
          {topCmd[0] && <span className="text-amber-200 text-xs font-bold tabular-nums">{topCmd[0].d}</span>}
        </button>
        <button onClick={() => setOverlay('counters')} aria-label="Poison and counters"
          className="pointer-events-auto h-8 min-w-8 px-2 rounded-full bg-black/35 backdrop-blur border border-white/10 flex items-center justify-center gap-1">
          <Droplet className="w-4 h-4 text-lime-300" />
          {player.poison > 0 && <span className="text-lime-200 text-xs font-bold tabular-nums">{player.poison}</span>}
        </button>
        {!compact && !isActive && (
          <button onClick={() => setOverlay('edit')} aria-label="Player settings"
            className="pointer-events-auto w-8 h-8 rounded-full bg-black/35 backdrop-blur border border-white/10 flex items-center justify-center">
            <Settings2 className="w-4 h-4 text-white/70" />
          </button>
        )}
      </div>

      {/* Life */}
      <div className="absolute inset-0 z-[5] flex flex-col items-center justify-center pointer-events-none">
        <div className="relative">
          <AnimatePresence>
            {burst !== 0 && (
              <motion.div
                key="burst"
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                className={`absolute left-1/2 -translate-x-1/2 font-display font-bold tabular-nums ${burst > 0 ? 'text-emerald-300' : 'text-rose-300'}`}
                style={{ bottom: '100%', fontSize: 'min(9cqw, 11cqh)' }}
              >
                {burst > 0 ? `+${burst}` : burst}
              </motion.div>
            )}
          </AnimatePresence>
          <motion.div
            key={dead ? 'dead' : 'alive'}
            initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className={`font-display font-bold leading-none tabular-nums ${dead ? 'text-white/40' : lowLife ? 'text-red-200' : 'text-white'}`}
            style={{
              fontSize: 'min(30cqw, 44cqh)',
              textShadow: dead ? 'none' : `0 4px 30px ${accent}66, 0 2px 0 rgba(0,0,0,0.5)`,
            }}
          >
            {life}
          </motion.div>
        </div>
        {dead ? (
          <div className="mt-[1cqh] flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1 text-white/70 text-xs font-semibold">
            <Skull className="w-3.5 h-3.5" /> {DEATH_TEXT[reason]}
          </div>
        ) : (
          <div className="mt-[1cqh] flex flex-wrap justify-center gap-1 px-[10cqw]">
            {player.commander && (
              <span className="w-full text-center text-white/55 text-[11px] font-medium truncate">{player.commander}</span>
            )}
            {player.poison > 0 && (
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${player.poison >= 7 ? 'bg-lime-500/30 text-lime-100' : 'bg-black/40 text-lime-200'}`}>
                ☠ {player.poison}/{POISON_LETHAL}
              </span>
            )}
            {topCmd.slice(0, 2).map(({ o, d }) => (
              <span key={o.id} className={`rounded-full px-2 py-0.5 text-[11px] font-bold bg-black/40 ${d >= 15 ? 'text-amber-200' : 'text-white/70'}`}>
                ⚔ {d} · {o.name}
              </span>
            ))}
            {Object.entries(player.counters || {}).filter(([, v]) => v > 0).slice(0, 3).map(([k, v]) => {
              const c = TABLE_COUNTERS.find((x) => x.id === k);
              return <span key={k} className="rounded-full px-2 py-0.5 text-[11px] font-bold bg-black/40 text-white/70">{c?.icon} {v}</span>;
            })}
          </div>
        )}
      </div>

      {/* Overlays */}
      <AnimatePresence>
        {overlay === 'cmd' && (
          <Overlay title="Commander damage taken" onClose={() => setOverlay(null)}>
            {opponents.map((o) => {
              const d = player.cmdDmg?.[o.id] || 0;
              return (
                <Stepper
                  key={o.id}
                  label={o.name}
                  sub={o.commander || PLAYER_PALETTE[o.color]?.name}
                  value={d}
                  accent={accentOf(o.color)}
                  danger={d >= COMMANDER_LETHAL - 4}
                  onChange={(delta) => {
                    playSound('commander');
                    buzz(6);
                    dispatch({ type: 'cmdDmg', id: player.id, source: o.id, delta, affectsLife: getSettings().cmdDamageAffectsLife });
                  }}
                />
              );
            })}
            <p className="col-span-full text-white/35 text-[10px] pt-1 px-1">
              {getSettings().cmdDamageAffectsLife ? 'Commander damage also lowers life. ' : 'Life is not changed. '}
              21 from one commander is lethal.
            </p>
          </Overlay>
        )}
        {overlay === 'counters' && (
          <Overlay title="Counters" onClose={() => setOverlay(null)}>
            <Stepper label="Poison" sub="10 is lethal" value={player.poison} accent="#a3e635"
              danger={player.poison >= 7}
              onChange={(delta) => { playSound('poison'); buzz(6); dispatch({ type: 'poison', id: player.id, delta }); }} />
            {TABLE_COUNTERS.map((c) => (
              <Stepper key={c.id} label={`${c.icon} ${c.label}`} value={player.counters?.[c.id] || 0} accent={accent}
                onChange={(delta) => { playSound(delta > 0 ? 'increment' : 'decrement'); dispatch({ type: 'counter', id: player.id, counter: c.id, delta }); }} />
            ))}
          </Overlay>
        )}
        {overlay === 'edit' && (
          <Overlay title="Player" onClose={() => setOverlay(null)}>
            <EditPlayer player={player} dispatch={dispatch} isMonarch={isMonarch} hasInitiative={hasInitiative}
              onDone={() => setOverlay(null)} />
          </Overlay>
        )}
      </AnimatePresence>
    </div>
  );
}

function TurnClock({ startedAt }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const s = Math.max(0, Math.floor((now - startedAt) / 1000));
  return (
    <span className={`rounded-full bg-black/40 px-2 py-1 text-[11px] font-mono tabular-nums ${s > 180 ? 'text-red-300' : 'text-white/60'}`}>
      {String(Math.floor(s / 60)).padStart(2, '0')}:{String(s % 60).padStart(2, '0')}
    </span>
  );
}

function EditPlayer({ player, dispatch, isMonarch, hasInitiative, onDone }) {
  const [name, setName] = useState(player.name);
  return (
    <div className="col-span-full space-y-3">
      <div>
        <label className="text-white/45 text-[10px] uppercase tracking-widest">Name</label>
        <div className="flex gap-1.5 mt-1">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => dispatch({ type: 'rename', id: player.id, name })}
            onKeyDown={(e) => { if (e.key === 'Enter') { dispatch({ type: 'rename', id: player.id, name }); e.currentTarget.blur(); } }}
            maxLength={24}
            className="flex-1 min-w-0 bg-white/10 border border-white/15 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/40"
          />
          <button onClick={() => { dispatch({ type: 'rename', id: player.id, name }); onDone(); }}
            className="w-10 rounded-lg bg-white/15 flex items-center justify-center" aria-label="Save name">
            <Check className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
      <div>
        <label className="text-white/45 text-[10px] uppercase tracking-widest">Commander</label>
        <CommanderInput
          value={player.commander}
          onPick={(commander, art) => dispatch({ type: 'commander', id: player.id, commander, art })}
          compact
        />
      </div>
      <div>
        <label className="text-white/45 text-[10px] uppercase tracking-widest">Colour</label>
        <div className="flex flex-wrap gap-2 mt-1.5">
          {COLOR_KEYS.map((k) => (
            <button key={k} onClick={() => dispatch({ type: 'color', id: player.id, color: k })}
              aria-label={PLAYER_PALETTE[k].name}
              className="w-8 h-8 rounded-full border-2 transition-transform active:scale-90"
              style={{ background: PLAYER_PALETTE[k].accent, borderColor: player.color === k ? '#fff' : 'transparent' }} />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <button onClick={() => dispatch({ type: 'monarch', id: player.id })}
          className={`py-2 rounded-lg text-xs font-bold border ${isMonarch ? 'bg-yellow-400/20 border-yellow-300/50 text-yellow-200' : 'bg-white/5 border-white/10 text-white/60'}`}>
          <Crown className="inline w-3.5 h-3.5 mr-1" />{isMonarch ? 'Monarch' : 'Make monarch'}
        </button>
        <button onClick={() => dispatch({ type: 'initiative', id: player.id })}
          className={`py-2 rounded-lg text-xs font-bold border ${hasInitiative ? 'bg-sky-400/20 border-sky-300/50 text-sky-200' : 'bg-white/5 border-white/10 text-white/60'}`}>
          <Compass className="inline w-3.5 h-3.5 mr-1" />{hasInitiative ? 'Initiative' : 'Take initiative'}
        </button>
        <button onClick={() => { dispatch({ type: 'setActive', id: player.id }); onDone(); }}
          className="py-2 rounded-lg text-xs font-bold border bg-white/5 border-white/10 text-white/60">
          It&apos;s my turn
        </button>
        <button onClick={() => { dispatch({ type: 'concede', id: player.id }); onDone(); }}
          className={`py-2 rounded-lg text-xs font-bold border ${player.conceded ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200' : 'bg-red-500/10 border-red-400/30 text-red-200'}`}>
          {player.conceded ? 'Return to game' : 'Concede'}
        </button>
      </div>
    </div>
  );
}
