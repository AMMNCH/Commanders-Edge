import { describe, it, expect } from 'vitest';
import { createBoard, boardReducer, findCard } from '@/lib/deckBoard';

const deck = {
  name: 'Zombies',
  cards: [
    { name: 'Wilhelt', type: 'Legendary Creature', quantity: 1, is_commander: true },
    { name: 'Swamp', type: 'Basic Land', quantity: 30 },
    { name: 'Gravecrawler', type: 'Creature', quantity: 69 },
    { name: 'Zombie', type: 'Token Creature', quantity: 1, is_token: true },
  ],
};
const run = (s, ...a) => a.reduce(boardReducer, s);

describe('deck board', () => {
  it('puts the commander in the command zone and deals seven', () => {
    const s = createBoard(deck);
    expect(s.zones.command.map((c) => c.name)).toEqual(['Wilhelt']);
    expect(s.zones.hand).toHaveLength(7);
    expect(s.zones.library).toHaveLength(92);
    expect(s.tokens.map((t) => t.name)).toEqual(['Zombie']);
  });

  it('plays, taps, untaps on next turn and draws', () => {
    let s = createBoard(deck);
    const card = s.zones.hand[0];
    s = run(s, { type: 'move', id: card.id, to: 'battlefield' }, { type: 'tap', id: card.id });
    expect(findCard(s, card.id)).toMatchObject({ zone: 'battlefield', card: { tapped: true } });
    s = run(s, { type: 'nextTurn' });
    expect(s.turn).toBe(2);
    expect(s.zones.battlefield[0].tapped).toBe(false);
    expect(s.zones.hand).toHaveLength(7);
  });

  it('mulligans back to seven, mills, and undoes', () => {
    let s = createBoard(deck);
    s = run(s, { type: 'mulligan' }, { type: 'mill', n: 3 });
    expect(s.mulligans).toBe(1);
    expect(s.zones.hand).toHaveLength(7);
    expect(s.zones.graveyard).toHaveLength(3);
    s = run(s, { type: 'undo' });
    expect(s.zones.graveyard).toHaveLength(0);
  });

  it('tokens vanish when they leave the battlefield', () => {
    let s = run(createBoard(deck), { type: 'token', token: deck.cards[3] });
    const t = s.zones.battlefield[0];
    s = run(s, { type: 'move', id: t.id, to: 'graveyard' });
    expect(s.zones.graveyard).toHaveLength(0);
  });

  it('restart rebuilds the full deck with the commander back in command', () => {
    let s = createBoard(deck);
    s = run(s, { type: 'move', id: s.zones.command[0].id, to: 'battlefield' }, { type: 'restart' });
    expect(s.zones.command).toHaveLength(1);
    expect(s.zones.hand.length + s.zones.library.length).toBe(99);
  });
});

describe('deck board free-form', () => {
  it('tracks counters by kind and board positions without cluttering undo', () => {
    let s = createBoard(deck);
    const card = s.zones.hand[0];
    s = run(s, { type: 'move', id: card.id, to: 'battlefield' });
    const undoDepth = s.past.length;
    s = run(s, { type: 'place', id: card.id, x: 120, y: 40, scale: 1.4 });
    expect(s.past.length).toBe(undoDepth);
    s = run(s, { type: 'counter', id: card.id, counter: '+1+1', delta: 2 }, { type: 'counter', id: card.id, counter: 'damage', delta: 1 });
    expect(findCard(s, card.id).card).toMatchObject({ x: 120, y: 40, scale: 1.4, counters: { '+1+1': 2, damage: 1 } });
    s = run(s, { type: 'move', id: card.id, to: 'hand' });
    expect(findCard(s, card.id).card).toMatchObject({ counters: {}, x: undefined });
  });
});
