/**
 * DeckBoard — load an Archidekt deck and play it on your own board:
 * hand, battlefield, library, graveyard, exile and command zone.
 */
import React, { useEffect, useMemo, useReducer, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft, Undo2, MoreHorizontal, Minus, Plus, BookOpen, Skull, Ban, Crown, Loader2,
  ChevronRight, X, Shuffle, RotateCcw, Layers, Sparkles, Download, LayoutGrid,
} from 'lucide-react';
import { createPageUrl } from '@/utils';
import { getQuery } from '@/lib/nav';
import { functions, isCloud } from '@/api/backend';
import { extractArchidektId, deckFromText } from '@/lib/archidekt';
import { createBoard, boardReducer, isLand, ZONE_LABEL } from '@/lib/deckBoard';
import CardImage from '@/components/mtg/CardImage';
import CardZoom from '@/components/mtg/CardZoom';
import FreeBoard from '@/components/board/FreeBoard';
import { playSound, initAudio } from '@/components/mtg/SoundEffects';

const SAVE_KEY = 'ce_deckboard_v1';
const RECENT_KEY = 'ce_deckboard_recent_v1';

const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? d; } catch (_) { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* quota */ } };

function Pile({ icon: Icon, label, count, onClick, tone = 'text-white/70' }) {
  return (
    <button onClick={onClick} className="flex-1 min-w-0 flex items-center gap-1.5 rounded-xl bg-white/[0.05] border border-white/10 px-2.5 py-2 active:bg-white/10">
      <Icon className={`w-4 h-4 flex-shrink-0 ${tone}`} />
      <span className="text-[11px] text-white/55 truncate">{label}</span>
      <span className="ml-auto font-display text-base tabular-nums">{count}</span>
    </button>
  );
}

function Sheet({ title, onClose, children }) {
  return (
    <>
      <motion.div className="fixed inset-0 z-[70] bg-black/70" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.div className="fixed inset-x-0 bottom-0 z-[71] max-h-[85dvh] flex flex-col rounded-t-3xl bg-[#100e16] border-t border-white/10"
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 380, damping: 36 }}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          <h2 className="font-display text-lg">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-5">{children}</div>
      </motion.div>
    </>
  );
}

