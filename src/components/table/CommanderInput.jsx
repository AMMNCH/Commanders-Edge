import React, { useEffect, useRef, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { autocompleteCards, lookupCard } from '@/lib/scryfall';

/**
 * Commander name field with Scryfall autocomplete. Picking a name also fetches
 * the card's art crop so the player's panel can use it as a background.
 * Works offline too: the typed name is kept, just without art.
 */
export default function CommanderInput({ value, onPick, placeholder = 'Commander (optional)', compact }) {
  const [text, setText] = useState(value || '');
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const abortRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => { setText(value || ''); }, [value]);

  useEffect(() => () => { clearTimeout(debounceRef.current); abortRef.current?.abort(); }, []);

  const search = (q) => {
    clearTimeout(debounceRef.current);
    abortRef.current?.abort();
    if (q.trim().length < 2) { setOptions([]); return; }
    debounceRef.current = setTimeout(async () => {
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        setOptions(await autocompleteCards(q, ctrl.signal));
      } catch (_) {
        setOptions([]);
      }
    }, 220);
  };

  const pick = async (name) => {
    setText(name);
    setOpen(false);
    setOptions([]);
    if (!name.trim()) { onPick('', ''); return; }
    setLoading(true);
    try {
      const card = await lookupCard(name);
      onPick(card?.name || name, card?.art || '');
      if (card?.name) setText(card.name);
    } catch (_) {
      onPick(name, '');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative mt-1">
      <div className="relative">
        <input
          value={text}
          placeholder={placeholder}
          onChange={(e) => { setText(e.target.value); setOpen(true); search(e.target.value); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); pick(options[0] || text); } }}
          className={`w-full bg-white/10 border border-white/15 rounded-lg pl-3 pr-9 text-white focus:outline-none focus:border-white/40 placeholder-white/30 ${compact ? 'py-2 text-sm' : 'py-2.5 text-sm'}`}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          {loading
            ? <Loader2 className="w-4 h-4 text-white/50 animate-spin" />
            : text && (
              <button type="button" onClick={() => pick('')} aria-label="Clear commander" className="p-1">
                <X className="w-3.5 h-3.5 text-white/40" />
              </button>
            )}
        </div>
      </div>
      {open && options.length > 0 && (
        <ul className="absolute z-40 left-0 right-0 mt-1 rounded-lg bg-[#15131c] border border-white/15 shadow-2xl overflow-hidden max-h-48 overflow-y-auto">
          {options.map((o) => (
            <li key={o}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(o)}
                className="w-full text-left px-3 py-2 text-sm text-white/85 hover:bg-white/10 active:bg-white/15">
                {o}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
