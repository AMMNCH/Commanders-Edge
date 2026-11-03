import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Users, Plus, ArrowRight, Copy, Check, Skull, Swords } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import RecentGames, { saveRecentGame } from '@/components/lobby/RecentGames';
import HordeDeckSelector from '@/components/horde/HordeDeckSelector';

const PLAYER_COLORS = ['purple','blue','red','green','gold','white'];

function calcHordeSharedLife(playerCount) {
  return Math.max(40, 100 - (playerCount - 1) * 15);
}

function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function initPlayers(count, life) {
  return Array.from({ length: count }, (_, i) => ({
    index: i,
    name: `Player ${i + 1}`,
    life,
    poison: 0,
    played_land: false,
    commander_damage: {},
    color: PLAYER_COLORS[i % PLAYER_COLORS.length],
    reminder: '',
  }));
}

export default function Lobby() {
  const [mode, setMode] = useState(null); // 'create' | 'join' | 'solo' | 'horde'
  
  const handleRejoin = (recentGame) => {
    const { code, game_mode, playerIndex, playerName } = recentGame;
    if (game_mode === 'horde_commander') {
      window.location.href = createPageUrl(`HordeCommander?code=${code}`);
    } else {
      window.location.href = createPageUrl(`PlayerView?code=${code}&playerIndex=${playerIndex}&playerName=${encodeURIComponent(playerName || 'Player 1')}`);
    }
  };
  const [playerCount, setPlayerCount] = useState(4);
  const [startingLife, setStartingLife] = useState(40);
  const [joinCode, setJoinCode] = useState('');
  const [myName, setMyName] = useState('');
  const [myIndex, setMyIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [createdCode, setCreatedCode] = useState('');
  const [createdIsHorde, setCreatedIsHorde] = useState(false);
  const [selectedHordeDeck, setSelectedHordeDeck] = useState(null); // HordeDeck entity or null (random)

  const goSolo = () => {
    window.location.href = createPageUrl('GameBoard');
  };

  const createGame = async (isHorde = false) => {
    setLoading(true);
    setError('');
    const code = generateCode();
    const life = isHorde ? startingLife : startingLife;
    const sharedLife = isHorde ? calcHordeSharedLife(playerCount) : null;
    await base44.entities.GameSession.create({
      code,
      game_mode: isHorde ? 'horde_commander' : 'commander',
      player_count: playerCount,
      starting_life: life,
      current_turn_player: 0,
      turn_started_at: new Date().toISOString(),
      turn_number: 1,
      status: 'active',
      players: initPlayers(playerCount, life),
      ...(isHorde ? {
        shared_life_total: sharedLife,
        horde_library_size: selectedHordeDeck ? selectedHordeDeck.card_count : 100,
        horde_graveyard_size: 0,
        horde_board_state: [],
        horde_wave_log: [],
        horde_deck_id: selectedHordeDeck?.id || null,
      } : {}),
    });
    setCreatedCode(code);
    setCreatedIsHorde(isHorde);
    setLoading(false);
    saveRecentGame({ code, game_mode: isHorde ? 'horde_commander' : 'commander', playerIndex: 0, playerName: 'Player 1' });
  };

  const copyCode = () => {
    navigator.clipboard.writeText(createdCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const joinGame = async () => {
    setLoading(true);
    setError('');
    const results = await base44.entities.GameSession.filter({ code: joinCode.toUpperCase().trim() });
    if (!results || results.length === 0) {
      setError('Game not found. Check the code.');
      setLoading(false);
      return;
    }
    const session = results[0];
    saveRecentGame({ code: session.code, game_mode: session.game_mode, playerIndex: myIndex, playerName: myName || `Player ${myIndex + 1}` });
    window.location.href = createPageUrl(`PlayerView?code=${session.code}&playerIndex=${myIndex}&playerName=${encodeURIComponent(myName || 'Player ' + (myIndex + 1))}`);
  };

  const goToPlayerView = (idx) => {
    window.location.href = createPageUrl(`PlayerView?sessionId=NEW&playerIndex=${idx}&playerName=${encodeURIComponent(myName || 'Player ' + (idx + 1))}&code=${createdCode}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 flex flex-col items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center mx-auto mb-3">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-white text-2xl font-black">MTG Companion</h1>
          <p className="text-white/40 text-sm">Commander Edition</p>
        </div>

        {/* Mode selection */}
        {!mode && !createdCode && (
          <div className="space-y-3">

            <button
              onClick={goSolo}
              className="w-full py-4 rounded-2xl bg-white/10 border border-white/20 text-white font-bold text-lg active:scale-95 transition-transform"
            >
              🃏 Solo / Pass-and-Play
            </button>
            <button
              onClick={() => setMode('create')}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-purple-600 to-violet-600 text-white font-bold text-lg active:scale-95 transition-transform"
            >
              <Plus className="inline w-5 h-5 mr-2" />
              Create Linked Game
            </button>
            <button
              onClick={() => setMode('horde')}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-red-700 to-rose-800 text-white font-bold text-lg active:scale-95 transition-transform border border-red-600/40"
            >
              <Skull className="inline w-5 h-5 mr-2" />
              Horde Commander
            </button>
            <button
              onClick={() => setMode('join')}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold text-lg active:scale-95 transition-transform"
            >
              <ArrowRight className="inline w-5 h-5 mr-2" />
              Join Game with Code
            </button>
            <div className="h-px bg-white/10 my-1" />
            <button
              onClick={() => window.location.href = createPageUrl('DuelLobby')}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold text-lg active:scale-95 transition-transform shadow-lg shadow-amber-500/15"
            >
              <Swords className="inline w-5 h-5 mr-2" />
              ⚔️ 1v1 Remote Duel
            </button>
          </div>
        )}

        {!mode && !createdCode && <RecentGames onJoin={handleRejoin} />}

        {/* Horde Commander Setup */}
        {mode === 'horde' && !createdCode && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div className="text-center">
              <h2 className="text-white font-bold text-lg">Horde Commander Setup</h2>
              <p className="text-white/40 text-xs mt-1">Players share one life pool vs. the Horde</p>
            </div>

            <div className="bg-white/10 border border-white/20 rounded-2xl p-4 space-y-4">
              <div>
                <label className="text-white/60 text-sm">Players (vs Horde)</label>
                <div className="flex items-center gap-3 mt-1">
                  {[1,2,3,4].map(n => (
                    <button key={n} onClick={() => setPlayerCount(n)}
                      className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${playerCount===n ? 'bg-red-700 text-white' : 'bg-white/10 text-white/50'}`}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div className="bg-red-950/40 border border-red-800/40 rounded-xl p-3 text-center">
                <p className="text-red-300/70 text-xs mb-1">Shared Starting Life</p>
                <p className="text-red-200 font-black text-3xl">{calcHordeSharedLife(playerCount)}</p>
                <p className="text-red-400/50 text-xs">100 – {playerCount > 1 ? `(${playerCount-1} × 15)` : '0'}</p>
              </div>

              <HordeDeckSelector
                onSelect={setSelectedHordeDeck}
                selectedDeckId={selectedHordeDeck?.id || null}
              />

              <div>
                <label className="text-white/60 text-sm">Individual Starting Life</label>
                <div className="flex gap-3 mt-1">
                  {[20,40].map(l => (
                    <button key={l} onClick={() => setStartingLife(l)}
                      className={`flex-1 py-2 rounded-lg font-bold transition-all ${startingLife===l ? 'bg-red-700 text-white' : 'bg-white/10 text-white/50'}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button onClick={() => createGame(true)} disabled={loading}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-red-700 to-rose-800 text-white font-bold text-lg disabled:opacity-50 active:scale-95 transition-transform">
              {loading ? 'Creating...' : '💀 Start Horde Game'}
            </button>
            <button onClick={() => setMode(null)} className="w-full text-white/40 text-sm py-2">← Back</button>
          </motion.div>
        )}

        {/* Create Game */}
        {mode === 'create' && !createdCode && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <h2 className="text-white font-bold text-lg text-center">New Game Settings</h2>

            <div className="bg-white/10 border border-white/20 rounded-2xl p-4 space-y-4">
              <div>
                <label className="text-white/60 text-sm">Players</label>
                <div className="flex items-center gap-3 mt-1">
                  {[2,3,4,5,6].map(n => (
                    <button
                      key={n}
                      onClick={() => setPlayerCount(n)}
                      className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${playerCount===n ? 'bg-purple-600 text-white' : 'bg-white/10 text-white/50'}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-white/60 text-sm">Starting Life</label>
                <div className="flex gap-3 mt-1">
                  {[20,40].map(l => (
                    <button
                      key={l}
                      onClick={() => setStartingLife(l)}
                      className={`flex-1 py-2 rounded-lg font-bold transition-all ${startingLife===l ? 'bg-purple-600 text-white' : 'bg-white/10 text-white/50'}`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={() => createGame(false)}
              disabled={loading}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-purple-600 to-violet-600 text-white font-bold text-lg disabled:opacity-50 active:scale-95 transition-transform"
            >
              {loading ? 'Creating...' : 'Create Game'}
            </button>
            <button onClick={() => setMode(null)} className="w-full text-white/40 text-sm py-2">← Back</button>
          </motion.div>
        )}

        {/* Created — show code + player links */}
        {createdCode && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
            <h2 className="text-white font-bold text-lg text-center">Game Created!</h2>
            <div className="bg-white/10 border border-white/20 rounded-2xl p-5 text-center">
              <p className="text-white/50 text-sm mb-1">Join Code</p>
              <p className="text-white text-5xl font-black tracking-widest mb-3">{createdCode}</p>
              <button onClick={copyCode} className="flex items-center gap-2 mx-auto px-4 py-2 rounded-xl bg-white/10 text-white/70 text-sm active:bg-white/20">
                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy Code'}
              </button>
            </div>

            <p className="text-white/50 text-sm text-center">Tap your player slot below to open your view:</p>
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: playerCount }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => goToPlayerView(i)}
                  className="py-3 rounded-xl bg-white/10 border border-white/20 text-white font-semibold active:scale-95 transition-transform"
                >
                  Player {i + 1}
                </button>
              ))}
            </div>

            {createdIsHorde ? (
              <a
                href={createPageUrl(`HordeCommander?code=${createdCode}`)}
                className="block w-full py-3 rounded-xl bg-red-700/40 border border-red-600/50 text-red-200 font-semibold text-center active:scale-95 transition-transform"
              >
                💀 Open Horde Board
              </a>
            ) : (
              <a
                href={createPageUrl(`Scoreboard?code=${createdCode}`)}
                className="block w-full py-3 rounded-xl bg-amber-600/30 border border-amber-500/40 text-amber-300 font-semibold text-center active:scale-95 transition-transform"
              >
                📊 Open Scoreboard
              </a>
            )}
          </motion.div>
        )}

        {/* Join Game */}
        {mode === 'join' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <h2 className="text-white font-bold text-lg text-center">Join Game</h2>
            <div className="bg-white/10 border border-white/20 rounded-2xl p-4 space-y-3">
              <div>
                <label className="text-white/60 text-sm">Game Code</label>
                <input
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="ABC123"
                  maxLength={6}
                  className="mt-1 w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white text-xl font-black tracking-widest text-center focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="text-white/60 text-sm">Your Name (optional)</label>
                <input
                  value={myName}
                  onChange={e => setMyName(e.target.value)}
                  placeholder="Player name"
                  className="mt-1 w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="text-white/60 text-sm">Your Seat</label>
                <div className="flex gap-2 mt-1">
                  {[0,1,2,3,4,5].map(i => (
                    <button
                      key={i}
                      onClick={() => setMyIndex(i)}
                      className={`flex-1 py-2 rounded-lg text-sm font-bold ${myIndex===i ? 'bg-purple-600 text-white' : 'bg-white/10 text-white/50'}`}
                    >
                      {i+1}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {error && <p className="text-red-400 text-sm text-center">{error}</p>}
            <button
              onClick={joinGame}
              disabled={loading || !joinCode}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold text-lg disabled:opacity-50 active:scale-95 transition-transform"
            >
              {loading ? 'Joining...' : 'Join Game →'}
            </button>
            <button onClick={() => setMode(null)} className="w-full text-white/40 text-sm py-2">← Back</button>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}