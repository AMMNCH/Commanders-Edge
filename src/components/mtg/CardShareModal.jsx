import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Send, X, Search, Loader2, History, Sparkles, BookOpen, Camera } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import ArchidektDeckPicker from './ArchidektDeckPicker';

const HISTORY_KEY = 'mtg_card_history';

const SEARCH_PHRASES = [
  'Tapping the Scryfall oracle...',
  'Consulting the Ur-Dragon...',
  'Paying the mana cost...',
  'Shuffling the library...',
  'Asking the Sphinx...',
  'Communing with Emrakul...',
  'Consulting Jace\'s mind...',
  'Drawing from the top...',
  'Searching the graveyard...',
  'Untapping the knowledge...',
  'Scrying into the future...',
  'Sacrificing a land...',
  'Rolling the planar dice...',
  'Phyrexian compleat-ing...',
  'Counting storm copies...',
  'Passing priority...',
  'Resolving the stack...',
  'Tutorin\' for answers...',
  'Pondering... Ponder...',
  'Going infinite...',
];

function useSearchPhrase(active) {
  const [phrase, setPhrase] = React.useState(SEARCH_PHRASES[0]);
  const idxRef = React.useRef(0);
  React.useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => {
      idxRef.current = (idxRef.current + 1) % SEARCH_PHRASES.length;
      setPhrase(SEARCH_PHRASES[idxRef.current]);
    }, 800);
    return () => clearInterval(interval);
  }, [active]);
  return phrase;
}
const MAX_HISTORY = 20;

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
}

function saveToHistory(card, sentByMe) {
  const existing = loadHistory();
  // Deduplicate by name, move to front
  const filtered = existing.filter(c => c.name !== card.name);
  const entry = { ...card, sentByMe, ts: Date.now() };
  const next = [entry, ...filtered].slice(0, MAX_HISTORY);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  return next;
}

