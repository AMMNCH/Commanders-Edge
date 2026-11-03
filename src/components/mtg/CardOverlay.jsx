import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

const HISTORY_KEY = 'mtg_card_history';
function saveToHistory(card) {
  try {
    const existing = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    const filtered = existing.filter(c => c.name !== card.name);
    const entry = { name: card.name, image_url: card.image_url, sentByMe: false, ts: Date.now() };
    localStorage.setItem(HISTORY_KEY, JSON.stringify([entry, ...filtered].slice(0, 20)));
  } catch (_) {}
}

export default function CardOverlay({ card, onDismiss }) {
  useEffect(() => {
    if (card) saveToHistory(card);
  }, [card?.timestamp]);

  if (!card) return null;

  return (
    <AnimatePresence>
      <motion.div
        key={card.timestamp}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/85"
        onClick={onDismiss}
      >
        <motion.div
          initial={{ scale: 0.8, y: 40 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.8, y: 40 }}
          transition={{ type: 'spring', stiffness: 350, damping: 30 }}
          className="flex flex-col items-center px-6"
          onClick={e => e.stopPropagation()}
        >
          <p className="text-white/50 text-xs mb-3 tracking-widest uppercase">
            {card.shared_by_name} shared a card
          </p>

          {card.image_url ? (
            <img
              src={card.image_url}
              alt={card.name}
              className="rounded-2xl shadow-2xl max-w-xs w-full"
              style={{ maxHeight: '65vh', objectFit: 'contain' }}
            />
          ) : (
            <div className="w-64 h-96 rounded-2xl bg-slate-800 border border-white/10 flex items-center justify-center">
              <p className="text-white font-bold text-lg text-center px-4">{card.name}</p>
            </div>
          )}

          <p className="text-white font-bold text-lg mt-3">{card.name}</p>

          <button
            onClick={onDismiss}
            className="mt-4 flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/10 border border-white/15 text-white/70 text-sm font-medium active:bg-white/20"
          >
            <X className="w-4 h-4" />
            Dismiss
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}