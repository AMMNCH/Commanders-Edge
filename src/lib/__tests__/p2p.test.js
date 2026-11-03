import { describe, it, expect, vi } from 'vitest';

vi.mock('peerjs', () => ({ default: class {} }));
const { makePatch, applyPatch } = await import('@/lib/p2p');

describe('p2p patches', () => {
  it('sends only changed players, so two phones never overwrite each other', () => {
    const base = { code: 'X', turn_number: 3, players: [{ name: 'A', life: 40 }, { name: 'B', life: 40 }] };
    const guestEdit = { ...base, players: [base.players[0], { name: 'B', life: 35 }] };
    const patch = makePatch(base, guestEdit);
    expect(patch.players).toEqual({ 1: { name: 'B', life: 35 } });
    expect(patch.fields).toEqual({});
    // Meanwhile the host changed player A and the turn.
    const hostNow = { ...base, turn_number: 4, players: [{ name: 'A', life: 38 }, base.players[1]] };
    const merged = applyPatch(hostNow, patch);
    expect(merged.players.map((p) => p.life)).toEqual([38, 35]);
    expect(merged.turn_number).toBe(4);
  });

  it('sends changed top-level fields and ignores metadata', () => {
    const patch = makePatch({ id: '1', updated_date: 'a', status: 'waiting' }, { id: '1', updated_date: 'b', status: 'active' });
    expect(patch).toEqual({ fields: { status: 'active' }, players: null });
  });
});
