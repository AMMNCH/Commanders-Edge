import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Link2, Skull, Swords, ArrowRight, Copy, Check, Share2, Trophy, ChevronRight,
  ArrowLeft, Loader2, CloudOff, Cloud, Play, BarChart2,
} from 'lucide-react';
import { db, isCloud } from '@/api/backend';
import { createPageUrl } from '@/utils';
import { getQuery, pageHref } from '@/lib/nav';
import RecentGames, { saveRecentGame } from '@/components/lobby/RecentGames';
import HordeDeckSelector from '@/components/horde/HordeDeckSelector';
import { loadCurrentTable, listGames } from '@/lib/history';
import { COLOR_KEYS, accentOf } from '@/lib/theme';
import iconUrl from '@/assets/icon.svg';

function calcHordeSharedLife(playerCount) {
  return Math.max(40, 100 - (playerCount - 1) * 15);
}

// No 0/O/1/I so codes are easy to read aloud.
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function generateCode() {
  const buf = new Uint32Array(6);
  crypto.getRandomValues(buf);
  return Array.from(buf, (n) => CODE_CHARS[n % CODE_CHARS.length]).join('');
}

function initPlayers(count, life) {
  return Array.from({ length: count }, (_, i) => ({
    index: i,
    name: `Player ${i + 1}`,
    life,
    poison: 0,
    played_land: false,
    commander_damage: {},
    color: COLOR_KEYS[i % COLOR_KEYS.length],
    reminder: '',
    claimed: false,
  }));
}

const NAME_KEY = 'ce_my_name';
const getMyName = () => { try { return localStorage.getItem(NAME_KEY) || ''; } catch (_) { return ''; } };
const setMyNameStored = (n) => { try { localStorage.setItem(NAME_KEY, n); } catch (_) { /* ignore */ } };

function ModeCard({ icon: Icon, title, sub, onClick, to, accent, badge }) {
  const inner = (
    <>
      <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `${accent}22`, border: `1px solid ${accent}44` }}>
        <Icon className="w-5 h-5" style={{ color: accent }} />
      </div>
      <div className="flex-1 min-w-0 text-left">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-white">{title}</span>
          {badge && <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/10 text-white/50">{badge}</span>}
        </div>
        <div className="text-white/45 text-xs mt-0.5">{sub}</div>
      </div>
      <ChevronRight className="w-4 h-4 text-white/25" />
    </>
  );
  const cls = 'card-glass w-full flex items-center gap-3 p-3.5 active:bg-white/[0.08] transition-colors';
  return to ? <Link to={to} className={cls}>{inner}</Link> : <button onClick={onClick} className={cls}>{inner}</button>;
}

function Segmented({ options, value, onChange, accent = '#d4a64a' }) {
  return (
    <div className="flex gap-1.5">
      {options.map((o) => (
        <button key={o} onClick={() => onChange(o)}
          className="flex-1 py-2 rounded-lg font-bold text-sm border transition-colors"
          style={value === o
            ? { background: `${accent}26`, borderColor: `${accent}99`, color: accent }
            : { background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.55)' }}>
          {o}
        </button>
      ))}
    </div>
  );
}

function BackBar({ onBack, title, sub }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <button onClick={onBack} aria-label="Back" className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
        <ArrowLeft className="w-5 h-5 text-white/70" />
      </button>
      <div>
        <h2 className="font-display text-xl tracking-wide">{title}</h2>
        {sub && <p className="text-white/45 text-xs">{sub}</p>}
      </div>
    </div>
  );
}

