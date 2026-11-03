import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createLocalEntity, _resetLocalDb } from '@/lib/localDb';

describe('localDb', () => {
  beforeEach(() => _resetLocalDb());

  it('creates, filters, sorts and merges updates', async () => {
    const E = createLocalEntity('Thing');
    const a = await E.create({ code: 'AAA', n: 1 });
    await E.create({ code: 'BBB', n: 2 });
    expect((await E.filter({ code: 'AAA' }))[0].id).toBe(a.id);
    expect((await E.list('-n', 1))[0].code).toBe('BBB');
    const u = await E.update(a.id, { n: 5 });
    expect(u).toMatchObject({ code: 'AAA', n: 5 });
    expect((await E.get(a.id)).n).toBe(5);
  });

  it('notifies subscribers and returns copies', async () => {
    const E = createLocalEntity('Thing');
    const cb = vi.fn();
    const unsub = E.subscribe(cb);
    const rec = await E.create({ list: [1] });
    rec.list.push(2);
    expect((await E.get(rec.id)).list).toEqual([1]);
    await E.update(rec.id, { x: 1 });
    expect(cb.mock.calls.map((c) => c[0].type)).toEqual(['create', 'update']);
    unsub();
    await E.delete(rec.id);
    expect(cb).toHaveBeenCalledTimes(2);
    await expect(E.get(rec.id)).rejects.toThrow();
  });
});
