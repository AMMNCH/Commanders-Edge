import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Loader2, Sparkles, Swords } from 'lucide-react';
import { db } from '@/api/backend';
import HordeAttackModal from '@/components/horde/HordeAttackModal';

// Scryfall random card fallback (no deck selected)
const HORDE_SEARCH_QUERIES = [
  'type:zombie','type:skeleton','type:horror','type:demon',
  'type:insect','type:beast t:creature','type:spirit','type:vampire',
];

async function fetchRandomHordeCard() {
  const query = HORDE_SEARCH_QUERIES[Math.floor(Math.random() * HORDE_SEARCH_QUERIES.length)];
  const res = await fetch(`https://api.scryfall.com/cards/random?q=${encodeURIComponent(query + ' format:commander')}`);
  if (!res.ok) throw new Error('Failed to fetch');
  const card = await res.json();
  return {
    id: Date.now().toString() + Math.random(),
    name: card.name,
    image_url: card.image_uris?.normal || card.card_faces?.[0]?.image_uris?.normal || null,
    power: parseInt(card.power) || 2,
    toughness: parseInt(card.toughness) || 2,
    has_haste: true,
    is_goaded: true,
    is_defender: (card.oracle_text || '').toLowerCase().includes('defender'),
    is_token: false,
    tapped: false,
  };
}

// Draw a card from a shuffled deck (stored in session ref as deck pool)
function drawFromDeck(deckCards, drawnCountRef) {
  if (!deckCards || deckCards.length === 0) return null;
  // Expand quantities into individual cards
  if (!drawnCountRef._expanded) {
    const expanded = [];
    for (const c of deckCards) {
      if (c.is_token) continue; // tokens are spawned, not drawn
      for (let i = 0; i < (c.quantity || 1); i++) {
        expanded.push({ ...c });
      }
    }
    // Shuffle
    for (let i = expanded.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [expanded[i], expanded[j]] = [expanded[j], expanded[i]];
    }
    drawnCountRef._expanded = expanded;
    drawnCountRef._idx = 0;
  }
  const idx = drawnCountRef._idx || 0;
  if (idx >= drawnCountRef._expanded.length) return null;
  drawnCountRef._idx = idx + 1;
  const raw = drawnCountRef._expanded[idx];
  return {
    id: Date.now().toString() + Math.random(),
    name: raw.name,
    image_url: raw.image_url || null,
    power: parseInt(raw.power) || 2,
    toughness: parseInt(raw.toughness) || 2,
    has_haste: raw.has_haste || false,
    is_goaded: true,
    is_defender: raw.is_defender || false,
    is_token: false,
    tapped: false,
    card_type: raw.type || '',
    mana_cost: raw.mana_cost || '',
  };
}

