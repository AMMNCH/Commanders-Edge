import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, ChevronDown, User, X, Search, Play } from 'lucide-react';
import { parseArchidektDeck, fetchArchidektJson } from '@/lib/archidekt';
import { createPageUrl } from '@/utils';
import { pageHref } from '@/lib/nav';
import CardImage from './CardImage';
import CardZoom from './CardZoom';

const USERNAME_KEY = 'mtg_archidekt_username';

function loadUsername() {
  return localStorage.getItem(USERNAME_KEY) || '';
}

function saveUsername(u) {
  localStorage.setItem(USERNAME_KEY, u);
}

export default function ArchidektDeckPicker({ onDeckLoaded, onCardSelected, accentColor }) {
  const [username, setUsername] = useState(loadUsername);
  const [inputUsername, setInputUsername] = useState(loadUsername);
  const [decks, setDecks] = useState([]);
  const [selectedDeck, setSelectedDeck] = useState(null);
  const [deckCards, setDeckCards] = useState([]);
  const [loadingDecks, setLoadingDecks] = useState(false);
  const [loadingCards, setLoadingCards] = useState(false);
  const [error, setError] = useState('');
  const [cardSearch, setCardSearch] = useState('');
  const [showDecks, setShowDecks] = useState(false);
  const [zoomIndex, setZoomIndex] = useState(null);

  // Auto-load decks if username already saved
  useEffect(() => {
    if (username) fetchDecks(username);
  }, []);

  const fetchDecks = async (u) => {
    if (!u.trim()) return;
    setLoadingDecks(true);
    setError('');
    setDecks([]);
    setSelectedDeck(null);
    setDeckCards([]);
    try {
      // ownerUsername does an exact-match lookup (unlike owner which is fuzzy)
      const data = await fetchArchidektJson(`https://archidekt.com/api/decks/v3/?format=json&ownerUsername=${encodeURIComponent(u.trim())}&pageSize=100&page=1&orderBy=-updatedAt`);
      const allDecks = data.results || [];

      if (allDecks.length === 0) {
        throw new Error(`No public decks found for "${u.trim()}". Make sure the Archidekt username is correct and the decks are public.`);
      }

      setDecks(allDecks);
      saveUsername(u.trim());
      setUsername(u.trim());
      setShowDecks(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingDecks(false);
    }
  };

  const fetchDeckCards = async (deck) => {
    setSelectedDeck(deck);
    setLoadingCards(true);
    setDeckCards([]);
    setCardSearch('');
    try {
      const data = await fetchArchidektJson(`https://archidekt.com/api/decks/${deck.id}/?format=json`);
      // Same parser as the deck board, so images use Scryfall's real links.
      const cards = parseArchidektDeck(data).deck.cards
        .filter((c, i, arr) => arr.findIndex(x => x.name === c.name) === i);
      setDeckCards(cards);
      onDeckLoaded?.(cards);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingCards(false);
    }
  };

  const filteredCards = deckCards.filter(c =>
    c.name.toLowerCase().includes(cardSearch.toLowerCase())
  );

  return (
    <div className="mt-2 border border-white/10 rounded-2xl overflow-hidden bg-white/5">
      {/* Header / username row */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <User className="w-4 h-4 flex-shrink-0" style={{ color: accentColor }} />
        <input
          value={inputUsername}
          onChange={e => setInputUsername(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && fetchDecks(inputUsername)}
          placeholder="Archidekt username..."
          className="flex-1 bg-transparent text-white text-sm placeholder-white/30 focus:outline-none"
          style={{ WebkitUserSelect: 'text', userSelect: 'text' }}
        />
        <button
          onClick={() => fetchDecks(inputUsername)}
          disabled={loadingDecks}
          className="text-xs px-2 py-1 rounded-lg font-semibold flex-shrink-0"
          style={{ background: `${accentColor}33`, color: accentColor }}
        >
          {loadingDecks ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Load'}
        </button>
      </div>

      {error && <p className="text-red-400 text-xs px-3 pb-2">{error}</p>}

      {/* Deck list */}
      {decks.length > 0 && (
        <div className="border-t border-white/10">
          <button
            onClick={() => setShowDecks(v => !v)}
            className="w-full flex items-center justify-between px-3 py-2 text-white/60 text-xs font-semibold"
          >
            <span>{selectedDeck ? `📦 ${selectedDeck.name}` : `${decks.length} decks found`}</span>
            <ChevronDown className={`w-3 h-3 transition-transform ${showDecks ? 'rotate-180' : ''}`} />
          </button>

          <AnimatePresence>
            {showDecks && (
              <motion.div
                initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                className="overflow-hidden"
              >
                <div className="max-h-40 overflow-y-auto px-2 pb-2 space-y-1">
                  {decks.map(deck => (
                    <button
                      key={deck.id}
                      onClick={() => { fetchDeckCards(deck); setShowDecks(false); }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs transition-all flex items-center gap-2"
                      style={selectedDeck?.id === deck.id
                        ? { background: `${accentColor}22`, color: accentColor, border: `1px solid ${accentColor}44` }
                        : { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)' }}
                    >
                      <span className="flex-1 font-semibold truncate">{deck.name}</span>
                      <span className="text-white/30 flex-shrink-0">{deck.size} cards</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Card list from selected deck */}
      {loadingCards && (
        <div className="flex items-center justify-center py-4 gap-2 text-white/40 text-xs border-t border-white/10">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading cards...
        </div>
      )}

      {deckCards.length > 0 && (
        <div className="border-t border-white/10">
          <div className="px-2 pt-2 pb-1">
            <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-white/8">
              <Search className="w-3 h-3 text-white/30 flex-shrink-0" />
              <input
                value={cardSearch}
                onChange={e => setCardSearch(e.target.value)}
                placeholder={`Search ${deckCards.length} cards...`}
                className="flex-1 bg-transparent text-white text-xs placeholder-white/30 focus:outline-none"
                style={{ WebkitUserSelect: 'text', userSelect: 'text' }}
              />
              {cardSearch && (
                <button onClick={() => setCardSearch('')}>
                  <X className="w-3 h-3 text-white/30" />
                </button>
              )}
            </div>
          </div>
          <div className="px-2 pb-1 flex items-center justify-between">
            <span className="text-white/35 text-[10px]">Tap a card to view it large</span>
            {selectedDeck && (
              <a href={pageHref(createPageUrl(`DeckBoard?deck=${selectedDeck.id}`))}
                className="flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg"
                style={{ background: `${accentColor}22`, color: accentColor }}>
                <Play className="w-3 h-3" /> Play this deck
              </a>
            )}
          </div>
          <div className="max-h-72 overflow-y-auto px-2 pb-2 grid grid-cols-3 gap-1.5">
            {filteredCards.map((c, i) => (
              <button key={c.name} onClick={() => setZoomIndex(i)}
                className="text-left rounded-lg overflow-hidden active:scale-95 transition-transform">
                <CardImage card={c} className="w-full aspect-[63/88] rounded-lg" />
                <span className="block text-[10px] text-white/60 truncate mt-0.5 px-0.5">{c.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <AnimatePresence>
        {zoomIndex !== null && (
          <CardZoom
            cards={filteredCards}
            index={zoomIndex}
            onClose={() => setZoomIndex(null)}
            caption={(c) => [c.type, c.categories?.[0]].filter(Boolean).join(' · ')}
            actions={() => [{ label: 'Show to table', primary: true, onClick: (c) => onCardSelected(c.name) }]}
          />
        )}
      </AnimatePresence>
    </div>
  );
}