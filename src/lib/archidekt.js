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

/**
 * Archidekt's API doesn't send CORS headers, so browsers block direct reads
 * from other sites. Race the direct request and several public CORS relays;
 * the first good answer wins.
 */
const RELAYS = [
  (u) => u,
  (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  (u) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
  (u) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
  (u) => `https://thingproxy.freeboard.io/fetch/${u}`,
  (u) => `https://cors.eu.org/${u}`,
];
const RELAY_TIMEOUT_MS = 12000;

async function tryRoute(url, fetchImpl) {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = setTimeout(() => ctrl?.abort(), RELAY_TIMEOUT_MS);
  try {
    const res = await fetchImpl(url, ctrl ? { signal: ctrl.signal } : undefined);
    if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
    const data = await res.json();
    if (!data || typeof data !== 'object') throw new Error('Not JSON');
    if (data.detail && !data.cards && !data.results) throw Object.assign(new Error(String(data.detail)), { status: 404 });
    return data;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchArchidektJson(url, fetchImpl = fetch) {
  const attempts = RELAYS.map((wrap) => tryRoute(wrap(url), fetchImpl));
  try {
    return await Promise.any(attempts);
  } catch (agg) {
    const errors = agg?.errors || [];
    if (errors.some((e) => e?.status === 404)) {
      throw new Error("Archidekt can't find that deck. Check the link, and make sure the deck is public.");
    }
    throw new Error("Couldn't reach Archidekt right now. Try again, or paste the deck list instead.");
  }
}

// ── Pasted deck lists (Archidekt/Moxfield/MTGO text exports) ────────────────
const SKIP_SECTIONS = /^(maybe(board)?|sideboard|considering|tokens?)$/i;

/** Parse a text deck list into [{ name, quantity, is_commander }]. */
export function parseDeckText(text) {
  const out = [];
  let section = '';
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) { section = ''; continue; } // a blank line ends a section
    if (line.startsWith('//')) continue;
    const header = line.replace(/[:\s]+$/, '');
    if (!/^\d/.test(line)) { section = header.replace(/\s*\(\d+\)$/, ''); continue; }
    const m = line.match(/^(\d+)\s*x?\s+(.+)$/i);
    if (!m) continue;
    let rest = m[2];
    let cats = '';
    const bracket = rest.match(/\[(.*?)\]/);
    if (bracket) { cats = bracket[1]; rest = rest.replace(/\[.*?\]/g, ''); }
    const isCmdrMark = /\*cmdr\*/i.test(rest);
    rest = rest
      .replace(/\^[^^]*\^/g, '')        // Archidekt colour tags
      .replace(/\*[a-z]+\*/gi, '')       // *CMDR*, *F* (foil)
      .replace(/\s+\([a-z0-9]{2,6}\)\s*[\w★-]*\s*$/i, '') // (SET) 123
      .trim();
    if (!rest) continue;
    const allCats = `${section},${cats}`;
    if (SKIP_SECTIONS.test(section) || /maybeboard|sideboard/i.test(cats)) continue;
    out.push({ name: rest, quantity: parseInt(m[1], 10) || 1, is_commander: isCmdrMark || /commander/i.test(allCats) });
  }
  return out;
}

/** Look cards up on Scryfall (CORS-friendly) and build a deck like parseArchidektDeck does. */
export async function deckFromText(text, { name = 'Pasted deck' } = {}, fetchImpl = fetch) {
  const entries = parseDeckText(text);
  if (!entries.length) throw new Error('No cards found. Paste one card per line, like "1 Sol Ring".');
  const unique = [...new Map(entries.map((e) => [e.name.toLowerCase(), e])).values()];
  const found = new Map();
  for (let i = 0; i < unique.length; i += 75) {
    const chunk = unique.slice(i, i + 75).map((e) => ({ name: e.name.split(' // ')[0] }));
    const res = await fetchImpl('https://api.scryfall.com/cards/collection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifiers: chunk }),
    });
    if (!res.ok) throw new Error(`Scryfall returned ${res.status}`);
    const data = await res.json();
    (data.data || []).forEach((c) => {
      found.set(c.name.toLowerCase(), c);
      found.set(c.name.split(' // ')[0].toLowerCase(), c);
    });
    if (i + 75 < unique.length) await new Promise((r) => setTimeout(r, 120));
  }
  const missing = [];
  const cards = entries.map((e) => {
    const c = found.get(e.name.toLowerCase()) || found.get(e.name.split(' // ')[0].toLowerCase());
    if (!c) missing.push(e.name);
    const face = c?.card_faces?.[0];
    return {
      name: c?.name || e.name,
      quantity: e.quantity,
      type: c?.type_line || face?.type_line || '',
      power: c?.power ?? face?.power ?? null,
      toughness: c?.toughness ?? face?.toughness ?? null,
      image_url: c?.image_uris?.normal || face?.image_uris?.normal || null,
      scryfall_id: c?.id || null,
      categories: e.is_commander ? ['Commander'] : [],
      is_token: false,
      is_commander: e.is_commander,
    };
  });
  return {
    deck: { name, cards, card_count: cards.reduce((s, c) => s + c.quantity, 0), archidekt_id: null },
    missing,
  };
}

/** Fetch + parse a deck from the browser. Returns `{ deck }`. */
export async function fetchArchidektDeck({ deck_id, deck_url, url } = {}, fetchImpl = fetch) {
  const id = extractArchidektId(deck_id ?? deck_url ?? url);
  if (!id) throw new Error('Paste an Archidekt deck link like archidekt.com/decks/12345');
  const data = await fetchArchidektJson(`https://archidekt.com/api/decks/${id}/`, fetchImpl);
  const { deck, tokenStats } = parseArchidektDeck(data);
  deck.cards = [...deck.cards, ...(await fetchTokenCards(tokenStats, fetchImpl))];
  return { deck };
}