// ── Setup: pick a deck ───────────────────────────────────────────────────────
function DeckLoader({ onLoaded, initialId }) {
  const [input, setInput] = useState(initialId ? `https://archidekt.com/decks/${initialId}` : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Without a server, Archidekt blocks link loading, so pasting is the way in.
  const [tab, setTab] = useState(isCloud && initialId ? 'link' : 'paste'); // 'link' | 'paste'
  const [listText, setListText] = useState('');
  const [listName, setListName] = useState('');
  const recent = useMemo(() => load(RECENT_KEY, []).filter((d) => d.text || isCloud), []);

  const goList = async (text = listText, name = listName.trim() || 'Pasted deck') => {
    setBusy(true); setError('');
    try {
      const { deck, missing: miss } = await deckFromText(text, { name });
      const key = `paste:${name.toLowerCase()}`;
      save(RECENT_KEY, [{ key, name, text }, ...load(RECENT_KEY, []).filter((d) => d.key !== key)].slice(0, 8));
      const board = createBoard(deck);
      board.deck.missing = miss; // shown on the board so nothing silently disappears
      onLoaded(board);
    } catch (e) {
      const msg = e?.message || '';
      setError(/failed to fetch|load failed|networkerror/i.test(msg) ? "Couldn't reach Scryfall. Check your connection and try again." : (msg || 'Could not read that list.'));
    } finally {
      setBusy(false);
    }
  };

  const go = async (value) => {
    const id = extractArchidektId(value);
    if (!id) { setError('Paste an Archidekt deck link, like archidekt.com/decks/12345'); return; }
    setBusy(true); setError('');
    try {
      const res = await functions.invoke('fetchArchidektDeck', { deck_id: id });
      const deck = res?.data?.deck;
      if (!deck?.cards?.length) throw new Error('That deck has no cards, or it is private on Archidekt.');
      save(RECENT_KEY, [{ id, name: deck.name }, ...load(RECENT_KEY, []).filter((d) => String(d.id) !== String(id))].slice(0, 8));
      onLoaded(createBoard(deck));
    } catch (e) {
      const msg = e?.message || '';
      setError(/failed to fetch|load failed|networkerror/i.test(msg) ? "Couldn't reach Archidekt. Check your connection and that the deck is public." : (msg || 'Could not load that deck.'));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { if (initialId && isCloud) go(String(initialId)); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-[100dvh] bg-arcane text-white">
      <div className="max-w-md mx-auto px-5 pb-12" style={{ paddingTop: 'max(20px, env(safe-area-inset-top))' }}>
        <div className="flex items-center gap-3 py-2">
          <Link to={createPageUrl('Lobby')} aria-label="Back" className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-white/70" />
          </Link>
          <div>
            <h1 className="font-display text-2xl tracking-wide">Play your deck</h1>
            <p className="text-white/45 text-xs">Paste your deck list and play it on your own board.</p>
          </div>
        </div>
        {isCloud && <div className="flex gap-1 mt-5 p-1 rounded-xl bg-white/5">
          {[['link', 'Deck link'], ['paste', 'Paste deck list']].map(([k, label]) => (
            <button key={k} onClick={() => { setTab(k); setError(''); }}
              className={`flex-1 py-2 rounded-lg text-sm font-bold ${tab === k ? 'bg-white/15 text-white' : 'text-white/45'}`}>{label}</button>
          ))}
        </div>}

        {tab === 'link' ? (
          <div className="card-glass p-4 mt-3 space-y-3">
            <label htmlFor="deck-url" className="label-caps">Archidekt deck link</label>
            <input id="deck-url" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && go(input)}
              placeholder="https://archidekt.com/decks/…" className="input-dark text-sm" inputMode="url" autoComplete="off" />
            {error && <p className="text-red-300 text-sm">{error}</p>}
            {error && (
              <button onClick={() => { setTab('paste'); setError(''); }} className="text-gold text-sm font-semibold underline underline-offset-4">
                Paste the deck list instead
              </button>
            )}
            {error && <p className="text-white/25 text-[10px]">Version {typeof __APP_BUILD__ !== 'undefined' ? __APP_BUILD__ : 'dev'}</p>}
            <button onClick={() => go(input)} disabled={busy} className="btn-gold w-full flex items-center justify-center gap-2">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} {busy ? 'Loading deck…' : 'Load deck'}
            </button>
          </div>
        ) : (
          <div className="card-glass p-4 mt-3 space-y-3">
            <div className="text-white/60 text-xs leading-relaxed space-y-1.5">
              <p className="text-white/80 font-semibold">Copy your deck from Archidekt:</p>
              <ol className="list-decimal pl-4 space-y-0.5">
                <li>Open your deck on archidekt.com.</li>
                <li>Open the deck&apos;s menu and choose <b className="text-white/85">Export</b>.</li>
                <li>Tap <b className="text-white/85">Copy</b>, then paste it below.</li>
              </ol>
              <p className="text-white/40">Lists from Moxfield or any other site work too: one card per line, like &ldquo;1 Sol Ring&rdquo;. Cards marked Commander start in the command zone. Pictures come from Scryfall.</p>
            </div>
            <label htmlFor="deck-name" className="label-caps mt-1 block">Deck name</label>
            <input id="deck-name" value={listName} onChange={(e) => setListName(e.target.value)} placeholder="My deck" className="input-dark text-sm" />
            <label htmlFor="deck-list" className="label-caps">Deck list</label>
            <textarea id="deck-list" value={listText} onChange={(e) => setListText(e.target.value)} rows={9}
              placeholder={'1x Wilhelt, the Rotcleaver [Commander]\n1 Sol Ring\n30 Swamp'}
              className="input-dark text-sm font-mono leading-relaxed" autoCapitalize="off" autoCorrect="off" spellCheck={false} />
            {error && <p className="text-red-300 text-sm">{error}</p>}
            <button onClick={() => goList()} disabled={busy || !listText.trim()} className="btn-gold w-full flex items-center justify-center gap-2">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} {busy ? 'Looking up cards…' : 'Load list'}
            </button>
          </div>
        )}
        {recent.length > 0 && (
          <>
            <p className="label-caps mt-6 mb-2">Recent decks</p>
            <div className="space-y-2">
              {recent.map((d) => (
                <button key={d.key || d.id} onClick={() => (d.text ? goList(d.text, d.name) : go(String(d.id)))} disabled={busy}
                  className="card-glass w-full flex items-center gap-3 p-3 text-left active:bg-white/[0.08]">
                  <Layers className="w-4 h-4 text-gold" />
                  <span className="flex-1 truncate font-semibold text-sm">{d.name}</span>
                  <ChevronRight className="w-4 h-4 text-white/25" />
                </button>
              ))}
            </div>
          </>
        )}
        <p className="text-white/35 text-[11px] mt-6 leading-relaxed">
          Recent decks reload with one tap. Your commander starts in the command zone and you draw seven. Tap a card on the battlefield to tap or untap it; press and hold any card to see it full screen with more actions.
        </p>
      </div>
    </div>
  );
}

