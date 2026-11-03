/**
 * Archidekt deck import, shared by the Base44 backend function and the
 * offline/browser fallback. Pure parsing lives in `parseArchidektDeck` so it can
 * be unit-tested without the network.
 */

export function extractArchidektId(input) {
  if (input === undefined || input === null) return null;
  const str = String(input).trim();
  if (/^\d+$/.test(str)) return str;
  const m = str.match(/\/decks\/(\d+)/);
  return m ? m[1] : null;
}

export function scryfallImageFromUid(uid, { face = 'front', size = 'normal' } = {}) {
  if (!uid || uid.length < 2) return null;
  return `https://cards.scryfall.io/${size}/${face}/${uid[0]}/${uid[1]}/${uid}.jpg`;
}

/** Image by exact name via Scryfall's API (redirects to the picture). */
export function scryfallImageByName(name, { size = 'normal', face } = {}) {
  if (!name) return null;
  const back = face === 'back' ? '&face=back' : '';
  return `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}&format=image&version=${size}${back}`;
}

const TOKEN_RE = /(\d+)\/(\d+)[^.,(]*?([A-Z][a-z]+(?: [A-Z][a-z]+)*) (?:creature )?token/g;

/** Convert the raw Archidekt API payload into our deck shape (without token art). */
export function parseArchidektDeck(data) {
  const cards = [];
  const tokenStats = new Map();

  for (const entry of data?.cards || []) {
    const oracle = entry.card?.oracleCard;
    if (!oracle) continue;
    const categories = (entry.categories || []).map((c) => String(c).toLowerCase());
    if (categories.includes('maybeboard') || categories.includes('sideboard')) continue;

    cards.push({
      name: oracle.name,
      quantity: entry.quantity || 1,
      type: (oracle.types || []).join(' '),
      power: oracle.power ?? null,
      toughness: oracle.toughness ?? null,
      image_url: scryfallImageFromUid(entry.card?.uid),
      scryfall_id: entry.card?.uid || null,
      categories: entry.categories || [],
      is_token: false,
      is_commander: categories.includes('commander'),
      oracle_id: oracle.uid,
      has_haste: (oracle.keywords || []).map((k) => String(k).toLowerCase()).includes('haste'),
      is_defender: (oracle.text || '').toLowerCase().includes('defender'),
      mana_cost: oracle.manaCost || '',
      cmc: oracle.cmc || 0,
    });

    for (const m of (oracle.text || '').matchAll(TOKEN_RE)) {
      if (!tokenStats.has(m[3])) tokenStats.set(m[3], { power: m[1], toughness: m[2] });
    }
  }

  return {
    deck: {
      name: data?.name || 'Imported deck',
      description: '',
      archidekt_id: data?.id,
      archidekt_url: data?.id ? `https://archidekt.com/decks/${data.id}` : '',
      featured_image: data?.featured || '',
      view_count: data?.viewCount || 0,
      card_count: cards.reduce((sum, c) => sum + (c.quantity || 1), 0),
      cards,
      tags: [],
    },
    tokenStats,
  };
}

async function fetchTokenCards(tokenStats, fetchImpl) {
  const tokens = [];
  for (const [name, stats] of tokenStats.entries()) {
    try {
      const res = await fetchImpl(
        `https://api.scryfall.com/cards/search?q=${encodeURIComponent(`"${name}" type:token`)}&order=released`
      );
      if (res.ok) {
        const card = (await res.json()).data?.[0];
        if (card) {
          tokens.push({
            name,
            quantity: 1,
            type: 'Token Creature',
            power: stats.power,
            toughness: stats.toughness,
            image_url: card.image_uris?.normal || card.card_faces?.[0]?.image_uris?.normal || null,
            is_token: true,
            oracle_id: card.oracle_id || null,
            has_haste: false,
            is_defender: false,
            mana_cost: '',
            cmc: 0,
          });
        }
      }
      await new Promise((r) => setTimeout(r, 80)); // be polite to Scryfall
    } catch (_) { /* skip token */ }
  }
  return tokens;
}

/** Fetch + parse a deck directly from the browser. Returns `{ deck }`. */
export async function fetchArchidektDeck({ deck_id, deck_url, url } = {}, fetchImpl = fetch) {
  const id = extractArchidektId(deck_id ?? deck_url ?? url);
  if (!id) throw new Error('Paste an Archidekt deck link like archidekt.com/decks/12345');
  const res = await fetchImpl(`https://archidekt.com/api/decks/${id}/`);
  if (!res.ok) throw new Error(`Archidekt returned ${res.status}`);
  const { deck, tokenStats } = parseArchidektDeck(await res.json());
  deck.cards = [...deck.cards, ...(await fetchTokenCards(tokenStats, fetchImpl))];
  return { deck };
}