// Animated sound-wave bars shown after capturing speech
function SoundCapturedIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className="flex items-center justify-center gap-1 mt-1"
    >
      {[0.4, 0.7, 1, 0.7, 0.4].map((h, i) => (
        <motion.div
          key={i}
          className="w-1 rounded-full bg-green-400"
          style={{ height: 6 }}
          animate={{ scaleY: [h, 1.4, h] }}
          transition={{ duration: 0.6, delay: i * 0.08, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
      <span className="ml-2 text-green-400 text-xs font-semibold">Got it!</span>
    </motion.div>
  );
}

export default function CardShareModal({ onSend, onClose, playerName, playerIndex, accentColor }) {
  const [listening, setListening] = useState(false);
  const [captured, setCaptured] = useState(false); // brief "captured" state
  const [transcript, setTranscript] = useState('');
  const [status, setStatus] = useState('idle');
  const [card, setCard] = useState(null);
  const [alternatives, setAlternatives] = useState([]);
  const [history, setHistory] = useState(() => loadHistory());
  const [showDeckPicker, setShowDeckPicker] = useState(false);
  const [deckCardNames, setDeckCardNames] = useState([]); // word bank from loaded deck

  const searchPhrase = useSearchPhrase(status === 'searching');
  const recognitionRef = useRef(null);
  const gotResultRef = useRef(false);
  const captureTimerRef = useRef(null);
  const cameraInputRef = useRef(null);

  useEffect(() => () => {
    clearTimeout(captureTimerRef.current);
  }, []);

  // AI-assisted: resolve natural language description to a card name via LLM, then search Scryfall
  const searchCard = async (query, useAI = false) => {
    if (!query.trim()) return;
    setStatus('searching');
    setCard(null);
    setAlternatives([]);

    let searchQuery = query;

    if (useAI) {
      try {
        const wordBank = deckCardNames.length > 0
          ? `\n\nThe user's deck contains these cards (prefer matching from this list):\n${deckCardNames.join(', ')}`
          : '';
        const result = await base44.integrations.Core.InvokeLLM({
          prompt: `You are a Magic: The Gathering expert. The user described a card as: "${query}".${wordBank}
Return ONLY the exact card name, nothing else. No explanation, no punctuation, just the card name.
If the description matches a card in the deck list, prefer that. Otherwise return the most likely MTG card match.`,
          response_json_schema: {
            type: 'object',
            properties: { card_name: { type: 'string' } }
          }
        });
        if (result?.card_name) searchQuery = result.card_name;
      } catch (_) {
        // fall through to original query if AI fails
      }
    }

    const res = await fetch(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(searchQuery)}`);
    let foundCard = null;
    if (res.ok) {
      foundCard = await res.json();
      const imageUrl = foundCard.image_uris?.normal
        || foundCard.card_faces?.[0]?.image_uris?.normal
        || null;
      const found = { name: foundCard.name, image_url: imageUrl };
      setCard(found);
      setStatus('found');
    } else {
      setStatus('error');
    }

    const acRes = await fetch(`https://api.scryfall.com/cards/autocomplete?q=${encodeURIComponent(searchQuery)}`);
    if (acRes.ok) {
      const acData = await acRes.json();
      const alts = (acData.data || [])
        .filter(n => !foundCard || n.toLowerCase() !== foundCard.name.toLowerCase())
        .slice(0, 5);
      setAlternatives(alts);
    }
  };

  const startListening = (e) => {
    e.preventDefault();
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setStatus('error'); return; }
    if (recognitionRef.current) { try { recognitionRef.current.abort(); } catch (_) {} }

    gotResultRef.current = false;
    setCaptured(false);
    const rec = new SR();
    rec.lang = 'en-US';
    rec.interimResults = false;
    rec.continuous = false;
    rec.maxAlternatives = 1;

    rec.onresult = (ev) => {
      gotResultRef.current = true;
      const text = ev.results[0][0].transcript;
      setTranscript(text);
      setListening(false);
      setCaptured(true);
      captureTimerRef.current = setTimeout(() => setCaptured(false), 1800);
      searchCard(text, true); // use AI for voice input
    };

    rec.onerror = (ev) => {
      if (ev.error !== 'aborted') setStatus('error');
      setListening(false);
    };

    rec.onend = () => {
      setListening(false);
      if (!gotResultRef.current) setStatus(prev => prev === 'listening' ? 'idle' : prev);
    };

    recognitionRef.current = rec;
    rec.start();
    setListening(true);
    setStatus('listening');
  };

  const stopListening = (e) => {
    e.preventDefault();
    if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch (_) {} }
  };

  const handleSend = () => {
    if (!card) return;
    const payload = {
      name: card.name,
      image_url: card.image_url,
      shared_by_index: playerIndex,
      shared_by_name: playerName,
      timestamp: new Date().toISOString(),
    };
    onSend(payload);
    setHistory(saveToHistory(card, true));
    onClose();
  };

  const handleResend = (histCard) => {
    const payload = {
      name: histCard.name,
      image_url: histCard.image_url,
      shared_by_index: playerIndex,
      shared_by_name: playerName,
      timestamp: new Date().toISOString(),
    };
    onSend(payload);
    setHistory(saveToHistory(histCard, true));
    onClose();
  };

  const handlePreviewFromHistory = (histCard) => {
    setCard(histCard);
    setTranscript(histCard.name);
    setStatus('found');
    setAlternatives([]);
  };

  const pickAlternative = (name) => {
    setTranscript(name);
    searchCard(name);
  };

  const handleCameraClick = () => {
    cameraInputRef.current?.click();
  };

  const handleImageCapture = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus('searching');
    setCard(null);
    setAlternatives([]);
    // Upload image
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    // Ask LLM to identify the card
    const wordBank = deckCardNames.length > 0
      ? `\n\nThe user's deck contains: ${deckCardNames.join(', ')}. Prefer matching from this list.`
      : '';
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a Magic: The Gathering expert. Look at this card image and return the exact card name.${wordBank}
Return ONLY the exact card name, nothing else.`,
      file_urls: [file_url],
      response_json_schema: { type: 'object', properties: { card_name: { type: 'string' } } }
    });
    if (result?.card_name) {
      setTranscript(result.card_name);
      searchCard(result.card_name, false);
    } else {
      setStatus('error');
    }
    // Reset file input so the same file can be re-selected
    e.target.value = '';
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-end bg-black/80"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 400, damping: 35 }}
        className="w-full bg-slate-900 border-t border-white/10 rounded-t-3xl"
        style={{ maxHeight: '92vh', display: 'flex', flexDirection: 'column', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 p-5 pb-2">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-white font-bold text-lg">Share a Card</h3>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-white/50">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Hidden camera input */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="camera"
            className="hidden"
            onChange={handleImageCapture}
          />

          {/* Hold-to-Record Mic + Camera buttons */}
          <div className="flex flex-col items-center mb-5">
            <button
              onPointerDown={startListening}
              onPointerUp={stopListening}
              onPointerLeave={stopListening}
              onPointerCancel={stopListening}
              className="touch-none select-none w-32 h-32 rounded-full flex flex-col items-center justify-center gap-2 mb-2 transition-all active:scale-95"
              style={{
                background: listening
                  ? `radial-gradient(circle, ${accentColor}66 0%, ${accentColor}22 100%)`
                  : 'rgba(255,255,255,0.06)',
                border: `3px solid ${listening ? accentColor : captured ? '#4ade80' : 'rgba(255,255,255,0.15)'}`,
                boxShadow: listening
                  ? `0 0 40px ${accentColor}88, 0 0 80px ${accentColor}33`
                  : captured ? '0 0 30px rgba(74,222,128,0.4)' : 'none',
                WebkitUserSelect: 'none',
                userSelect: 'none',
                WebkitTouchCallout: 'none',
              }}
            >
              <Mic className={`w-10 h-10 ${listening ? 'text-white animate-pulse' : captured ? 'text-green-400' : 'text-white/40'}`} />
              <span className="text-xs font-semibold tracking-wide" style={{
                color: listening ? '#fff' : captured ? '#4ade80' : 'rgba(255,255,255,0.3)'
              }}>
                {listening ? 'LISTENING' : captured ? 'CAPTURED' : 'HOLD'}
              </span>
            </button>

            {/* Camera button */}
            <button
              onClick={handleCameraClick}
              className="w-16 h-16 rounded-full flex flex-col items-center justify-center gap-1 mt-3 transition-all active:scale-95"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: `2px solid rgba(255,255,255,0.15)`,
              }}
            >
              <Camera className="w-6 h-6 text-white/40" />
              <span className="text-[10px] font-semibold tracking-wide" style={{ color: 'rgba(255,255,255,0.3)' }}>
                SNAP
              </span>
            </button>

            <AnimatePresence>
              {captured && <SoundCapturedIndicator />}
            </AnimatePresence>

            {!captured && (
              <p className="text-white/40 text-xs text-center mt-1">
                {status === 'idle' && 'Hold mic to speak · Hold camera to snap'}
                {status === 'listening' && '🎙 Speak now...'}
                {status === 'searching' && searchPhrase}
                {status === 'found' && `Found: "${card?.name}"`}
                {status === 'error' && 'Could not find card. Try typing below.'}
              </p>
            )}
          </div>

          {/* Manual search */}
          <div className="flex gap-2 mb-4">
            <input
              value={transcript}
              onChange={e => setTranscript(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && searchCard(transcript)}
              placeholder="Type a card name or describe it..."
              className="flex-1 bg-white/10 border border-white/15 rounded-xl px-3 py-2 text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/40"
              style={{ WebkitUserSelect: 'text', userSelect: 'text' }}
            />
            <button
              onClick={() => searchCard(transcript, false)}
              className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white/60 active:bg-white/20"
              title="Search by exact name"
            >
              {status === 'searching' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </button>
            <button
              onClick={() => searchCard(transcript, true)}
              className="w-10 h-10 rounded-xl flex items-center justify-center active:opacity-70"
              style={{ background: `${accentColor}33`, border: `1px solid ${accentColor}55`, color: accentColor }}
              title="AI-assisted search"
            >
              <Sparkles className="w-4 h-4" />
            </button>
          </div>

          {/* Archidekt deck picker toggle */}
          <div className="mb-4">
            <button
              onClick={() => setShowDeckPicker(v => !v)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
              style={showDeckPicker
                ? { background: `${accentColor}22`, color: accentColor, border: `1px solid ${accentColor}44` }
                : { background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.12)' }}
            >
              <BookOpen className="w-3.5 h-3.5" />
              {deckCardNames.length > 0
                ? `Deck loaded (${deckCardNames.length} cards) — AI will search within it`
                : 'Link Archidekt Deck'}
            </button>
            <AnimatePresence>
              {showDeckPicker && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <ArchidektDeckPicker
                    accentColor={accentColor}
                    onDeckLoaded={(cards) => setDeckCardNames(cards.map(c => c.name))}
                    onCardSelected={(name) => {
                      setTranscript(name);
                      searchCard(name, false);
                      setShowDeckPicker(false);
                    }}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Card preview */}
          <AnimatePresence>
            {card && status === 'found' && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mb-4">
                <div className="flex gap-3 items-start">
                  {card.image_url && (
                    <img src={card.image_url} alt={card.name} className="w-24 rounded-lg shadow-lg flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <p className="text-white font-bold text-sm mb-1">{card.name}</p>
                    {alternatives.length > 0 && (
                      <div>
                        <p className="text-white/40 text-xs mb-1.5">Wrong card? Try:</p>
                        <div className="flex flex-col gap-1">
                          {alternatives.map(alt => (
                            <button key={alt} onClick={() => pickAlternative(alt)}
                              className="text-left text-xs px-2 py-1.5 rounded-lg bg-white/8 border border-white/10 text-white/60 active:bg-white/15">
                              {alt}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={handleSend}
                  className="w-full mt-3 py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2"
                  style={{ background: `linear-gradient(135deg, ${accentColor}cc, ${accentColor}66)`, color: '#fff' }}
                >
                  <Send className="w-4 h-4" />
                  Send to Table
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Recent Cards History */}
          {history.length > 0 && (
            <div className="mt-1">
              <div className="flex items-center gap-2 mb-3">
                <History className="w-4 h-4 text-white/30" />
                <span className="text-white/40 text-xs font-semibold uppercase tracking-wider">Recent Cards</span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2" style={{ WebkitOverflowScrolling: 'touch' }}>
                {history.map((h, i) => (
                  <div key={i} className="flex-shrink-0 w-20 flex flex-col items-center gap-1">
                    <button
                      onClick={() => handlePreviewFromHistory(h)}
                      className="w-20 rounded-lg overflow-hidden border border-white/10 active:opacity-70 relative"
                    >
                      {h.image_url
                        ? <img src={h.image_url} alt={h.name} className="w-full" />
                        : <div className="w-full h-28 bg-white/10 flex items-center justify-center text-white/30 text-xs p-1 text-center">{h.name}</div>
                      }
                      {h.sentByMe && (
                        <div className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-green-500 flex items-center justify-center">
                          <Send className="w-2 h-2 text-white" />
                        </div>
                      )}
                    </button>
                    <span className="text-white/40 text-xs text-center leading-tight line-clamp-2">{h.name}</span>
                    <button
                      onClick={() => handleResend(h)}
                      className="text-xs px-2 py-0.5 rounded-full bg-white/8 border border-white/10 text-white/50 active:bg-white/15"
                    >
                      Resend
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}