export default function HordeTurnPanel({ session, onWaveComplete, isHordeTurn, onAttackResolved }) {
  const [waveCards, setWaveCards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [waveRunning, setWaveRunning] = useState(false);
  const [showAttack, setShowAttack] = useState(false);
  const [deckCards, setDeckCards] = useState(null); // loaded HordeDeck cards
  const autoTriggeredRef = React.useRef(false);
  const drawnCountRef = React.useRef({});

  // Load horde deck if a deck_id is set on the session
  React.useEffect(() => {
    const deckId = session?.horde_deck_id;
    if (deckId && !deckCards) {
      db.HordeDeck.list().then(all => {
        const found = all.find(d => d.id === deckId);
        if (found) setDeckCards(found.cards || []);
      }).catch(() => {});
    }
    if (!deckId) {
      setDeckCards(null);
      drawnCountRef.current = {};
    }
  }, [session?.horde_deck_id]);

  // Reset when it's no longer the horde's turn
  React.useEffect(() => {
    if (!isHordeTurn) {
      autoTriggeredRef.current = false;
      setWaveCards([]);
      setWaveRunning(false);
    }
  }, [isHordeTurn]);

  const triggerWave = async () => {
    setLoading(true);
    setWaveRunning(true);
    setWaveCards([]);

    const revealed = [];
    let waveCount = 0;
    const maxCards = session?.horde_library_size || 0;
    const usingDeck = deckCards && deckCards.length > 0;

    while (waveCount < maxCards) {
      try {
        let card;
        if (usingDeck) {
          card = drawFromDeck(deckCards, drawnCountRef.current);
          if (!card) break; // deck exhausted
          // Deck mode: non-creature cards are spells that trigger effects but don't go to board as creatures
          // We still reveal them; the wave continues through non-creatures, stops on creatures
        } else {
          card = await fetchRandomHordeCard();
        }
        revealed.push(card);
        setWaveCards([...revealed]);
        waveCount++;
        await new Promise(r => setTimeout(r, 600));

        if (usingDeck) {
          // In deck mode, stop after revealing a creature (or max 5 non-creatures)
          const isCreature = (card.card_type || '').toLowerCase().includes('creature');
          if (isCreature || waveCount >= 5) break;
        } else {
          // Random mode: probabilistic stop
          const stopChance = waveCount >= 1 ? 0.35 + waveCount * 0.15 : 0;
          if (Math.random() < stopChance || waveCount >= 5) break;
        }
      } catch {
        break;
      }
    }

    setLoading(false);
    onWaveComplete(revealed, waveCount);
  };

  const clearWave = () => {
    setWaveCards([]);
    setWaveRunning(false);
  };

  const handleAttackResolved = (result) => {
    setShowAttack(false);
    onAttackResolved(result);
  };

  const creatures = session?.horde_board_state || [];

  return (
    <div>
      {showAttack && (
        <HordeAttackModal
          creatures={creatures}
          sharedLife={session?.shared_life_total ?? 0}
          onResolve={handleAttackResolved}
          onClose={() => setShowAttack(false)}
        />
      )}
      <div className={`rounded-2xl border p-4 transition-all ${isHordeTurn ? 'bg-red-950/50 border-red-600/60' : 'bg-slate-900/40 border-white/10'}`}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Zap className={`w-4 h-4 ${isHordeTurn ? 'text-red-400 animate-pulse' : 'text-white/30'}`} />
          <span className={`font-bold text-sm ${isHordeTurn ? 'text-red-200' : 'text-white/50'}`}>
            {isHordeTurn ? '⚠️ HORDE TURN' : 'Horde Turn'}
          </span>
        </div>
        {session?.horde_deck_id && (
          <span className="text-[9px] text-green-400/60 font-semibold uppercase tracking-wider">
            {deckCards ? `${deckCards.filter(c => !c.is_token).reduce((s,c) => s + (c.quantity||1), 0)}cd deck` : 'loading deck...'}
          </span>
        )}
      </div>

      {isHordeTurn && (
        <div className="space-y-2">
          {!waveRunning && (
            <button
              onClick={triggerWave}
              disabled={loading || (session?.horde_library_size || 0) <= 0}
              className="w-full py-3 rounded-xl font-black text-base flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #dc2626cc, #991b1bcc)', color: '#fff' }}
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
              Trigger Wave
            </button>
          )}
          {creatures.filter(c => !c.tapped && !c.is_defender).length > 0 && (
            <button
              onClick={() => setShowAttack(true)}
              className="w-full py-2.5 rounded-xl font-black text-sm flex items-center justify-center gap-2 active:scale-95 transition-all bg-orange-900/40 border border-orange-600/50 text-orange-200"
            >
              <Swords className="w-4 h-4" />
              Attack Phase ({creatures.filter(c => !c.tapped && !c.is_defender).length} attacking)
            </button>
          )}
        </div>
      )}

      {/* Wave cards display */}
      <AnimatePresence>
        {waveCards.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 space-y-2">
            <p className="text-red-300/70 text-xs font-semibold uppercase tracking-wider">
              Wave Reveals ({waveCards.length} card{waveCards.length !== 1 ? 's' : ''})
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {waveCards.map((card, i) => {
                const isSpell = card.card_type && !card.card_type.toLowerCase().includes('creature');
                return (
                  <motion.div
                    key={card.id}
                    initial={{ opacity: 0, scale: 0.8, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className={`flex-shrink-0 w-20 rounded-lg overflow-hidden border ${isSpell ? 'border-yellow-600/50' : 'border-red-700/40'}`}
                  >
                    {card.image_url
                      ? (
                        <div className="relative">
                          <img src={card.image_url} alt={card.name} className="w-full" />
                          {isSpell && (
                            <div className="absolute bottom-0 left-0 right-0 bg-yellow-900/80 text-yellow-200 text-[8px] font-bold text-center py-0.5">
                              {card.card_type}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="w-full h-28 bg-red-900/40 flex flex-col items-center justify-center p-1 gap-1">
                          <span className="text-white/60 text-[9px] text-center leading-tight">{card.name}</span>
                          {card.power ? (
                            <span className="text-red-300 text-xs font-black">{card.power}/{card.toughness}</span>
                          ) : (
                            <span className="text-yellow-400 text-[8px]">{card.card_type}</span>
                          )}
                        </div>
                      )
                    }
                  </motion.div>
                );
              })}
            </div>
            <div className="flex gap-2">
              <button onClick={clearWave}
                className="flex-1 py-2 rounded-xl bg-white/5 border border-white/10 text-white/50 text-sm active:bg-white/10">
                Clear Wave
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </div>
  );
}