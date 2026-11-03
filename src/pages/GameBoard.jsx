import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, VolumeX, RotateCcw, Users, ChevronDown, Link2 } from 'lucide-react';
import { createPageUrl } from '@/utils';
import LifeCounter from '@/components/mtg/LifeCounter';
import CommanderDamage from '@/components/mtg/CommanderDamage';
import DiceRoller from '@/components/mtg/DiceRoller';
import CounterWidget from '@/components/mtg/CounterWidget';
import CounterMenu, { ALL_COUNTERS } from '@/components/mtg/CounterMenu';
import { initAudio } from '@/components/mtg/SoundEffects';
import CardShareModal from '@/components/mtg/CardShareModal';
import CardOverlay from '@/components/mtg/CardOverlay';

// MTG artwork background gradients (30 beautiful options)
const BG_GRADIENTS = [
  'linear-gradient(135deg, #0d0d2b 0%, #1a0533 40%, #0d1a2b 100%)',           // 1 Swamp
  'linear-gradient(135deg, #0a1628 0%, #0d3b6e 50%, #1a5276 100%)',           // 2 Island
  'linear-gradient(135deg, #1a0a00 0%, #5c2e00 50%, #8b4513 100%)',           // 3 Mountain
  'linear-gradient(135deg, #001a00 0%, #0d4d0d 50%, #1a6b1a 100%)',           // 4 Forest
  'linear-gradient(135deg, #2b2000 0%, #5c4800 50%, #8b6914 100%)',           // 5 Plains
  'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 40%, #2d1b4e 100%)',           // 6 Void
  'linear-gradient(135deg, #1a0520 0%, #4b0082 50%, #800080 100%)',           // 7 Vraska
  'linear-gradient(135deg, #001f3f 0%, #0059b3 50%, #00aaff 100%)',           // 8 Teferi
  'linear-gradient(135deg, #3d0000 0%, #8b0000 50%, #cc2200 100%)',           // 9 Chandra
  'linear-gradient(135deg, #002200 0%, #005500 50%, #00882b 100%)',           // 10 Nissa
  'linear-gradient(135deg, #1c1c00 0%, #4d4d00 50%, #999900 100%)',           // 11 Ajani
  'linear-gradient(135deg, #0d0d1a 0%, #1a1a2e 40%, #16213e 100%)',           // 12 Eldrazi
  'linear-gradient(135deg, #2d0000 0%, #660000 30%, #1a0033 100%)',           // 13 Rakdos
  'linear-gradient(135deg, #001a0d 0%, #003322 50%, #001133 100%)',           // 14 Simic
  'linear-gradient(135deg, #1a1400 0%, #403300 50%, #1a0d33 100%)',           // 15 Dimir
  'linear-gradient(135deg, #00001a 0%, #000d33 40%, #330066 100%)',           // 16 Azorius
  'linear-gradient(135deg, #1a0d00 0%, #4d2900 50%, #1a0d00 100%)',           // 17 Gruul
  'linear-gradient(135deg, #0d1a0d 0%, #1a3300 50%, #334d00 100%)',           // 18 Selesnya
  'linear-gradient(135deg, #1a000d 0%, #4d0026 50%, #00001a 100%)',           // 19 Orzhov
  'linear-gradient(135deg, #001a1a 0%, #003333 50%, #1a0033 100%)',           // 20 Golgari
  'linear-gradient(135deg, #0d0d0d 0%, #1a0000 30%, #000d1a 70%, #0d0d0d 100%)',// 21 Phyrexia
  'linear-gradient(135deg, #1a1400 0%, #332800 40%, #4d3c00 100%)',           // 22 Dominaria
  'linear-gradient(135deg, #00001a 0%, #000033 40%, #00001a 100%)',           // 23 Ravnica
  'linear-gradient(135deg, #0d0000 0%, #330000 40%, #000d0d 100%)',           // 24 Innistrad
  'linear-gradient(135deg, #001a33 0%, #003366 50%, #1a3300 100%)',           // 25 Zendikar
  'linear-gradient(135deg, #1a0026 0%, #4d0073 50%, #000d26 100%)',           // 26 Theros
  'linear-gradient(135deg, #2a1500 0%, #6b3500 50%, #2a0000 100%)',           // 27 Kaladesh
  'linear-gradient(135deg, #001a00 0%, #004d00 50%, #330033 100%)',           // 28 Kamigawa
  'linear-gradient(135deg, #00001a 0%, #001a1a 40%, #0d3300 100%)',           // 29 Ixalan
  'linear-gradient(135deg, #0d0d0d 0%, #262626 50%, #1a1a00 100%)',           // 30 Strixhaven
];