// ── The board ────────────────────────────────────────────────────────────────
export default function DeckBoard() {
  const deckParam = useMemo(() => getQuery().get('deck'), []);
  const [state, dispatch] = useReducer(boardReducer, null, () => {
    const saved = load(SAVE_KEY, null);
    if (deckParam && String(saved?.deck?.archidekt_id) !== String(deckParam)) return null;
    return saved;
  });
  const [zoom, setZoom] = useState(null); // { zone, index }
  const [sheet, setSheet] = useState(null); // 'library' | 'graveyard' | 'exile' | 'command' | 'menu' | 'tokens'
  const [loading, setLoading] = useState(!state);
  const [view, setView] = useState('board'); // 'board' | 'command'

  useEffect(() => { if (state) save(SAVE_KEY, { ...state, past: (state.past || []).slice(-15) }); }, [state]);
  useEffect(() => {
    const h = () => initAudio();
    document.addEventListener('pointerdown', h, { once: true });
    return () => document.removeEventListener('pointerdown', h);
  }, []);

  if (!state || loading) {
    return <DeckLoader initialId={deckParam} onLoaded={(s) => { dispatch({ type: 'load', state: s }); setLoading(false); }} />;
  }

  const z = state.zones;
  const lands = z.battlefield.filter(isLand);
  const others = z.battlefield.filter((c) => !isLand(c));
  const act = (a, sound = 'increment') => { playSound(sound); dispatch(a); };
  const moveTo = (to, extra = {}) => (card) => act({ type: 'move', id: card.id, to, ...extra });

  // Actions available in the full-screen view, by zone.
  const actionsFor = (zone) => (card) => {
    const base = [];
    if (zone === 'hand') {
      base.push({ label: isLand(card) ? 'Play land' : 'Cast / play', primary: true, onClick: moveTo('battlefield') });
      base.push({ label: 'Discard', onClick: moveTo('graveyard') });
      base.push({ label: 'Exile', onClick: moveTo('exile') });
      base.push({ label: 'Top of library', onClick: moveTo('library') });
      base.push({ label: 'Bottom of library', onClick: moveTo('library', { top: false }) });
    }
    if (zone === 'battlefield') {
      base.push({ label: card.tapped ? 'Untap' : 'Tap', primary: true, onClick: () => act({ type: 'tap', id: card.id }) });
      base.push({ label: '+1/+1 counter', close: false, onClick: () => act({ type: 'counter', id: card.id, counter: '+1+1', delta: 1 }) });
      base.push({ label: 'Remove +1/+1', close: false, onClick: () => act({ type: 'counter', id: card.id, counter: '+1+1', delta: -1 }) });
      base.push({ label: card.commander ? 'Command zone' : 'Return to hand', onClick: moveTo(card.commander ? 'command' : 'hand') });
      base.push({ label: 'Graveyard', danger: true, onClick: moveTo('graveyard') });
      base.push({ label: 'Exile', onClick: moveTo('exile') });
    }
    if (zone === 'command') {
      base.push({ label: 'Cast commander', primary: true, onClick: moveTo('battlefield') });
      base.push({ label: 'To hand', onClick: moveTo('hand') });
    }
    if (zone === 'graveyard' || zone === 'exile') {
      base.push({ label: 'Return to battlefield', primary: true, onClick: moveTo('battlefield') });
      base.push({ label: 'Return to hand', onClick: moveTo('hand') });
      base.push({ label: zone === 'graveyard' ? 'Exile' : 'Graveyard', onClick: moveTo(zone === 'graveyard' ? 'exile' : 'graveyard') });
      base.push({ label: 'Top of library', onClick: moveTo('library') });
      if (card.commander) base.push({ label: 'Command zone', onClick: moveTo('command') });
    }
    if (zone === 'library') {
      base.push({ label: 'Put in hand', primary: true, onClick: (c) => { moveTo('hand')(c); act({ type: 'shuffle' }); } });
      base.push({ label: 'Put onto battlefield', onClick: (c) => { moveTo('battlefield')(c); act({ type: 'shuffle' }); } });
    }
    return base;
  };

  const zoomCards = zoom ? (zoom.zone === 'graveyard' ? [...z.graveyard].reverse() : z[zoom.zone]) : [];
  const openZoom = (zone, card) => {
    const list = zone === 'graveyard' ? [...z.graveyard].reverse() : z[zone];
    setZoom({ zone, index: Math.max(0, list.findIndex((c) => c.id === card.id)) });
  };

  const zoneGrid = (zone, cards, empty) => (
    cards.length === 0 ? <p className="text-white/40 text-sm text-center py-8">{empty}</p> : (
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {cards.map((c) => (
          <button key={c.id} onClick={() => { setSheet(null); openZoom(zone, c); }} className="text-left active:scale-95 transition-transform">
            <CardImage card={c} className="w-full aspect-[63/88] rounded-lg" />
            <span className="block text-[10px] text-white/60 truncate mt-0.5">{c.name}</span>
          </button>
        ))}
      </div>
    )
  );

  return (
    <div className="fixed inset-0 bg-arcane text-white flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center gap-2 px-3 pb-2 border-b border-white/10 bg-black/30"
        style={{ paddingTop: 'max(10px, env(safe-area-inset-top))' }}>
        <Link to={createPageUrl('Lobby')} aria-label="Home" className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
          <ArrowLeft className="w-4 h-4 text-white/70" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm truncate">{state.deck.name}</p>
          <p className="text-white/45 text-[11px]">Turn {state.turn} · {state.landsThisTurn ? 'land played' : 'no land yet'}{state.mulligans ? ` · ${state.mulligans} mulligan${state.mulligans > 1 ? 's' : ''}` : ''}</p>
        </div>
        <div className="flex items-center gap-1 rounded-xl bg-white/5 border border-white/10 px-1 py-1">
          <button onClick={() => act({ type: 'life', delta: -1 }, 'decrement')} aria-label="Lose life" className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center"><Minus className="w-3.5 h-3.5" /></button>
          <span className={`font-display text-lg w-9 text-center tabular-nums ${state.life <= 10 ? 'text-red-300' : ''}`}>{state.life}</span>
          <button onClick={() => act({ type: 'life', delta: 1 })} aria-label="Gain life" className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center"><Plus className="w-3.5 h-3.5" /></button>
        </div>
        <button onClick={() => dispatch({ type: 'undo' })} disabled={!state.past?.length} aria-label="Undo"
          className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center disabled:opacity-30"><Undo2 className="w-4 h-4" /></button>
        <button onClick={() => setSheet('menu')} aria-label="More" className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center"><MoreHorizontal className="w-4 h-4" /></button>
      </div>

      {state.deck.missing?.length > 0 && (
        <div className="flex-shrink-0 mx-3 mt-2 flex items-start gap-2 rounded-xl bg-amber-500/10 border border-amber-400/30 px-3 py-2">
          <p className="flex-1 text-amber-100 text-xs">Scryfall couldn&apos;t find: {state.deck.missing.join(', ')}. Check the spelling in your list.</p>
          <button onClick={() => dispatch({ type: 'load', state: { ...state, deck: { ...state.deck, missing: [] } } })} aria-label="Dismiss" className="text-amber-200/70"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* ── BOARD: full-screen free-form battlefield ─────────────────────── */}
      {view === 'board' && (
        <div className="flex-1 min-h-0 flex flex-col gap-1.5 px-1.5 pt-1.5">
          <div className="flex-1 min-h-0">
            <FreeBoard
              cards={z.battlefield}
              accent="#d4a64a"
              title="Your battlefield"
              emptyText="Tap a card in your hand below, then Cast / play"
              onTap={(id) => act({ type: 'tap', id })}
              onCounter={(id, counter, delta) => act({ type: 'counter', id, counter, delta })}
              onMove={(id, x, y, scale) => dispatch({ type: 'place', id, x, y, scale })}
              onUntapAll={() => act({ type: 'untapAll' })}
              actions={[
                { label: '✋ Return to hand', onClick: (c) => act({ type: 'move', id: c.id, to: c.commander ? 'command' : 'hand' }) },
                { label: '⬆ Top of library', onClick: (c) => act({ type: 'move', id: c.id, to: 'library' }) },
                { label: '⬡ Exile', onClick: (c) => act({ type: 'move', id: c.id, to: 'exile' }) },
                { label: '🗑 Graveyard', danger: true, onClick: (c) => act({ type: 'move', id: c.id, to: 'graveyard' }) },
              ]}
            />
          </div>
          {/* Zone chips: library / graveyard / exile / commander */}
          <div className="flex-shrink-0 flex gap-1.5 overflow-x-auto scrollbar-hide">
            <Pile icon={BookOpen} label="Library" count={z.library.length} tone="text-sky-300" onClick={() => setSheet('library')} />
            <Pile icon={Skull} label="Graveyard" count={z.graveyard.length} onClick={() => setSheet('graveyard')} />
            <Pile icon={Ban} label="Exile" count={z.exile.length} tone="text-orange-300" onClick={() => setSheet('exile')} />
            {z.command.map((c) => (
              <button key={c.id} onClick={() => openZoom('command', c)}
                className="flex-shrink-0 flex items-center gap-1.5 rounded-xl bg-gold/15 border border-gold/40 px-2.5 py-2 text-[11px] font-bold text-gold">
                <Crown className="w-4 h-4" /> <span className="max-w-[9rem] truncate">{c.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── COMMAND: zones, command zone and game actions ─────────────────── */}
      {view === 'command' && (
        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <Pile icon={BookOpen} label="Library" count={z.library.length} tone="text-sky-300" onClick={() => setSheet('library')} />
            <Pile icon={Skull} label="Graveyard" count={z.graveyard.length} onClick={() => setSheet('graveyard')} />
            <Pile icon={Ban} label="Exile" count={z.exile.length} tone="text-orange-300" onClick={() => setSheet('exile')} />
          </div>
          <div>
            <p className="label-caps mb-1.5 flex items-center gap-1"><Crown className="w-3 h-3 text-gold" /> Command zone · tap to view and cast</p>
            {z.command.length === 0 ? <p className="text-white/30 text-xs">Your commander is on the battlefield or elsewhere.</p> : (
              <div className="flex gap-2 flex-wrap">
                {z.command.map((c) => (
                  <button key={c.id} onClick={() => openZoom('command', c)} className="w-24 text-left">
                    <CardImage card={c} className="w-full aspect-[63/88] rounded-lg" />
                    <span className="block text-[10px] text-white/60 truncate mt-0.5">{c.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <p className="label-caps mb-1.5">On the battlefield</p>
            <p className="text-white/55 text-sm">
              {z.battlefield.length} permanent{z.battlefield.length === 1 ? '' : 's'} · {lands.length} land{lands.length === 1 ? '' : 's'} ({lands.filter((c) => !c.tapped).length} untapped) · {others.length} other
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button className="tile" onClick={() => act({ type: 'mulligan' }, 'dice')}><Shuffle className="w-5 h-5 text-violet-300" />Mulligan (new 7)</button>
            <button className="tile" onClick={() => setSheet('tokens')}><Sparkles className="w-5 h-5 text-emerald-300" />Create token</button>
            <button className="tile" onClick={() => act({ type: 'untapAll' })}><RotateCcw className="w-5 h-5 text-sky-300" />Untap all</button>
            <button className="tile" onClick={() => act({ type: 'shuffle' }, 'dice')}><Shuffle className="w-5 h-5 text-sky-300" />Shuffle library</button>
            <button className="tile" onClick={() => dispatch({ type: 'restart' })}><RotateCcw className="w-5 h-5 text-gold" />Restart game</button>
            <button className="tile" onClick={() => { save(SAVE_KEY, null); dispatch({ type: 'load', state: null }); setLoading(true); }}><Layers className="w-5 h-5 text-gold" />Load another deck</button>
          </div>
        </div>
      )}

      {/* Hand + turn controls */}
      <div className="flex-shrink-0 mt-1.5 border-t border-white/10 bg-[#0b0a10]/95">
        <div className="flex items-center justify-between px-3 pt-2">
          <p className="label-caps">Hand · {z.hand.length} · tap to view</p>
          <div className="flex gap-1.5">
            <button onClick={() => act({ type: 'draw' })} disabled={!z.library.length}
              className="px-3 py-1.5 rounded-lg bg-sky-500/15 border border-sky-400/30 text-sky-200 text-xs font-bold disabled:opacity-40">Draw</button>
            <button onClick={() => act({ type: 'nextTurn' }, 'commander')}
              className="px-3 py-1.5 rounded-lg bg-gold text-black text-xs font-bold flex items-center gap-0.5">Next turn <ChevronRight className="w-3.5 h-3.5" /></button>
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto px-3 py-2 scrollbar-hide" style={{ minHeight: 112 }}>
          {z.hand.length === 0 && <p className="text-white/25 text-xs self-center mx-auto">Your hand is empty.</p>}
          {z.hand.map((c) => (
            <button key={c.id} onClick={() => openZoom('hand', c)} aria-label={c.name}
              className="flex-shrink-0 active:-translate-y-1 transition-transform" style={{ width: 72 }}>
              <CardImage card={c} className="w-full aspect-[63/88] rounded-[6px] shadow-xl border border-white/10" />
            </button>
          ))}
        </div>
      </div>

      {/* Bottom tabs (like the Horde and duel screens) */}
      <div className="flex-shrink-0 flex items-center justify-around border-t border-white/10 bg-[#0a0910]"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)', paddingTop: 8, minHeight: 56 }}>
        {[['command', 'Command', Crown], ['board', 'Board', LayoutGrid]].map(([id, label, Icon]) => (
          <button key={id} onClick={() => setView(id)} className="flex flex-col items-center gap-1 px-8 py-1"
            style={{ color: view === id ? '#d4a64a' : 'rgba(255,255,255,0.35)' }}>
            <Icon className="w-5 h-5" />
            <span className="text-[10px] font-bold tracking-wide uppercase">{label}</span>
            {view === id && <span className="w-5 h-0.5 rounded-full bg-gold" />}
          </button>
        ))}
      </div>

      {/* Full-screen card view */}
      <AnimatePresence>
        {zoom && zoomCards.length > 0 && (
          <CardZoom
            key={`${zoom.zone}-${zoom.index}`}
            cards={zoomCards}
            index={Math.min(zoom.index, zoomCards.length - 1)}
            onClose={() => setZoom(null)}
            caption={(c) => [ZONE_LABEL[zoom.zone], c.type, c.power != null ? `${c.power}/${c.toughness}` : null, c.tapped ? 'tapped' : null].filter(Boolean).join(' · ')}
            actions={actionsFor(zoom.zone)}
          />
        )}
      </AnimatePresence>

      {/* Sheets */}
      <AnimatePresence>
        {sheet === 'library' && (
          <Sheet title={`Library · ${z.library.length}`} onClose={() => setSheet(null)}>
            <div className="grid grid-cols-3 gap-2 mb-4">
              <button className="tile-sm" onClick={() => { act({ type: 'draw' }); setSheet(null); }}><BookOpen className="w-4 h-4" />Draw 1</button>
              <button className="tile-sm" onClick={() => { act({ type: 'mill', n: 1 }); }}><Skull className="w-4 h-4" />Mill 1</button>
              <button className="tile-sm" onClick={() => { act({ type: 'shuffle' }, 'dice'); setSheet(null); }}><Shuffle className="w-4 h-4" />Shuffle</button>
            </div>
            <p className="label-caps mb-2">Search your library (it shuffles after you take a card)</p>
            {zoneGrid('library', [...z.library].sort((a, b) => a.name.localeCompare(b.name)), 'Your library is empty.')}
          </Sheet>
        )}
        {sheet === 'graveyard' && (
          <Sheet title={`Graveyard · ${z.graveyard.length}`} onClose={() => setSheet(null)}>
            {zoneGrid('graveyard', [...z.graveyard].reverse(), 'Nothing in your graveyard.')}
          </Sheet>
        )}
        {sheet === 'exile' && (
          <Sheet title={`Exile · ${z.exile.length}`} onClose={() => setSheet(null)}>
            {zoneGrid('exile', z.exile, 'Nothing exiled.')}
          </Sheet>
        )}
        {sheet === 'tokens' && (
          <Sheet title="Create a token" onClose={() => setSheet(null)}>
            {state.tokens.length === 0 ? <p className="text-white/40 text-sm text-center py-6">This deck doesn&apos;t mention any creature tokens.</p> : (
              <div className="grid grid-cols-3 gap-2">
                {state.tokens.map((t) => (
                  <button key={t.name} onClick={() => { act({ type: 'token', token: t }); setSheet(null); }} className="text-left active:scale-95 transition-transform">
                    <CardImage card={t} className="w-full aspect-[63/88] rounded-lg" />
                    <span className="block text-[10px] text-white/60 truncate mt-0.5">{t.name} {t.power}/{t.toughness}</span>
                  </button>
                ))}
              </div>
            )}
          </Sheet>
        )}
        {sheet === 'menu' && (
          <Sheet title="Game" onClose={() => setSheet(null)}>
            <div className="grid grid-cols-2 gap-2">
              <button className="tile" onClick={() => { act({ type: 'mulligan' }, 'dice'); setSheet(null); }}><Shuffle className="w-5 h-5 text-violet-300" />Mulligan (new 7)</button>
              <button className="tile" onClick={() => setSheet('tokens')}><Sparkles className="w-5 h-5 text-emerald-300" />Create token</button>
              <button className="tile" onClick={() => { act({ type: 'untapAll' }); setSheet(null); }}><RotateCcw className="w-5 h-5 text-sky-300" />Untap all</button>
              <button className="tile" onClick={() => { act({ type: 'draw', n: 7 }); setSheet(null); }}><BookOpen className="w-5 h-5 text-sky-300" />Draw 7</button>
              <button className="tile" onClick={() => { dispatch({ type: 'restart' }); setSheet(null); }}><RotateCcw className="w-5 h-5 text-gold" />Restart game</button>
              <button className="tile" onClick={() => { save(SAVE_KEY, null); dispatch({ type: 'load', state: null }); setLoading(true); setSheet(null); }}><Layers className="w-5 h-5 text-gold" />Load another deck</button>
            </div>
          </Sheet>
        )}
      </AnimatePresence>
    </div>
  );
}
