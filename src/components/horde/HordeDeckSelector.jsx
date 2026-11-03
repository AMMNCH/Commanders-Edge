import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { Skull, Plus, Link, Loader2, ChevronRight, Check, ExternalLink, Trash2, X } from 'lucide-react';

// The 5 known Archidekt horde decks from wadledo's folder
const PREBUILT_DECKS = [
  { id: 488879,  name: 'Zombie Horde',       views: '3.5k', image: 'https://storage.googleapis.com/archidekt-card-images/m14/073f81e8-8c0c-4430-bd3e-95ed3625340f_art_crop.jpg', tags: ['zombie'] },
  { id: 489754,  name: 'Rise of the Robots',  views: '2.1k', image: 'https://storage.googleapis.com/archidekt-card-images/mbs/7928bb14-7631-4830-a756-26d1ea832ba2_art_crop.jpg', tags: ['artifact'] },
  { id: 489168,  name: 'Vampire Horde',       views: '2.0k', image: 'https://storage.googleapis.com/archidekt-card-images/5dn/754f202f-4f08-4c39-9219-1114d8508788_art_crop.jpg', tags: ['vampire'] },
  { id: 665698,  name: 'Soldier Horde',       views: '1.7k', image: 'https://storage.googleapis.com/archidekt-card-images/c14/10744088-b028-43aa-8a77-cd2a430fbfb6_art_crop.jpg', tags: ['soldier'] },
  { id: 489022,  name: 'Minotaur Horde',      views: '1.6k', image: 'https://storage.googleapis.com/archidekt-card-images/jou/333ff270-4bc7-48ee-9738-f8c70b8a7e40_art_crop.jpg', tags: ['minotaur'] },
];

