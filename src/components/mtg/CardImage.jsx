import React, { useEffect, useState } from 'react';
import { scryfallImageFromUid, scryfallImageByName } from '@/lib/archidekt';

/** Candidate image URLs for a card, best first. */
export function cardImageSources(card, face = 'front') {
  if (!card) return [];
  const list = [];
  if (face === 'front' && card.image_url) list.push(card.image_url);
  if (card.scryfall_id) list.push(scryfallImageFromUid(card.scryfall_id, { face }));
  if (card.name) list.push(scryfallImageByName(card.name, { face }));
  return [...new Set(list.filter(Boolean))];
}

/**
 * A card picture that falls back through Scryfall sources and finally shows
 * the card's name, so a bad link never leaves an empty box.
 */
export default function CardImage({ card, face = 'front', className = '', style, onFail, alt }) {
  const sources = cardImageSources(card, face);
  const [i, setI] = useState(0);
  useEffect(() => { setI(0); }, [card?.name, card?.scryfall_id, card?.image_url, face]);

  if (i >= sources.length) {
    return (
      <div className={`flex items-center justify-center bg-[#1b1824] border border-white/15 text-center p-1.5 ${className}`} style={style}>
        <span className="text-white/75 text-[10px] font-semibold leading-tight">{card?.name || 'Card'}</span>
      </div>
    );
  }
  return (
    <img
      src={sources[i]}
      alt={alt ?? card?.name ?? ''}
      loading="lazy"
      draggable={false}
      className={`object-cover bg-[#1b1824] ${className}`}
      style={style}
      onError={() => { const next = i + 1; setI(next); if (next >= sources.length) onFail?.(); }}
    />
  );
}
