import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { deck_id, deck_url } = await req.json();

    let deckId = deck_id;
    if (!deckId && deck_url) {
      const match = deck_url.match(/\/decks\/(\d+)/);
      if (!match) return Response.json({ error: 'Invalid Archidekt URL' }, { status: 400 });
      deckId = match[1];
    }
    if (!deckId) return Response.json({ error: 'deck_id or deck_url required' }, { status: 400 });

    const res = await fetch(`https://archidekt.com/api/decks/${deckId}/`);
    if (!res.ok) return Response.json({ error: `Archidekt API error: ${res.status}` }, { status: 502 });

    const data = await res.json();

    const cards = [];
    const tokenNamesFromText = new Map(); // name -> {power, toughness}

    for (const entry of data.cards || []) {
      const oracle = entry.card?.oracleCard;
      if (!oracle) continue;

      const imageUrl = entry.card?.uid
        ? `https://cards.scryfall.io/normal/front/${entry.card.uid[0]}/${entry.card.uid[1]}/${entry.card.uid}.jpg`
        : null;

      const cardData = {
        name: oracle.name,
        quantity: entry.quantity || 1,
        type: (oracle.types || []).join(' '),
        power: oracle.power || null,
        toughness: oracle.toughness || null,
        image_url: imageUrl,
        is_token: false,
        oracle_id: oracle.uid,
        has_haste: (oracle.keywords || []).map(k => k.toLowerCase()).includes('haste'),
        is_defender: (oracle.text || '').toLowerCase().includes('defender'),
        mana_cost: oracle.manaCost || '',
        cmc: oracle.cmc || 0,
      };
      cards.push(cardData);

      // Extract tokens from oracle text
      const text = oracle.text || '';
      // Match patterns like "2/2 black Zombie" or "1/1 white Vampire"
      const tokenMatches = [...text.matchAll(/(\d+)\/(\d+)[^.,(]*?([A-Z][a-z]+(?: [A-Z][a-z]+)*) (?:creature )?token/g)];
      for (const m of tokenMatches) {
        const tName = m[3];
        if (!tokenNamesFromText.has(tName)) {
          tokenNamesFromText.set(tName, { power: m[1], toughness: m[2] });
        }
      }
    }

    // Total card count with quantities
    const totalCards = cards.reduce((sum, c) => sum + (c.quantity || 1), 0);

    // Fetch token images from Scryfall
    const tokens = [];
    for (const [name, stats] of tokenNamesFromText.entries()) {
      try {
        const sr = await fetch(
          `https://api.scryfall.com/cards/search?q=${encodeURIComponent(`"${name}" type:token`)}&order=released`
        );
        if (sr.ok) {
          const sd = await sr.json();
          const card = sd.data?.[0];
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
        await new Promise(r => setTimeout(r, 80));
      } catch (_e) {
        // skip
      }
    }

    const result = {
      name: data.name,
      description: '',
      archidekt_id: data.id,
      archidekt_url: `https://archidekt.com/decks/${data.id}`,
      featured_image: data.featured || '',
      view_count: data.viewCount || 0,
      card_count: totalCards,
      cards: [...cards, ...tokens],
      tags: [],
    };

    return Response.json({ deck: result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});