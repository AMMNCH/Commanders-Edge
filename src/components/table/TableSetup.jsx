import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Shuffle, Play, Minus, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { COLOR_KEYS, PLAYER_PALETTE } from '@/lib/theme';
import { knownPlayerNames } from '@/lib/history';
import { shuffle } from '@/lib/random';
import CommanderInput from './CommanderInput';
import { seatLayout } from '@/lib/seats';

const LIFE_PRESETS = [20, 30, 40];
const SETUP_KEY = 'ce_table_setup_v1';

function loadSetup() {
  try { return JSON.parse(localStorage.getItem(SETUP_KEY) || 'null'); } catch (_) { return null; }
}

function seatRows(count, prev = []) {
  return Array.from({ length: count }, (_, i) => prev[i] || {
    name: '',
    color: COLOR_KEYS[i % COLOR_KEYS.length],
    commander: '',
    art: '',
  });
}

/** Mini diagram of where each seat sits around the phone. */
function SeatMap({ count, rows }) {
  const layout = seatLayout(count, 'table');
  return (
    <div className="mx-auto w-24 h-36 rounded-xl border border-white/15 bg-black/30 p-1 grid gap-1"
      style={{ gridTemplateColumns: `repeat(${layout.cols}, 1fr)`, gridTemplateRows: `repeat(${layout.rows}, 1fr)` }}>
      {layout.seats.map((s, i) => (
        <div key={i} className="rounded-md flex items-center justify-center text-[10px] font-black text-black/80"
          style={{
            gridRow: s.row, gridColumn: `${s.col} / span ${s.colSpan || 1}`,
            background: PLAYER_PALETTE[rows[i]?.color]?.accent || '#888',
          }}>
          <span style={{ transform: `rotate(${s.rot}deg)` }}>{i + 1}</span>
        </div>
      ))}
    </div>
  );
}

export default function TableSetup({ onStart }) {
  const saved = useMemo(loadSetup, []);
  const [count, setCount] = useState(saved?.count || 4);
  const [life, setLife] = useState(saved?.life || 40);
  const [rows, setRows] = useState(seatRows(saved?.count || 4, saved?.rows));
  const names = useMemo(knownPlayerNames, []);

  const changeCount = (n) => {
    const c = Math.max(2, Math.min(6, n));
    setCount(c);
    setRows((r) => seatRows(c, r));
  };

  const patchRow = (i, patch) => setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));

  const cycleColor = (i) => {
    const used = new Set(rows.map((r) => r.color));
    const cur = COLOR_KEYS.indexOf(rows[i].color);
    for (let step = 1; step <= COLOR_KEYS.length; step++) {
      const k = COLOR_KEYS[(cur + step) % COLOR_KEYS.length];
      if (!used.has(k) || step === COLOR_KEYS.length) { patchRow(i, { color: k }); return; }
    }
  };

  const start = () => {
    const players = rows.slice(0, count).map((r, i) => ({ ...r, name: r.name.trim() || `Player ${i + 1}` }));
    try { localStorage.setItem(SETUP_KEY, JSON.stringify({ count, life, rows: rows.slice(0, count) })); } catch (_) { /* ignore */ }
    onStart({ players, startingLife: life, format: life === 40 ? 'commander' : life === 20 ? 'standard' : 'custom' });
  };

  return (
    <div className="min-h-[100dvh] bg-arcane text-white">
      <div className="max-w-md mx-auto px-4 pb-32" style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}>
        <div className="flex items-center gap-3 py-2">
          <Link to={createPageUrl('Lobby')} aria-label="Back"
            className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-white/70" />
          </Link>
          <div>
            <h1 className="font-display text-2xl tracking-wide">New table</h1>
            <p className="text-white/45 text-xs">One phone in the middle, everyone taps their own corner.</p>
          </div>
        </div>

        <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 card-glass p-4">
          <div className="flex items-start gap-4">
            <div className="flex-1 space-y-4">
              <div>
                <p className="label-caps">Players</p>
                <div className="flex items-center gap-2 mt-2">
                  <button onClick={() => changeCount(count - 1)} aria-label="Fewer players" className="stepper-btn"><Minus className="w-4 h-4" /></button>
                  <span className="font-display text-3xl w-8 text-center tabular-nums">{count}</span>
                  <button onClick={() => changeCount(count + 1)} aria-label="More players" className="stepper-btn"><Plus className="w-4 h-4" /></button>
                </div>
              </div>
              <div>
                <p className="label-caps">Starting life</p>
                <div className="flex gap-1.5 mt-2">
                  {LIFE_PRESETS.map((l) => (
                    <button key={l} onClick={() => setLife(l)}
                      className={`chip ${life === l ? 'chip-on' : ''}`}>{l}</button>
                  ))}
                  <input
                    type="number" inputMode="numeric" min={1} max={999}
                    value={LIFE_PRESETS.includes(life) ? '' : life}
                    placeholder="…"
                    onChange={(e) => setLife(Math.max(1, Math.min(999, parseInt(e.target.value, 10) || 40)))}
                    className="w-14 chip text-center bg-transparent focus:outline-none" aria-label="Custom starting life"
                  />
                </div>
              </div>
            </div>
            <SeatMap count={count} rows={rows} />
          </div>
        </motion.section>

        <div className="flex items-center justify-between mt-6 mb-2">
          <p className="label-caps">Seats · clockwise</p>
          <button onClick={() => setRows((r) => [...shuffle(r.slice(0, count)), ...r.slice(count)])}
            className="flex items-center gap-1.5 text-xs font-semibold text-gold">
            <Shuffle className="w-3.5 h-3.5" /> Shuffle seats
          </button>
        </div>

        <div className="space-y-2">
          {rows.slice(0, count).map((r, i) => (
            <motion.div key={i} layout className="card-glass p-3">
              <div className="flex items-center gap-2">
                <button onClick={() => cycleColor(i)} aria-label="Change colour"
                  className="w-9 h-9 rounded-full flex-shrink-0 border-2 border-white/20 flex items-center justify-center font-black text-black/70 text-sm"
                  style={{ background: PLAYER_PALETTE[r.color]?.accent }}>{i + 1}</button>
                <input
                  value={r.name}
                  onChange={(e) => patchRow(i, { name: e.target.value })}
                  placeholder={`Player ${i + 1}`}
                  list="ce-known-names"
                  maxLength={24}
                  className="flex-1 min-w-0 bg-white/10 border border-white/15 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/40"
                />
              </div>
              <CommanderInput value={r.commander} onPick={(commander, art) => patchRow(i, { commander, art })} />
            </motion.div>
          ))}
        </div>
        <datalist id="ce-known-names">
          {names.map((n) => <option key={n} value={n} />)}
        </datalist>
      </div>

      <div className="fixed bottom-0 inset-x-0 p-4 bg-gradient-to-t from-[#07060b] via-[#07060b]/95 to-transparent"
        style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
        <button onClick={start} className="btn-gold w-full max-w-md mx-auto flex items-center justify-center gap-2">
          <Play className="w-5 h-5" /> Start game
        </button>
      </div>
    </div>
  );
}
