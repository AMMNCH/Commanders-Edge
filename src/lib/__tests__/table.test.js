import { describe, it, expect } from 'vitest';
import {
  createTable, tableReducer, deathReason, survivor, summarizeGame, computeStats,
} from '@/lib/table';

const setup = (n = 4, life = 40) =>
  createTable({ players: Array.from({ length: n }, (_, i) => ({ name: `P${i + 1}` })), startingLife: life });

const run = (state, ...actions) => actions.reduce(tableReducer, state);

describe('table engine', () => {
  it('starts every player at the starting life', () => {
    const t = setup(3, 30);
    expect(t.players.map((p) => p.life)).toEqual([30, 30, 30]);
    expect(t.turn.active).toBeNull();
  });

  it('changes life and logs it', () => {
    const t = setup();
    const id = t.players[0].id;
    const s = run(t, { type: 'life', id, delta: -5 }, { type: 'life', id, delta: 2 });
    expect(s.players[0].life).toBe(37);
    expect(s.log.map((e) => e.delta)).toEqual([-5, 2]);
  });

  it('commander damage costs life and is lethal at 21 from one source', () => {
    const t = setup(2);
    const [a, b] = t.players;
    let s = run(t, { type: 'cmdDmg', id: a.id, source: b.id, delta: 20 });
    expect(s.players[0].life).toBe(20);
    expect(deathReason(s.players[0])).toBeNull();
    s = run(s, { type: 'cmdDmg', id: a.id, source: b.id, delta: 1 });
    expect(deathReason(s.players[0])).toBe('commander');
    expect(s.winnerId).toBe(b.id);
  });

  it('commander damage can be tracked without touching life', () => {
    const t = setup(2);
    const [a, b] = t.players;
    const s = run(t, { type: 'cmdDmg', id: a.id, source: b.id, delta: 3, affectsLife: false });
    expect(s.players[0].life).toBe(40);
    expect(s.players[0].cmdDmg[b.id]).toBe(3);
  });

  it('commander damage never goes below zero', () => {
    const t = setup(2);
    const [a, b] = t.players;
    const s = run(t, { type: 'cmdDmg', id: a.id, source: b.id, delta: -4 });
    expect(s).toBe(t);
  });

  it('poison is lethal at 10', () => {
    const t = setup(2);
    const s = run(t, { type: 'poison', id: t.players[0].id, delta: 10 });
    expect(deathReason(s.players[0])).toBe('poison');
  });

  it('declares the last player standing the winner, and undo revives the game', () => {
    const t = setup(3);
    const [a, b, c] = t.players;
    let s = run(t, { type: 'concede', id: a.id }, { type: 'life', id: b.id, delta: -40 });
    expect(survivor(s)?.id).toBe(c.id);
    expect(s.winnerId).toBe(c.id);
    s = run(s, { type: 'undo' });
    expect(s.winnerId).toBeNull();
    expect(s.players[1].life).toBe(40);
  });

  it('turns skip eliminated players', () => {
    const t = setup(3);
    const [a, b] = t.players;
    let s = run(t, { type: 'setActive', id: a.id });
    expect(s.turn).toMatchObject({ active: 0, number: 1 });
    s = run(s, { type: 'concede', id: b.id }, { type: 'nextTurn' });
    expect(s.turn).toMatchObject({ active: 2, number: 2 });
    s = run(s, { type: 'nextTurn' });
    expect(s.turn.active).toBe(0);
  });

  it('undo walks back one step at a time and stops at the start', () => {
    const t = setup(2);
    const id = t.players[0].id;
    let s = run(t, { type: 'life', id, delta: -1 }, { type: 'life', id, delta: -1 });
    s = run(s, { type: 'undo' });
    expect(s.players[0].life).toBe(39);
    s = run(s, { type: 'undo' }, { type: 'undo' });
    expect(s.players[0].life).toBe(40);
  });

  it('renames are not undoable (they are not game actions)', () => {
    const t = setup(2);
    const s = run(t, { type: 'rename', id: t.players[0].id, name: 'Andy' });
    expect(s.players[0].name).toBe('Andy');
    expect(s.past).toHaveLength(0);
  });

  it('resetGame keeps seats but restores life', () => {
    const t = setup(2);
    const s = run(t, { type: 'rename', id: t.players[0].id, name: 'Andy' }, { type: 'life', id: t.players[0].id, delta: -9 }, { type: 'resetGame' });
    expect(s.players[0]).toMatchObject({ name: 'Andy', life: 40, id: t.players[0].id });
    expect(s.id).not.toBe(t.id);
  });

  it('summarises and aggregates stats', () => {
    const t = setup(2);
    const [a, b] = t.players;
    const s = run(t, { type: 'cmdDmg', id: a.id, source: b.id, delta: 21 });
    const g = summarizeGame(s);
    expect(g.winnerName).toBe('P2');
    expect(g.players[1].commanderDamageDealt).toBe(21);
    const stats = computeStats([g, { ...g, id: 'x', winnerId: a.id }]);
    expect(stats.totalGames).toBe(2);
    expect(stats.players.find((p) => p.name === 'P2')).toMatchObject({ games: 2, wins: 1 });
  });
});
