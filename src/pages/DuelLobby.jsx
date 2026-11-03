import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Swords, Link, ArrowRight, Copy, Check, Shuffle } from 'lucide-react';
import { db, isCloud } from '@/api/backend';

// Without a server, Archidekt blocks deck links, so players paste their list.
// Pasted lists stay on this phone (keyed by game + seat), not in the shared game.
const RECENT_DECKS_KEY = 'ce_deckboard_recent_v1';
export const duelDeckKey = (code, idx) => `ce_duel_deck_${code}_${idx}`;
function recentPastedDecks() {
  try { return (JSON.parse(localStorage.getItem(RECENT_DECKS_KEY) || '[]') || []).filter((d) => d.text); } catch (_) { return []; }
}
function saveDuelDeck(code, idx, text) {
  try { if (text.trim()) localStorage.setItem(duelDeckKey(code, idx), text); } catch (_) { /* ignore */ }
}
import { createPageUrl } from '@/utils';
import { goTo } from '@/lib/nav';

function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function initDuelPlayer(index) {
  return {
    index,
    name: `Player ${index + 1}`,
    life: 20,
    poison: 0,
    deck_url: '',
    deck_name: '',
    color: index === 0 ? 'blue' : 'red',
    ready: false,
    library_count: 99,
    hand_count: 7,
    battlefield: [],
    graveyard: [],
    exile: [],
  };
}

