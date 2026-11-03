/** Small Scryfall helpers (Scryfall allows CORS, so these run in the browser). */
const API = 'https://api.scryfall.com';
const artCache = new Map();

function imagesOf(card) {
  return card?.image_uris || card?.card_faces?.[0]?.image_uris || null;
}

export async function autocompleteCards(q, signal) {
  if (!q || q.trim().length < 2) return [];
  const res = await fetch(`${API}/cards/autocomplete?q=${encodeURIComponent(q.trim())}`, { signal });
  if (!res.ok) return [];
  return (await res.json()).data?.slice(0, 8) || [];
}

/** Resolve a (fuzzy) card name to `{ name, art, image }`, or null. */
export async function lookupCard(name) {
  const key = name.trim().toLowerCase();
  if (!key) return null;
  if (artCache.has(key)) return artCache.get(key);
  const res = await fetch(`${API}/cards/named?fuzzy=${encodeURIComponent(name.trim())}`);
  if (!res.ok) return null;
  const card = await res.json();
  const imgs = imagesOf(card);
  const out = { name: card.name, art: imgs?.art_crop || '', image: imgs?.normal || '' };
  artCache.set(key, out);
  return out;
}
