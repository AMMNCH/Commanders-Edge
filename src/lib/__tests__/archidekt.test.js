import { describe, it, expect } from 'vitest';
import { extractArchidektId, parseArchidektDeck, fetchArchidektDeck } from '@/lib/archidekt';
import { rollDie, shuffle } from '@/lib/random';

describe('archidekt', () => {
  it('extracts deck ids from urls and raw ids', () => {
    expect(extractArchidektId('https://archidekt.com/decks/488879/zombie_horde')).toBe('488879');
    expect(extractArchidektId(' 42 ')).toBe('42');
    expect(extractArchidektId('nope')).toBeNull();
  });

  const payload = {
    id: 7, name: 'Zombies',
    cards: [
      { quantity: 30, categories: ['Creature'], card: { uid: 'abcd', oracleCard: { name: 'Walking Corpse', types: ['Creature'], power: '2', toughness: '2', text: '' } } },
      { quantity: 1, categories: ['Sorcery'], card: { uid: 'efgh', oracleCard: { name: 'Army of the Damned', types: ['Sorcery'], text: 'Create thirteen tapped 2/2 black Zombie creature tokens.' } } },
      { quantity: 1, categories: ['Maybeboard'], card: { uid: 'zzzz', oracleCard: { name: 'Maybe', types: ['Creature'] } } },
    ],
  };

  it('parses cards, skips the maybeboard and finds tokens', () => {
    const { deck, tokenStats } = parseArchidektDeck(payload);
    expect(deck.card_count).toBe(31);
    expect(deck.cards[0].image_url).toBe('https://cards.scryfall.io/normal/front/a/b/abcd.jpg');
    expect(tokenStats.get('Zombie')).toEqual({ power: '2', toughness: '2' });
  });

  it('accepts `url` as well as deck_url/deck_id', async () => {
    const fake = async (u) => ({
      ok: true,
      json: async () => (u.includes('archidekt') ? payload : { data: [{ image_uris: { normal: 'tok.jpg' } }] }),
    });
    const { deck } = await fetchArchidektDeck({ url: 'https://archidekt.com/decks/7/x' }, fake);
    expect(deck.cards.at(-1)).toMatchObject({ name: 'Zombie', is_token: true, image_url: 'tok.jpg' });
  });
});

describe('random', () => {
  it('stays in range and shuffles without losing items', () => {
    for (let i = 0; i < 500; i++) {
      const r = rollDie(20);
      expect(r).toBeGreaterThanOrEqual(1);
      expect(r).toBeLessThanOrEqual(20);
    }
    expect(shuffle([1, 2, 3, 4]).sort()).toEqual([1, 2, 3, 4]);
  });
});

describe('archidekt relays', () => {
  it('falls back to a relay when the direct request is blocked', async () => {
    const calls = [];
    const fake = async (u) => {
      calls.push(u);
      if (u.startsWith('https://archidekt.com')) throw new TypeError('Load failed');
      return { ok: true, json: async () => ({ id: 1, name: 'Relayed', cards: [] }) };
    };
    const { fetchArchidektJson } = await import('@/lib/archidekt');
    const data = await fetchArchidektJson('https://archidekt.com/api/decks/1/', fake);
    expect(data.name).toBe('Relayed');
    expect(calls.length).toBeGreaterThan(1);
  });

  it('stops on a real 404', async () => {
    const { fetchArchidektJson } = await import('@/lib/archidekt');
    await expect(fetchArchidektJson('https://archidekt.com/api/decks/9/', async () => ({ ok: false, status: 404 })))
      .rejects.toThrow("can't find that deck");
  });
});

describe('pasted deck lists', () => {
  it('parses Archidekt, Moxfield and plain exports', async () => {
    const { parseDeckText } = await import('@/lib/archidekt');
    const list = parseDeckText(`Commander
1x Wilhelt, the Rotcleaver (vow) 248 [Commander{top}]

1 Sol Ring (c21) 263 *F*
30 Swamp
1x Delver of Secrets // Insectile Aberration (mid) 47 [Creature]
1 Maybe Card [Maybeboard]

Sideboard
1 Not Me`);
    expect(list.map((c) => [c.quantity, c.name, c.is_commander])).toEqual([
      [1, 'Wilhelt, the Rotcleaver', true],
      [1, 'Sol Ring', false],
      [30, 'Swamp', false],
      [1, 'Delver of Secrets // Insectile Aberration', false],
    ]);
  });

  it('builds a deck from Scryfall and reports missing cards', async () => {
    const { deckFromText } = await import('@/lib/archidekt');
    const fake = async (_u, opts) => {
      const ids = JSON.parse(opts.body).identifiers;
      return { ok: true, json: async () => ({ data: ids.filter((i) => i.name !== 'Fake Card').map((i) => ({ id: 'abcd-1', name: i.name, type_line: 'Creature', image_uris: { normal: 'x.jpg' } })) }) };
    };
    const { deck, missing } = await deckFromText('1 Wilhelt *CMDR*\n2 Gravecrawler\n1 Fake Card', {}, fake);
    expect(deck.card_count).toBe(4);
    expect(deck.cards[0]).toMatchObject({ name: 'Wilhelt', is_commander: true, scryfall_id: 'abcd-1' });
    expect(missing).toEqual(['Fake Card']);
  });
});