export default function DuelLobby() {
  const [view, setView] = useState('home'); // home | create | join | matchmaking
  const [myName, setMyName] = useState('');
  const [deckUrl, setDeckUrl] = useState('');
  const [deckName, setDeckName] = useState('');
  const [deckText, setDeckText] = useState('');
  const recentDecks = React.useMemo(recentPastedDecks, []);
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdCode, setCreatedCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [matchmakingQueue, setMatchmakingQueue] = useState([]);
  const [searching, setSearching] = useState(false);

  const extractDeckName = (url) => {
    if (!url) return '';
    const match = url.match(/archidekt\.com\/decks\/(\d+)(?:\/([^/?]+))?/);
    if (match && match[2]) return decodeURIComponent(match[2].replace(/-/g, ' '));
    if (match) return `Deck #${match[1]}`;
    return 'My Deck';
  };

  const handleDeckUrlChange = (val) => {
    setDeckUrl(val);
    if (!deckName) setDeckName(extractDeckName(val));
  };

  const createGame = async () => {
    setLoading(true);
    setError('');
    const code = generateCode();
    const channelId = generateCode() + generateCode();
    const player0 = { ...initDuelPlayer(0), name: myName || 'Player 1', deck_url: deckUrl, deck_name: deckName || extractDeckName(deckUrl) || 'My Deck' };
    await db.DuelGame.create({
      code,
      status: 'waiting',
      starting_life: 20,
      current_turn: 0,
      turn_number: 1,
      turn_started_at: new Date().toISOString(),
      phase: 'main1',
      players: [player0, initDuelPlayer(1)],
      matchmaking: false,
      voice_channel_id: channelId,
      chat_log: [{ player_index: -1, player_name: 'System', message: `${player0.name} created the game.`, timestamp: new Date().toISOString(), type: 'system' }],
    });
    if (!isCloud) saveDuelDeck(code, 0, deckText);
    setCreatedCode(code);
    setLoading(false);
  };

  const joinGame = async () => {
    setLoading(true);
    setError('');
    const results = await db.DuelGame.filter({ code: joinCode.toUpperCase().trim() });
    if (!results || results.length === 0) { setError(isCloud ? 'Game not found.' : "Couldn't reach that duel. Check the code, and make sure your opponent has the duel open."); setLoading(false); return; }
    const game = results[0];
    if (game.status === 'ended') { setError('That game has ended.'); setLoading(false); return; }
    // Update player 1 slot
    const players = [...(game.players || [initDuelPlayer(0), initDuelPlayer(1)])];
    players[1] = { ...players[1], name: myName || 'Player 2', deck_url: deckUrl, deck_name: deckName || extractDeckName(deckUrl) || 'My Deck' };
    const chatLog = [...(game.chat_log || []), { player_index: -1, player_name: 'System', message: `${players[1].name} joined!`, timestamp: new Date().toISOString(), type: 'system' }];
    await db.DuelGame.update(game.id, { players, status: 'active', chat_log: chatLog });
    if (!isCloud) saveDuelDeck(game.code, 1, deckText);
    goTo(createPageUrl(`DuelGame?code=${game.code}&playerIndex=1`));
  };

  const enterMatchmaking = async () => {
    setSearching(true);
    // Look for an open matchmaking game
    const open = await db.DuelGame.filter({ matchmaking: true, status: 'waiting' }, '-created_date', 5);
    if (open && open.length > 0) {
      const game = open[0];
      const players = [...(game.players || [initDuelPlayer(0), initDuelPlayer(1)])];
      players[1] = { ...players[1], name: myName || 'Player 2', deck_url: deckUrl, deck_name: deckName || extractDeckName(deckUrl) || 'My Deck' };
      const chatLog = [...(game.chat_log || []), { player_index: -1, player_name: 'System', message: `${players[1].name} joined via matchmaking!`, timestamp: new Date().toISOString(), type: 'system' }];
      await db.DuelGame.update(game.id, { players, status: 'active', matchmaking: false, chat_log: chatLog });
      goTo(createPageUrl(`DuelGame?code=${game.code}&playerIndex=1`));
      return;
    }
    // Create a waiting game
    const code = generateCode();
    const channelId = generateCode() + generateCode();
    const player0 = { ...initDuelPlayer(0), name: myName || 'Player 1', deck_url: deckUrl, deck_name: deckName || extractDeckName(deckUrl) || 'My Deck' };
    await db.DuelGame.create({
      code, status: 'waiting', starting_life: 20, current_turn: 0, turn_number: 1,
      turn_started_at: new Date().toISOString(), phase: 'main1',
      players: [player0, initDuelPlayer(1)],
      matchmaking: true, voice_channel_id: channelId,
      chat_log: [{ player_index: -1, player_name: 'System', message: `${player0.name} is searching for an opponent...`, timestamp: new Date().toISOString(), type: 'system' }],
    });
    setCreatedCode(code);
    setView('waitingMatch');
    setSearching(false);
    // Subscribe for opponent joining
    const unsub = db.DuelGame.subscribe((event) => {
      if (event.type === 'update' && event.data?.code === code && event.data?.status === 'active') {
        unsub();
        goTo(createPageUrl(`DuelGame?code=${code}&playerIndex=0`));
      }
    });
  };

  const goToGame = () => {
    goTo(createPageUrl(`DuelGame?code=${createdCode}&playerIndex=0`));
  };

  const copyLink = () => {
    const url = `${window.location.origin}${window.location.pathname.split('/').slice(0,-1).join('/')}/${createPageUrl(`DuelGame?code=${createdCode}&playerIndex=1`)}`;
    navigator.clipboard.writeText(url).catch(() => {});
    navigator.clipboard.writeText(createdCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-amber-950/20 to-slate-950 flex flex-col items-center justify-center p-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-amber-500/30">
            <Swords className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-white text-2xl font-black">1v1 Remote Duel</h1>
          <p className="text-white/40 text-sm mt-1">Archidekt decks · Live board · Voice chat</p>
        </div>

        {/* HOME */}
        {view === 'home' && (
          <div className="space-y-3">
            <button onClick={() => setView('create')}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold text-lg active:scale-95 transition-transform shadow-lg shadow-amber-500/20">
              <Swords className="inline w-5 h-5 mr-2" />
              Create Duel
            </button>
            <button onClick={() => setView('join')}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold text-lg active:scale-95 transition-transform">
              <ArrowRight className="inline w-5 h-5 mr-2" />
              Join with Code
            </button>
            {isCloud && <button onClick={() => setView('matchmaking')}
              className="w-full py-4 rounded-2xl bg-white/10 border border-white/20 text-white font-bold text-lg active:scale-95 transition-transform">
              <Shuffle className="inline w-5 h-5 mr-2" />
              Find Random Opponent
            </button>}
            <button onClick={() => goTo(createPageUrl('Lobby'))}
              className="w-full text-white/30 text-sm py-2">← Back to Commander Lobby</button>
          </div>
        )}

        {/* CREATE */}
        {view === 'create' && !createdCode && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <h2 className="text-white font-bold text-lg text-center">Set Up Your Duel</h2>
            <div className="bg-white/8 border border-white/15 rounded-2xl p-4 space-y-4">
              <div>
                <label className="text-white/60 text-xs uppercase tracking-widest">Your Name</label>
                <input value={myName} onChange={e => setMyName(e.target.value)} placeholder="Your name"
                  className="mt-1.5 w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-amber-500" />
              </div>
              <div>
                {isCloud ? (
                  <>
                    <label className="text-white/60 text-xs uppercase tracking-widest">Archidekt Deck URL</label>
                    <input value={deckUrl} onChange={e => handleDeckUrlChange(e.target.value)} placeholder="https://archidekt.com/decks/..."
                      className="mt-1.5 w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-amber-500 text-sm" />
                    {deckName && <p className="text-amber-400/70 text-xs mt-1 flex items-center gap-1"><Link className="w-3 h-3" />{deckName}</p>}
                  </>
                ) : (
                  <>
                    <label className="text-white/60 text-xs uppercase tracking-widest">Your deck list</label>
                    {recentDecks.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {recentDecks.map(d => (
                          <button key={d.key} type="button" onClick={() => { setDeckText(d.text); setDeckName(d.name); }}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${deckName === d.name && deckText === d.text ? 'bg-amber-500/25 border-amber-400/60 text-amber-200' : 'bg-white/5 border-white/10 text-white/60'}`}>
                            {d.name}
                          </button>
                        ))}
                      </div>
                    )}
                    <textarea value={deckText} onChange={e => setDeckText(e.target.value)} rows={5}
                      placeholder={'Paste from Archidekt: deck menu → Export → Copy\n1x Meren of Clan Nel Toth [Commander]\n1 Sol Ring'}
                      autoCapitalize="off" autoCorrect="off" spellCheck={false}
                      className="mt-1.5 w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-white/25 focus:outline-none focus:border-amber-500 text-xs font-mono" />
                    <input value={deckName} onChange={e => setDeckName(e.target.value)} placeholder="Deck name (optional)"
                      className="mt-1.5 w-full bg-white/5 border border-white/15 rounded-xl px-4 py-2.5 text-white placeholder-white/25 focus:outline-none focus:border-amber-500 text-sm" />
                  </>
                )}
              </div>
            </div>
            <button onClick={createGame} disabled={loading}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold text-lg disabled:opacity-50 active:scale-95 transition-transform">
              {loading ? 'Creating...' : '⚔️ Create Duel'}
            </button>
            <button onClick={() => setView('home')} className="w-full text-white/30 text-sm py-2">← Back</button>
          </motion.div>
        )}

        {/* CREATED */}
        {createdCode && view !== 'waitingMatch' && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
            <h2 className="text-white font-bold text-lg text-center">Duel Created!</h2>
            <div className="bg-white/8 border border-white/15 rounded-2xl p-5 text-center">
              <p className="text-white/50 text-sm mb-1">Share this code with your opponent</p>
              <p className="text-amber-400 text-5xl font-black tracking-widest mb-3">{createdCode}</p>
              <button onClick={copyLink}
                className="flex items-center gap-2 mx-auto px-4 py-2 rounded-xl bg-white/10 text-white/70 text-sm active:bg-white/20">
                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Code Copied!' : 'Copy Code'}
              </button>
            </div>
            <p className="text-white/40 text-xs text-center">Game will start when your opponent joins with this code.</p>
            <button onClick={goToGame}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold text-lg active:scale-95 transition-transform">
              Enter Game Room →
            </button>
          </motion.div>
        )}

        {/* WAITING FOR MATCHMAKING */}
        {view === 'waitingMatch' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 text-center">
            <div className="w-16 h-16 rounded-full bg-amber-500/20 border-2 border-amber-500/40 flex items-center justify-center mx-auto">
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}>
                <Shuffle className="w-7 h-7 text-amber-400" />
              </motion.div>
            </div>
            <h2 className="text-white font-bold text-lg">Searching for Opponent...</h2>
            <p className="text-white/40 text-sm">You'll be auto-matched when someone else enters the queue.</p>
            <div className="bg-white/8 border border-white/15 rounded-xl p-3">
              <p className="text-white/50 text-xs">Your code: <span className="text-amber-400 font-black text-lg tracking-widest ml-1">{createdCode}</span></p>
              <p className="text-white/30 text-xs mt-1">Share it to play with a specific friend instead</p>
            </div>
            <button onClick={goToGame}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold active:scale-95 transition-transform">
              Enter Waiting Room
            </button>
          </motion.div>
        )}

        {/* JOIN */}
        {view === 'join' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <h2 className="text-white font-bold text-lg text-center">Join a Duel</h2>
            <div className="bg-white/8 border border-white/15 rounded-2xl p-4 space-y-4">
              <div>
                <label className="text-white/60 text-xs uppercase tracking-widest">Game Code</label>
                <input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} placeholder="ABC123"
                  maxLength={6}
                  className="mt-1.5 w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white text-xl font-black tracking-widest text-center focus:outline-none focus:border-amber-500" />
              </div>
              <div>
                <label className="text-white/60 text-xs uppercase tracking-widest">Your Name</label>
                <input value={myName} onChange={e => setMyName(e.target.value)} placeholder="Your name"
                  className="mt-1.5 w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-amber-500" />
              </div>
              <div>
                {isCloud ? (
                  <>
                    <label className="text-white/60 text-xs uppercase tracking-widest">Your Archidekt Deck URL</label>
                    <input value={deckUrl} onChange={e => handleDeckUrlChange(e.target.value)} placeholder="https://archidekt.com/decks/..."
                      className="mt-1.5 w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-amber-500 text-sm" />
                    {deckName && <p className="text-amber-400/70 text-xs mt-1 flex items-center gap-1"><Link className="w-3 h-3" />{deckName}</p>}
                  </>
                ) : (
                  <>
                    <label className="text-white/60 text-xs uppercase tracking-widest">Your deck list</label>
                    {recentDecks.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {recentDecks.map(d => (
                          <button key={d.key} type="button" onClick={() => { setDeckText(d.text); setDeckName(d.name); }}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${deckName === d.name && deckText === d.text ? 'bg-amber-500/25 border-amber-400/60 text-amber-200' : 'bg-white/5 border-white/10 text-white/60'}`}>
                            {d.name}
                          </button>
                        ))}
                      </div>
                    )}
                    <textarea value={deckText} onChange={e => setDeckText(e.target.value)} rows={5}
                      placeholder={'Paste from Archidekt: deck menu → Export → Copy\n1x Meren of Clan Nel Toth [Commander]\n1 Sol Ring'}
                      autoCapitalize="off" autoCorrect="off" spellCheck={false}
                      className="mt-1.5 w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-white/25 focus:outline-none focus:border-amber-500 text-xs font-mono" />
                    <input value={deckName} onChange={e => setDeckName(e.target.value)} placeholder="Deck name (optional)"
                      className="mt-1.5 w-full bg-white/5 border border-white/15 rounded-xl px-4 py-2.5 text-white placeholder-white/25 focus:outline-none focus:border-amber-500 text-sm" />
                  </>
                )}
              </div>
            </div>
            {error && <p className="text-red-400 text-sm text-center">{error}</p>}
            <button onClick={joinGame} disabled={loading || !joinCode}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold text-lg disabled:opacity-50 active:scale-95 transition-transform">
              {loading ? 'Joining...' : 'Join Duel →'}
            </button>
            <button onClick={() => setView('home')} className="w-full text-white/30 text-sm py-2">← Back</button>
          </motion.div>
        )}

        {/* MATCHMAKING SETUP */}
        {view === 'matchmaking' && !searching && !createdCode && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <h2 className="text-white font-bold text-lg text-center">Find a Random Opponent</h2>
            <div className="bg-white/8 border border-white/15 rounded-2xl p-4 space-y-4">
              <div>
                <label className="text-white/60 text-xs uppercase tracking-widest">Your Name</label>
                <input value={myName} onChange={e => setMyName(e.target.value)} placeholder="Your name"
                  className="mt-1.5 w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-amber-500" />
              </div>
              <div>
                {isCloud ? (
                  <>
                    <label className="text-white/60 text-xs uppercase tracking-widest">Your Archidekt Deck URL</label>
                    <input value={deckUrl} onChange={e => handleDeckUrlChange(e.target.value)} placeholder="https://archidekt.com/decks/..."
                      className="mt-1.5 w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-amber-500 text-sm" />
                    {deckName && <p className="text-amber-400/70 text-xs mt-1 flex items-center gap-1"><Link className="w-3 h-3" />{deckName}</p>}
                  </>
                ) : (
                  <>
                    <label className="text-white/60 text-xs uppercase tracking-widest">Your deck list</label>
                    {recentDecks.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {recentDecks.map(d => (
                          <button key={d.key} type="button" onClick={() => { setDeckText(d.text); setDeckName(d.name); }}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${deckName === d.name && deckText === d.text ? 'bg-amber-500/25 border-amber-400/60 text-amber-200' : 'bg-white/5 border-white/10 text-white/60'}`}>
                            {d.name}
                          </button>
                        ))}
                      </div>
                    )}
                    <textarea value={deckText} onChange={e => setDeckText(e.target.value)} rows={5}
                      placeholder={'Paste from Archidekt: deck menu → Export → Copy\n1x Meren of Clan Nel Toth [Commander]\n1 Sol Ring'}
                      autoCapitalize="off" autoCorrect="off" spellCheck={false}
                      className="mt-1.5 w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-white/25 focus:outline-none focus:border-amber-500 text-xs font-mono" />
                    <input value={deckName} onChange={e => setDeckName(e.target.value)} placeholder="Deck name (optional)"
                      className="mt-1.5 w-full bg-white/5 border border-white/15 rounded-xl px-4 py-2.5 text-white placeholder-white/25 focus:outline-none focus:border-amber-500 text-sm" />
                  </>
                )}
              </div>
            </div>
            <button onClick={enterMatchmaking} disabled={searching}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-purple-600 to-violet-600 text-white font-bold text-lg active:scale-95 transition-transform">
              <Shuffle className="inline w-5 h-5 mr-2" />
              Find Match
            </button>
            <button onClick={() => setView('home')} className="w-full text-white/30 text-sm py-2">← Back</button>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}