const BG_NAMES = [
  'Swamp','Island','Mountain','Forest','Plains','Void','Vraska','Teferi','Chandra','Nissa',
  'Ajani','Eldrazi','Rakdos','Simic','Dimir','Azorius','Gruul','Selesnya','Orzhov','Golgari',
  'Phyrexia','Dominaria','Ravnica','Innistrad','Zendikar','Theros','Kaladesh','Kamigawa','Ixalan','Strixhaven'
];

const PLAYER_COLORS = ['purple','blue','red','green','gold','white'];

export default function GameBoard() {
  const [resetKey, setResetKey] = useState(0);
  const [bgIndex, setBgIndex] = useState(0);
  const [showBgPicker, setShowBgPicker] = useState(false);
  const [playerCount, setPlayerCount] = useState(4);
  const [activeCounters, setActiveCounters] = useState([ALL_COUNTERS[0]]); // start with poison
  const [startingLife, setStartingLife] = useState(40);
  const [showCardShare, setShowCardShare] = useState(false);
  const [cardOverlay, setCardOverlay] = useState(null);

  useEffect(() => {
    const h = () => initAudio();
    document.addEventListener('touchstart', h, { once: true });
    document.addEventListener('click', h, { once: true });
    return () => {
      document.removeEventListener('touchstart', h);
      document.removeEventListener('click', h);
    };
  }, []);

  const addCounter = (counter) => {
    setActiveCounters(prev => [...prev, counter]);
  };

  const removeCounter = (id) => {
    setActiveCounters(prev => prev.filter(c => c.id !== id));
  };

  return (
    <div
      className="min-h-screen relative overflow-x-hidden"
      style={{ background: BG_GRADIENTS[bgIndex] }}
    >
      {/* Subtle noise overlay */}
      <div className="absolute inset-0 opacity-30 pointer-events-none" style={{
        backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'0.15\'/%3E%3C/svg%3E")',
        backgroundSize: '200px 200px'
      }} />

      {/* Header */}
      <header className="relative z-10 px-4 pt-safe-top">
        {/* Row 1: Logo + icon actions */}
        <div className="flex items-center justify-between py-2.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-4 h-4 text-yellow-400" />
            </div>
            <div>
              <h1 className="text-white font-bold text-sm leading-none">MTG Companion</h1>
              <p className="text-white/40 text-xs">Commander Edition</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowBgPicker(v => !v)}
              className="w-8 h-8 rounded-lg bg-white/10 border border-white/20 text-base flex items-center justify-center active:bg-white/20"
            >
              🎨
            </button>
            <a
              href={createPageUrl('Lobby')}
              className="w-8 h-8 rounded-lg bg-white/10 border border-white/20 active:bg-white/20 flex items-center justify-center"
            >
              <Link2 className="w-4 h-4 text-white/70" />
            </a>
            <button
              onClick={() => setResetKey(k => k + 1)}
              className="w-8 h-8 rounded-lg bg-white/10 border border-white/20 active:bg-white/20 flex items-center justify-center"
            >
              <RotateCcw className="w-4 h-4 text-white/70" />
            </button>
          </div>
        </div>

        {/* Row 2: Game settings */}
        <div className="flex items-center gap-2 pb-2">
          {/* Player count */}
          <div className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-white/10 border border-white/20 flex-shrink-0">
            <Users className="w-3 h-3 text-white/50" />
            <button onClick={() => setPlayerCount(p => Math.max(2, p - 1))} className="text-white/70 text-sm w-5 h-5 flex items-center justify-center">−</button>
            <span className="text-white font-bold text-sm w-4 text-center">{playerCount}</span>
            <button onClick={() => setPlayerCount(p => Math.min(6, p + 1))} className="text-white/70 text-sm w-5 h-5 flex items-center justify-center">+</button>
          </div>
          {/* Life total */}
          <div className="flex items-center gap-0.5 px-2 py-1.5 rounded-lg bg-white/10 border border-white/20 flex-shrink-0">
            <span className="text-white/40 text-xs mr-1">♥</span>
            <button onClick={() => setStartingLife(20)} className={`text-xs px-1.5 py-0.5 rounded ${startingLife===20?'bg-white/20 text-white font-bold':'text-white/40'}`}>20</button>
            <button onClick={() => setStartingLife(40)} className={`text-xs px-1.5 py-0.5 rounded ${startingLife===40?'bg-white/20 text-white font-bold':'text-white/40'}`}>40</button>
          </div>
        </div>

        {/* Background Picker */}
        <AnimatePresence>
          {showBgPicker && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mb-2"
            >
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {BG_GRADIENTS.map((grad, i) => (
                  <button
                    key={i}
                    onClick={() => { setBgIndex(i); setShowBgPicker(false); }}
                    className={`flex-shrink-0 w-16 h-10 rounded-lg border-2 transition-all ${bgIndex === i ? 'border-white scale-105' : 'border-transparent opacity-70'}`}
                    style={{ background: grad }}
                    title={BG_NAMES[i]}
                  >
                    <span className="text-white/60 text-xs">{i+1}</span>
                  </button>
                ))}
              </div>
              <div className="text-center text-white/50 text-xs pb-1">{BG_NAMES[bgIndex]}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Main */}
      <main key={resetKey} className="relative z-10 px-4 pb-8 space-y-3">

        {/* Life Counters Grid */}
        <div className={`grid gap-3 ${playerCount <= 2 ? 'grid-cols-1' : playerCount <= 4 ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-3'}`}>
          {Array.from({ length: playerCount }).map((_, i) => (
            <LifeCounter
              key={`player-${i}`}
              playerName={`Player ${i + 1}`}
              startingLife={startingLife}
              colorKey={PLAYER_COLORS[i % PLAYER_COLORS.length]}
              index={i}
            />
          ))}
        </div>

        {/* Commander Damage */}
        <CommanderDamage playerCount={playerCount} />

        {/* Active Counters */}
        {activeCounters.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {activeCounters.map(counter => (
              <CounterWidget
                key={counter.id}
                counter={counter}
                onRemove={() => removeCounter(counter.id)}
              />
            ))}
          </div>
        )}

        {/* Counter menu */}
        <div className="flex justify-center">
          <CounterMenu
            activeIds={activeCounters.map(c => c.id)}
            onAdd={addCounter}
          />
        </div>

        {/* Card Lookup */}
        <button
          onClick={() => setShowCardShare(true)}
          className="w-full py-2.5 rounded-xl bg-white/10 border border-white/15 text-white/60 text-sm flex items-center justify-center gap-2"
        >
          🃏 Card Lookup
        </button>

        {/* Dice Roller */}
        <DiceRoller />
      </main>

      <div className="h-safe-bottom" />

      {/* Card Share Modal */}
      <AnimatePresence>
        {showCardShare && (
          <CardShareModal
            onClose={() => setShowCardShare(false)}
            onSend={(card) => { setCardOverlay(card); setShowCardShare(false); }}
            playerName="Host"
            playerIndex={-1}
            accentColor="#a855f7"
          />
        )}
      </AnimatePresence>

      {/* Card Overlay */}
      {cardOverlay && (
        <CardOverlay card={cardOverlay} onDismiss={() => setCardOverlay(null)} />
      )}
    </div>
  );
}