export default function HordeDeckSelector({ onSelect, selectedDeckId }) {
  const [storedDecks, setStoredDecks] = useState([]);
  const [loadingId, setLoadingId] = useState(null);
  const [importUrl, setImportUrl] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState('');

  useEffect(() => {
    base44.entities.HordeDeck.list('-view_count', 50).then(setStoredDecks).catch(() => {});
  }, []);

  const isStored = (archidektId) => storedDecks.some(d => d.archidekt_id === archidektId);
  const getStored = (archidektId) => storedDecks.find(d => d.archidekt_id === archidektId);

  const importDeck = async (archidektId) => {
    setLoadingId(archidektId);
    const { data } = await base44.functions.invoke('fetchArchidektDeck', { deck_id: archidektId });
    if (data?.deck) {
      const saved = await base44.entities.HordeDeck.create(data.deck);
      setStoredDecks(prev => [saved, ...prev]);
      onSelect(saved);
    }
    setLoadingId(null);
  };

  const importCustomDeck = async () => {
    setImportError('');
    if (!importUrl.includes('archidekt.com/decks/')) {
      setImportError('Please paste a valid Archidekt deck URL');
      return;
    }
    setImportLoading(true);
    const { data } = await base44.functions.invoke('fetchArchidektDeck', { deck_url: importUrl });
    if (data?.deck) {
      const saved = await base44.entities.HordeDeck.create(data.deck);
      setStoredDecks(prev => [saved, ...prev]);
      onSelect(saved);
      setShowImport(false);
      setImportUrl('');
    } else {
      setImportError(data?.error || 'Failed to import deck');
    }
    setImportLoading(false);
  };

  const deleteDeck = async (e, deckId) => {
    e.stopPropagation();
    await base44.entities.HordeDeck.delete(deckId);
    setStoredDecks(prev => prev.filter(d => d.id !== deckId));
    if (selectedDeckId === deckId) onSelect(null);
  };

  // Merge prebuilts with stored info
  const allDecks = PREBUILT_DECKS.map(pb => ({
    ...pb,
    stored: getStored(pb.id),
    isSelected: selectedDeckId && (getStored(pb.id)?.id === selectedDeckId),
  }));

  // Custom imported decks (not in prebuilts)
  const prebuiltIds = new Set(PREBUILT_DECKS.map(d => d.id));
  const customDecks = storedDecks.filter(d => !prebuiltIds.has(d.archidekt_id));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-white/60 text-sm">Horde Deck</label>
        <button
          onClick={() => setShowImport(!showImport)}
          className="flex items-center gap-1 text-xs text-red-300/70 active:text-red-200"
        >
          <Plus className="w-3 h-3" />
          Import from Archidekt
        </button>
      </div>

      {/* Import panel */}
      <AnimatePresence>
        {showImport && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-red-950/40 border border-red-700/40 rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Link className="w-3.5 h-3.5 text-red-400" />
                <span className="text-red-200 text-xs font-semibold">Paste Archidekt Deck URL</span>
              </div>
              <input
                value={importUrl}
                onChange={e => setImportUrl(e.target.value)}
                placeholder="https://archidekt.com/decks/12345/..."
                className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-red-500"
              />
              {importError && <p className="text-red-400 text-xs">{importError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={importCustomDeck}
                  disabled={importLoading || !importUrl}
                  className="flex-1 py-2 rounded-lg bg-red-700/60 text-white text-xs font-bold disabled:opacity-40 flex items-center justify-center gap-1 active:scale-95"
                >
                  {importLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                  {importLoading ? 'Importing...' : 'Import'}
                </button>
                <button onClick={() => setShowImport(false)} className="px-3 py-2 rounded-lg bg-white/5 text-white/40 text-xs active:bg-white/10">
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Deck grid */}
      <div className="grid grid-cols-2 gap-2">
        {/* Random option */}
        <button
          onClick={() => onSelect(null)}
          className={`relative rounded-xl overflow-hidden border transition-all active:scale-95 ${
            !selectedDeckId ? 'border-red-500/70 ring-1 ring-red-500/40' : 'border-white/10'
          }`}
          style={{ aspectRatio: '3/2' }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900 flex flex-col items-center justify-center gap-1">
            <Skull className="w-6 h-6 text-white/30" />
            <span className="text-white/50 text-xs font-bold">Random</span>
          </div>
          {!selectedDeckId && (
            <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
              <Check className="w-2.5 h-2.5 text-white" />
            </div>
          )}
        </button>

        {/* Prebuilt decks */}
        {allDecks.map(deck => {
          const stored = deck.stored;
          const isSelected = stored && selectedDeckId === stored.id;
          const isLoading = loadingId === deck.id;

          return (
            <button
              key={deck.id}
              onClick={() => {
                if (stored) onSelect(stored);
                else importDeck(deck.id);
              }}
              disabled={isLoading}
              className={`relative rounded-xl overflow-hidden border transition-all active:scale-95 ${
                isSelected ? 'border-red-500/70 ring-1 ring-red-500/40' : 'border-white/10'
              }`}
              style={{ aspectRatio: '3/2' }}
            >
              {/* Art */}
              <img src={deck.image} alt={deck.name} className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

              {/* Name + views */}
              <div className="absolute bottom-0 left-0 right-0 p-2">
                <p className="text-white font-bold text-xs leading-tight">{deck.name}</p>
                <p className="text-white/40 text-[9px]">{deck.views} views</p>
              </div>

              {/* Status badges */}
              {isLoading && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 text-red-400 animate-spin" />
                </div>
              )}
              {!stored && !isLoading && (
                <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/60 border border-white/10 text-white/50 text-[8px] font-bold">
                  TAP TO LOAD
                </div>
              )}
              {isSelected && (
                <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
                  <Check className="w-2.5 h-2.5 text-white" />
                </div>
              )}
            </button>
          );
        })}

        {/* Custom imported decks */}
        {customDecks.map(deck => {
          const isSelected = selectedDeckId === deck.id;
          return (
            <button
              key={deck.id}
              onClick={() => onSelect(deck)}
              className={`relative rounded-xl overflow-hidden border transition-all active:scale-95 ${
                isSelected ? 'border-red-500/70 ring-1 ring-red-500/40' : 'border-white/10'
              }`}
              style={{ aspectRatio: '3/2' }}
            >
              {deck.featured_image
                ? <img src={deck.featured_image} alt={deck.name} className="absolute inset-0 w-full h-full object-cover" />
                : <div className="absolute inset-0 bg-gradient-to-br from-red-900/40 to-slate-900" />
              }
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-2">
                <p className="text-white font-bold text-xs leading-tight">{deck.name}</p>
                <p className="text-white/40 text-[9px]">{deck.card_count} cards · custom</p>
              </div>
              <button
                onClick={(e) => deleteDeck(e, deck.id)}
                className="absolute top-1.5 left-1.5 w-5 h-5 rounded bg-black/60 flex items-center justify-center active:bg-red-900/60"
              >
                <Trash2 className="w-2.5 h-2.5 text-white/40" />
              </button>
              {isSelected && (
                <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
                  <Check className="w-2.5 h-2.5 text-white" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected deck info */}
      {selectedDeckId && (
        <div className="text-center text-xs text-green-400/70">
          ✓ Deck loaded · {storedDecks.find(d => d.id === selectedDeckId)?.card_count || '?'} cards
        </div>
      )}
    </div>
  );
}