export default function Lobby() {
  const navigate = useNavigate();
  const initialJoin = useMemo(() => getQuery().get('join') || '', []);
  const [mode, setMode] = useState(initialJoin ? 'join' : null); // 'create' | 'join' | 'horde'
  const [playerCount, setPlayerCount] = useState(4);
  const [startingLife, setStartingLife] = useState(40);
  const [joinCode, setJoinCode] = useState(initialJoin.toUpperCase());
  const [joinSession, setJoinSession] = useState(null);
  const [myName, setMyName] = useState(getMyName);
  const [myIndex, setMyIndex] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [created, setCreated] = useState(null); // { code, isHorde, count }
  const [selectedHordeDeck, setSelectedHordeDeck] = useState(null);

  const resumable = useMemo(() => {
    const t = loadCurrentTable();
    return t && !t.endedAt ? t : null;
  }, []);
  const gamesPlayed = useMemo(() => listGames().length, []);

  const handleRejoin = ({ code, playerIndex, playerName }) => {
    navigate(createPageUrl(`PlayerView?code=${code}&playerIndex=${playerIndex ?? 0}&playerName=${encodeURIComponent(playerName || 'Player 1')}`));
  };

  const createGame = async (isHorde = false) => {
    setLoading(true);
    setError('');
    try {
      const code = generateCode();
      await db.GameSession.create({
        code,
        game_mode: isHorde ? 'horde_commander' : 'commander',
        player_count: playerCount,
        starting_life: startingLife,
        current_turn_player: 0,
        turn_started_at: new Date().toISOString(),
        turn_number: 1,
        status: 'active',
        players: initPlayers(playerCount, startingLife),
        ...(isHorde ? {
          shared_life_total: calcHordeSharedLife(playerCount),
          horde_library_size: selectedHordeDeck ? selectedHordeDeck.card_count : 100,
          horde_starting_library: selectedHordeDeck ? selectedHordeDeck.card_count : 100,
          horde_graveyard_size: 0,
          horde_board_state: [],
          horde_wave_log: [],
          horde_deck_id: selectedHordeDeck?.id || null,
        } : {}),
      });
      setCreated({ code, isHorde, count: playerCount });
    } catch (e) {
      setError(e?.message || 'Could not create the game. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const shareUrl = created ? `${window.location.origin}${window.location.pathname.replace(/\/[^/]*$/, '')}${pageHref(createPageUrl(`Lobby?join=${created.code}`))}` : '';

  const copyCode = async () => {
    try { await navigator.clipboard.writeText(created.code); } catch (_) { /* ignore */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const share = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: 'Join my Commander game', text: `Join with code ${created.code}`, url: shareUrl }); return; } catch (_) { /* cancelled */ }
    }
    try { await navigator.clipboard.writeText(shareUrl); } catch (_) { /* ignore */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Step 1 of joining: find the game so we can show its real seats.
  const findGame = async () => {
    setLoading(true);
    setError('');
    try {
      const results = await db.GameSession.filter({ code: joinCode.toUpperCase().trim() });
      if (!results?.length) {
        setError(isCloud ? 'No game with that code.' : 'No game with that code on this device. Linked games need online mode to sync between phones.');
        return;
      }
      const s = results[0];
      setJoinSession(s);
      const firstFree = (s.players || []).findIndex((p) => !p.claimed);
      setMyIndex(firstFree === -1 ? 0 : firstFree);
    } catch (e) {
      setError(e?.message || 'Could not reach the game.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: claim the seat (writes your name into the game) and go.
  const takeSeat = async (index) => {
    const s = joinSession;
    const typed = myName.trim();
    const name = typed || s.players?.[index]?.name || `Player ${index + 1}`;
    setMyNameStored(typed);
    setLoading(true);
    try {
      const fresh = await db.GameSession.get(s.id).catch(() => s);
      const players = [...(fresh.players || [])];
      if (players[index]) players[index] = { ...players[index], name, claimed: true };
      await db.GameSession.update(s.id, { players });
    } catch (_) { /* joining still works; the name just won't sync */ }
    saveRecentGame({ code: s.code, game_mode: s.game_mode, playerIndex: index, playerName: name });
    navigate(createPageUrl(`PlayerView?code=${s.code}&playerIndex=${index}&playerName=${encodeURIComponent(name)}`));
  };

  // After creating: host picks their seat the same way a joiner does.
  useEffect(() => {
    if (!created) return;
    db.GameSession.filter({ code: created.code }).then((r) => {
      if (r?.[0]) { setJoinSession(r[0]); setMyIndex(0); }
    }).catch(() => {});
  }, [created]);

  const reset = () => { setMode(null); setCreated(null); setJoinSession(null); setError(''); };

  const seatGrid = joinSession && (
    <div className="grid grid-cols-2 gap-2">
      {(joinSession.players || []).map((p, i) => (
        <button key={i} onClick={() => setMyIndex(i)}
          className={`flex items-center gap-2 p-3 rounded-xl border text-left transition-colors ${myIndex === i ? 'border-gold/70 bg-gold/10' : 'border-white/10 bg-white/[0.04]'}`}>
          <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: accentOf(p.color, i) }} />
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">{p.name || `Player ${i + 1}`}</div>
            <div className="text-[10px] text-white/40">{p.claimed ? 'Taken' : 'Open'} · {p.life} life</div>
          </div>
        </button>
      ))}
    </div>
  );

  return (
    <div className="min-h-[100dvh] bg-arcane text-white">
      <div className="max-w-md mx-auto px-5 pb-12" style={{ paddingTop: 'max(28px, env(safe-area-inset-top))' }}>
        <AnimatePresence mode="wait">
          {/* ── Home ─────────────────────────────────────────────── */}
          {!mode && !created && (
            <motion.div key="home" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <img src={iconUrl} alt="" className="w-12 h-12 rounded-2xl shadow-[0_8px_30px_rgba(212,166,74,0.25)] flex-shrink-0" />
                  <div className="min-w-0">
                    <h1 className="font-display text-2xl leading-none tracking-wide">Commander&apos;s Edge</h1>
                    <p className="text-white/45 text-xs mt-1">Life, damage &amp; turns for your pod</p>
                  </div>
                </div>
                <span className={`flex-shrink-0 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border ${isCloud ? 'text-emerald-300 border-emerald-400/30 bg-emerald-400/10' : 'text-white/50 border-white/10 bg-white/5'}`}
                  title={isCloud ? 'Linked games sync between phones' : 'Data stays on this device'}>
                  {isCloud ? <Cloud className="w-3 h-3" /> : <CloudOff className="w-3 h-3" />}
                  {isCloud ? 'Online' : 'Offline'}
                </span>
              </div>

              {/* Primary action */}
              <div className="mt-8 rounded-3xl p-5 border border-gold/30 relative overflow-hidden"
                style={{ background: 'linear-gradient(160deg, rgba(212,166,74,0.18) 0%, rgba(124,58,237,0.10) 60%, rgba(255,255,255,0.02) 100%)' }}>
                <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full bg-gold/10 blur-2xl" />
                <p className="label-caps !text-gold/80">Play on one phone</p>
                <h2 className="font-display text-2xl mt-1">Life counter table</h2>
                <p className="text-white/60 text-sm mt-1">2–6 players around one phone. Tracks commander damage, poison, monarch and turn order, with undo.</p>
                <div className="flex gap-2 mt-4">
                  <Link to={createPageUrl('Table')} className="btn-gold flex-1 flex items-center justify-center gap-2 !py-3">
                    <Play className="w-4 h-4" /> {resumable ? 'Resume game' : 'New table'}
                  </Link>
                  {resumable && (
                    <div className="flex items-center text-[11px] text-white/50 px-1">
                      {resumable.players.length}p · T{resumable.turn.number || 0}
                    </div>
                  )}
                </div>
              </div>

              <p className="label-caps mt-8 mb-2">Each player on their own phone</p>
              <div className="space-y-2">
                <ModeCard icon={Link2} title="Create linked game" sub="Share a code; everyone tracks on their own phone" accent="#a78bfa" onClick={() => setMode('create')} />
                <ModeCard icon={ArrowRight} title="Join with a code" sub="Pick your seat in a friend's game" accent="#60a5fa" onClick={() => setMode('join')} />
                <ModeCard icon={Skull} title="Horde Commander" sub="Co-op against a self-running horde deck" accent="#f87171" onClick={() => setMode('horde')} />
                <ModeCard icon={Swords} title="1v1 remote duel" sub="Archidekt deck, live board, voice chat" accent="#fbbf24" to={createPageUrl('DuelLobby')} badge={isCloud ? null : 'Online'} />
              </div>

              {!isCloud && (
                <p className="text-white/35 text-[11px] mt-3 px-1 leading-relaxed">
                  Offline mode: linked games only sync between tabs on this device. Connect a Base44 backend to sync between phones (see the README).
                </p>
              )}

              <Link to={createPageUrl('Stats')} className="card-glass mt-6 flex items-center gap-3 p-3.5">
                <BarChart2 className="w-5 h-5 text-gold" />
                <div className="flex-1">
                  <div className="font-semibold text-sm">Game history &amp; leaderboard</div>
                  <div className="text-white/45 text-xs">{gamesPlayed ? `${gamesPlayed} game${gamesPlayed === 1 ? '' : 's'} recorded` : 'Wins and stats from your tables'}</div>
                </div>
                <Trophy className="w-4 h-4 text-white/25" />
              </Link>

              <RecentGames onJoin={handleRejoin} />
            </motion.div>
          )}

          {/* ── Create linked / horde ───────────────────────────── */}
          {(mode === 'create' || mode === 'horde') && !created && (
            <motion.div key="create" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              <BackBar onBack={reset}
                title={mode === 'horde' ? 'Horde Commander' : 'Linked game'}
                sub={mode === 'horde' ? 'Players share one life total against the Horde' : 'Everyone joins from their own phone'} />

              <div className="card-glass p-4 space-y-4">
                <div>
                  <p className="label-caps mb-2">{mode === 'horde' ? 'Players vs. the Horde' : 'Players'}</p>
                  <Segmented options={mode === 'horde' ? [1, 2, 3, 4] : [2, 3, 4, 5, 6]} value={playerCount} onChange={setPlayerCount}
                    accent={mode === 'horde' ? '#f87171' : '#a78bfa'} />
                </div>
                {mode === 'horde' && (
                  <div className="rounded-xl p-3 text-center bg-red-500/10 border border-red-400/25">
                    <p className="label-caps !text-red-200/70">Shared starting life</p>
                    <p className="font-display text-4xl text-red-100 mt-1">{calcHordeSharedLife(playerCount)}</p>
                    <p className="text-red-200/40 text-[11px]">100 − 15 per extra player (min 40)</p>
                  </div>
                )}
                <div>
                  <p className="label-caps mb-2">{mode === 'horde' ? 'Individual starting life' : 'Starting life'}</p>
                  <Segmented options={[20, 30, 40]} value={startingLife} onChange={setStartingLife}
                    accent={mode === 'horde' ? '#f87171' : '#a78bfa'} />
                </div>
                {mode === 'horde' && (
                  <HordeDeckSelector onSelect={setSelectedHordeDeck} selectedDeckId={selectedHordeDeck?.id || null} />
                )}
              </div>

              {error && <p className="text-red-300 text-sm text-center">{error}</p>}
              <button onClick={() => createGame(mode === 'horde')} disabled={loading} className="btn-gold w-full flex items-center justify-center gap-2">
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {mode === 'horde' ? 'Summon the Horde' : 'Create game'}
              </button>
            </motion.div>
          )}

          {/* ── Created ─────────────────────────────────────────── */}
          {created && (
            <motion.div key="created" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
              <BackBar onBack={reset} title="Game ready" sub="Share the code, then pick your seat" />
              <div className="card-glass p-5 text-center">
                <p className="label-caps">Join code</p>
                <p className="font-display text-5xl tracking-[0.2em] text-gold mt-2 select-all">{created.code}</p>
                <div className="flex justify-center gap-2 mt-4">
                  <button onClick={copyCode} className="chip gap-1.5">
                    {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />} {copied ? 'Copied' : 'Copy'}
                  </button>
                  <button onClick={share} className="chip gap-1.5"><Share2 className="w-4 h-4" /> Share link</button>
                </div>
              </div>

              <div className="card-glass p-4 space-y-3">
                <div>
                  <p className="label-caps mb-1.5">Your name</p>
                  <input value={myName} onChange={(e) => setMyName(e.target.value)} placeholder="Your name" maxLength={24} className="input-dark" />
                </div>
                <p className="label-caps">Your seat</p>
                {seatGrid || <Loader2 className="w-5 h-5 animate-spin text-white/40 mx-auto" />}
              </div>

              <button disabled={!joinSession || myIndex === null || loading} onClick={() => takeSeat(myIndex)}
                className="btn-gold w-full flex items-center justify-center gap-2">
                {loading && <Loader2 className="w-4 h-4 animate-spin" />} Take my seat
              </button>
              <Link
                to={createPageUrl(created.isHorde ? `HordeCommander?code=${created.code}` : `Scoreboard?code=${created.code}`)}
                className="btn-ghost w-full flex items-center justify-center gap-2">
                {created.isHorde ? <><Skull className="w-4 h-4" /> Open Horde board</> : <><BarChart2 className="w-4 h-4" /> Open shared scoreboard</>}
              </Link>
            </motion.div>
          )}

          {/* ── Join ────────────────────────────────────────────── */}
          {mode === 'join' && !created && (
            <motion.div key="join" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              <BackBar onBack={reset} title="Join a game" sub="Ask the host for their 6-letter code" />
              <div className="card-glass p-4 space-y-4">
                <div>
                  <p className="label-caps mb-1.5">Game code</p>
                  <input
                    value={joinCode}
                    onChange={(e) => { setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')); setJoinSession(null); setError(''); }}
                    onKeyDown={(e) => e.key === 'Enter' && joinCode.length >= 4 && findGame()}
                    placeholder="ABC123"
                    maxLength={6}
                    autoCapitalize="characters"
                    autoComplete="off"
                    className="input-dark text-center font-display text-2xl tracking-[0.3em]"
                  />
                </div>
                <div>
                  <p className="label-caps mb-1.5">Your name</p>
                  <input value={myName} onChange={(e) => setMyName(e.target.value)} placeholder="Your name" maxLength={24} className="input-dark" />
                </div>
                {joinSession && (
                  <div>
                    <p className="label-caps mb-1.5">Pick your seat</p>
                    {seatGrid}
                  </div>
                )}
              </div>
              {error && <p className="text-red-300 text-sm text-center">{error}</p>}
              {joinSession ? (
                <button onClick={() => takeSeat(myIndex)} disabled={loading || myIndex === null} className="btn-gold w-full flex items-center justify-center gap-2">
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />} Join as {myName.trim() || joinSession.players?.[myIndex]?.name}
                </button>
              ) : (
                <button onClick={findGame} disabled={loading || joinCode.length < 4} className="btn-gold w-full flex items-center justify-center gap-2">
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />} Find game
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
