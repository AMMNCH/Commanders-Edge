import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Undo2, ChevronRight, Dices, Search, ScrollText, RotateCcw, Flag, Home, Shuffle,
  Volume2, VolumeX, Smartphone, Sun, Swords, LayoutGrid, Vibrate,
} from 'lucide-react';
import DiceRoller from '@/components/mtg/DiceRoller';
import { useSettings } from '@/lib/settings';
import { accentOf } from '@/lib/theme';

function formatClock(ms) {
  const m = Math.floor(ms / 60000);
  const h = Math.floor(m / 60);
  return h ? `${h}h ${m % 60}m` : `${m}m`;
}

function Toggle({ on, onChange, icon: Icon, label, sub }) {
  return (
    <button onClick={() => onChange(!on)}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-left active:bg-white/10">
      <Icon className="w-4 h-4 text-white/60 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm text-white font-medium">{label}</div>
        {sub && <div className="text-[11px] text-white/40">{sub}</div>}
      </div>
      <span className={`w-10 h-6 rounded-full p-0.5 transition-colors ${on ? 'bg-gold' : 'bg-white/15'}`}>
        <span className={`block w-5 h-5 rounded-full bg-white transition-transform ${on ? 'translate-x-4' : ''}`} />
      </span>
    </button>
  );
}

function LifeLog({ state }) {
  const byId = Object.fromEntries(state.players.map((p) => [p.id, p]));
  const entries = [...state.log].reverse().slice(0, 120);
  if (!entries.length) return <p className="text-white/40 text-sm text-center py-6">Nothing has happened yet.</p>;
  return (
    <ol className="space-y-1">
      {entries.map((e, i) => {
        const p = byId[e.id];
        const src = byId[e.source];
        let text = '';
        if (e.kind === 'life') text = `${e.delta > 0 ? '+' : ''}${e.delta} life → ${e.value}`;
        if (e.kind === 'poison') text = `${e.delta > 0 ? '+' : ''}${e.delta} poison → ${e.value}`;
        if (e.kind === 'cmdDmg') text = `${e.delta > 0 ? '+' : ''}${e.delta} commander damage from ${src?.name || '?'} → ${e.value}`;
        if (e.kind === 'turn') text = 'started their turn';
        if (e.kind === 'concede') text = p?.conceded ? 'conceded' : 'toggled concede';
        return (
          <li key={`${e.t}-${i}`} className="flex items-center gap-2 text-[13px]">
            <span className="w-8 text-white/30 text-[11px] tabular-nums">T{e.turn || 0}</span>
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: accentOf(p?.color) }} />
            <span className="text-white/85 font-medium">{p?.name || 'Someone'}</span>
            <span className={`truncate ${e.delta < 0 ? 'text-rose-300/80' : e.delta > 0 ? 'text-emerald-300/80' : 'text-white/50'}`}>{text}</span>
          </li>
        );
      })}
    </ol>
  );
}

