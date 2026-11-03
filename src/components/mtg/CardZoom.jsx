import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, RefreshCw, ExternalLink } from 'lucide-react';
import CardImage from './CardImage';

/**
 * Full-screen card viewer. Pass `cards` + `index` to swipe/arrow through a
 * list, and `actions(card)` to show buttons for that card (play, discard...).
 */
export default function CardZoom({ cards, index = 0, onClose, actions, caption }) {
  const [i, setI] = useState(index);
  const [face, setFace] = useState('front');
  const [hasBack, setHasBack] = useState(true);
  const [touchX, setTouchX] = useState(null);
  const card = cards[i];

  useEffect(() => { setFace('front'); setHasBack(true); }, [i]);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setI((v) => Math.min(cards.length - 1, v + 1));
      if (e.key === 'ArrowLeft') setI((v) => Math.max(0, v - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cards.length, onClose]);

  if (!card) return null;
  const list = actions ? actions(card) : [];
  const canPrev = i > 0;
  const canNext = i < cards.length - 1;

  return (
    <motion.div
      className="fixed inset-0 z-[90] flex flex-col bg-black/90 backdrop-blur-md"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-center justify-between px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <div className="min-w-0">
          <p className="text-white font-semibold truncate">{card.name}</p>
          <p className="text-white/45 text-xs truncate">
            {caption ? caption(card) : card.type}
            {cards.length > 1 ? ` · ${i + 1} of ${cards.length}` : ''}
          </p>
        </div>
        <button onClick={onClose} aria-label="Close" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
          <X className="w-5 h-5 text-white" />
        </button>
      </div>

      <div
        className="relative flex-1 min-h-0 flex items-center justify-center px-4"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => setTouchX(e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX === null) return;
          const dx = e.changedTouches[0].clientX - touchX;
          if (dx < -50 && canNext) setI(i + 1);
          if (dx > 50 && canPrev) setI(i - 1);
          setTouchX(null);
        }}
      >
        <motion.div key={`${i}-${face}`} initial={{ scale: 0.94, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          className="h-full max-h-[70vh] aspect-[63/88] max-w-full">
          <CardImage card={card} face={face} className="w-full h-full rounded-[4.5%] shadow-2xl"
            onFail={() => { if (face === 'back') { setHasBack(false); setFace('front'); } }} />
        </motion.div>
        {canPrev && (
          <button onClick={() => setI(i - 1)} aria-label="Previous card"
            className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 border border-white/15 flex items-center justify-center">
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>
        )}
        {canNext && (
          <button onClick={() => setI(i + 1)} aria-label="Next card"
            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 border border-white/15 flex items-center justify-center">
            <ChevronRight className="w-5 h-5 text-white" />
          </button>
        )}
      </div>

      <div className="px-4 pt-3 pb-4 space-y-2" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-center gap-2">
          {hasBack && (
            <button onClick={() => setFace((f) => (f === 'front' ? 'back' : 'front'))}
              className="chip gap-1.5"><RefreshCw className="w-3.5 h-3.5" /> {face === 'front' ? 'Flip' : 'Front'}</button>
          )}
          <a href={`https://scryfall.com/search?q=${encodeURIComponent(`!"${card.name}"`)}`} target="_blank" rel="noopener noreferrer"
            className="chip gap-1.5"><ExternalLink className="w-3.5 h-3.5" /> Rules text</a>
        </div>
        {list.length > 0 && (
          <div className="grid grid-cols-2 gap-2 max-w-md mx-auto">
            {list.map((a) => (
              <button key={a.label} onClick={() => { a.onClick(card); if (a.close !== false) onClose(); }}
                className={`py-3 rounded-xl text-sm font-bold border active:scale-[0.98] transition-transform ${
                  a.primary ? 'bg-gold text-black border-transparent' : a.danger ? 'bg-red-500/15 text-red-200 border-red-400/30' : 'bg-white/[0.06] text-white border-white/10'}`}>
                {a.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
