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