export default function TableMenu({
  open, onClose, state, dispatch, onRandomFirst, onCardLookup, onEndGame, onNewTable, onHome,
}) {
  const [tab, setTab] = useState('game');
  const [settings, update] = useSettings();
  const active = state.turn.active !== null ? state.players[state.turn.active] : null;
  const elapsed = Date.now() - state.startedAt;

  const act = (fn) => () => { fn(); onClose(); };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            role="dialog" aria-label="Table menu"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            className="fixed z-[61] inset-x-0 bottom-0 max-h-[88dvh] flex flex-col rounded-t-3xl bg-[#100e16] border-t border-white/10 text-white"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <div>
                <h2 className="font-display text-xl tracking-wide">Table</h2>
                <p className="text-white/40 text-xs">
                  {state.turn.number ? `Turn ${state.turn.number}` : 'Not started'} · {formatClock(elapsed)}
                  {active ? ` · ${active.name} to play` : ''}
                </p>
              </div>
              <button onClick={onClose} aria-label="Close menu" className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex gap-1 mx-5 mb-3 p-1 rounded-xl bg-white/5">
              {[['game', 'Game'], ['tools', 'Tools'], ['log', 'Log'], ['settings', 'Settings']].map(([k, label]) => (
                <button key={k} onClick={() => setTab(k)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors ${tab === k ? 'bg-white/15 text-white' : 'text-white/45'}`}>
                  {label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-2">
              {tab === 'game' && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={act(() => dispatch({ type: 'nextTurn' }))} className="tile">
                      <ChevronRight className="w-5 h-5 text-gold" />
                      <span>{state.turn.active === null ? 'Start turns' : 'Pass turn'}</span>
                    </button>
                    <button onClick={act(() => dispatch({ type: 'undo' }))} disabled={!state.past?.length} className="tile disabled:opacity-40">
                      <Undo2 className="w-5 h-5 text-sky-300" />
                      <span>Undo</span>
                    </button>
                    <button onClick={act(onRandomFirst)} className="tile">
                      <Shuffle className="w-5 h-5 text-violet-300" />
                      <span>Random first player</span>
                    </button>
                    <button onClick={act(onCardLookup)} className="tile">
                      <Search className="w-5 h-5 text-emerald-300" />
                      <span>Card lookup</span>
                    </button>
                  </div>
                  <p className="label-caps pt-3">Turn order</p>
                  <div className="flex flex-wrap gap-1.5">
                    {state.players.map((p, i) => (
                      <button key={p.id} onClick={act(() => dispatch({ type: 'setActive', id: p.id }))}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold border ${state.turn.active === i ? 'bg-white/15 border-white/40' : 'bg-white/5 border-white/10 text-white/60'}`}>
                        <span className="w-2 h-2 rounded-full" style={{ background: accentOf(p.color) }} />
                        {i + 1}. {p.name}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-3">
                    <button onClick={act(() => dispatch({ type: 'resetGame' }))} className="tile-sm">
                      <RotateCcw className="w-4 h-4" /> Rematch
                    </button>
                    <button onClick={act(onEndGame)} className="tile-sm">
                      <Flag className="w-4 h-4" /> End game
                    </button>
                    <button onClick={act(onNewTable)} className="tile-sm">
                      <LayoutGrid className="w-4 h-4" /> New table
                    </button>
                  </div>
                  <button onClick={onHome} className="w-full mt-1 py-2.5 rounded-xl text-sm text-white/50 flex items-center justify-center gap-2">
                    <Home className="w-4 h-4" /> Home (game is saved)
                  </button>
                </>
              )}

              {tab === 'tools' && (
                <div className="space-y-3">
                  <DiceRoller />
                  <button onClick={act(onCardLookup)} className="tile w-full">
                    <Search className="w-5 h-5 text-emerald-300" /><span>Look up &amp; show a card</span>
                  </button>
                  <div className="flex items-center gap-2 text-white/40 text-xs px-1">
                    <Dices className="w-3.5 h-3.5" /> Rolls use your device&apos;s secure random generator.
                  </div>
                </div>
              )}

              {tab === 'log' && (
                <div>
                  <div className="flex items-center gap-2 mb-2 text-white/50 text-xs">
                    <ScrollText className="w-3.5 h-3.5" /> Newest first
                  </div>
                  <LifeLog state={state} />
                </div>
              )}

              {tab === 'settings' && (
                <div className="space-y-2">
                  <Toggle on={settings.sound} onChange={(v) => update({ sound: v })} icon={settings.sound ? Volume2 : VolumeX} label="Sound effects" />
                  <Toggle on={settings.haptics} onChange={(v) => update({ haptics: v })} icon={Vibrate} label="Vibration" sub="On phones that support it" />
                  <Toggle on={settings.keepAwake} onChange={(v) => update({ keepAwake: v })} icon={Sun} label="Keep screen on" sub="While a table is open" />
                  <Toggle on={settings.cmdDamageAffectsLife} onChange={(v) => update({ cmdDamageAffectsLife: v })} icon={Swords}
                    label="Commander damage lowers life" sub="Turn off to track it separately" />
                  <p className="label-caps pt-2">Seat orientation</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[['auto', 'Auto'], ['table', 'Around table'], ['upright', 'All upright']].map(([k, label]) => (
                      <button key={k} onClick={() => update({ seatMode: k })}
                        className={`chip justify-center ${settings.seatMode === k ? 'chip-on' : ''}`}>
                        {k === 'upright' ? <Smartphone className="w-3.5 h-3.5 mr-1" /> : null}{label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
