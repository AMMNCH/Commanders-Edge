/**
 * localDb — a tiny offline stand-in for Base44 entities.
 *
 * Records live in localStorage and changes are broadcast to every open tab on
 * this device (BroadcastChannel + the `storage` event), so a "linked" game still
 * works across tabs/windows of the same browser with no server at all.
 *
 * The API mirrors the subset of the Base44 entity API that the app uses:
 *   list(sort?, limit?) · filter(query, sort?, limit?) · get(id)
 *   create(data) · update(id, patch) · delete(id) · subscribe(cb) -> unsubscribe
 */

const PREFIX = 'ce_db_';
const CHANNEL = 'ce_db_events';

const memoryStore = new Map();
function storage() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  } catch (_) { /* private mode */ }
  return {
    getItem: (k) => (memoryStore.has(k) ? memoryStore.get(k) : null),
    setItem: (k, v) => memoryStore.set(k, String(v)),
    removeItem: (k) => memoryStore.delete(k),
  };
}

export function makeId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID().replace(/-/g, '').slice(0, 24);
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function readAll(entity) {
  try {
    const raw = storage().getItem(PREFIX + entity);
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
}

function writeAll(entity, records) {
  storage().setItem(PREFIX + entity, JSON.stringify(records));
}

function clone(v) {
  return v === undefined ? v : JSON.parse(JSON.stringify(v));
}

function sortRecords(records, sort) {
  if (!sort) return records;
  const desc = sort.startsWith('-');
  const key = desc ? sort.slice(1) : sort;
  return [...records].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    if (av === bv) return 0;
    if (av === undefined || av === null) return 1;
    if (bv === undefined || bv === null) return -1;
    return (av > bv ? 1 : -1) * (desc ? -1 : 1);
  });
}

function matches(record, query) {
  return Object.entries(query || {}).every(([k, v]) => record[k] === v);
}

// ── Event bus ────────────────────────────────────────────────────────────────
const listeners = new Map(); // entity -> Set<cb>
let channel = null;

function emitLocal(entity, event) {
  const set = listeners.get(entity);
  if (!set) return;
  set.forEach((cb) => {
    try { cb(clone(event)); } catch (e) { console.error(e); }
  });
}

function ensureChannel() {
  if (channel || typeof window === 'undefined') return;
  if (typeof BroadcastChannel !== 'undefined') {
    channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = (msg) => {
      const { entity, event } = msg.data || {};
      if (entity && event) emitLocal(entity, event);
    };
  } else {
    // Fallback: the storage event fires in *other* tabs when localStorage changes.
    channel = { postMessage: () => {} };
    window.addEventListener('storage', (e) => {
      if (!e.key || !e.key.startsWith(PREFIX) || !e.newValue) return;
      const entity = e.key.slice(PREFIX.length);
      const before = e.oldValue ? JSON.parse(e.oldValue) : [];
      const after = JSON.parse(e.newValue);
      after.forEach((rec) => {
        const prev = before.find((r) => r.id === rec.id);
        if (!prev) emitLocal(entity, { type: 'create', id: rec.id, data: rec });
        else if (prev.updated_date !== rec.updated_date) emitLocal(entity, { type: 'update', id: rec.id, data: rec });
      });
    });
  }
}

function emit(entity, event) {
  emitLocal(entity, event);
  ensureChannel();
  try { channel?.postMessage({ entity, event }); } catch (_) { /* ignore */ }
}

// ── Entity factory ───────────────────────────────────────────────────────────
export function createLocalEntity(entity) {
  return {
    async list(sort, limit) {
      const all = sortRecords(readAll(entity), sort);
      return clone(limit ? all.slice(0, limit) : all);
    },
    async filter(query, sort, limit) {
      const all = sortRecords(readAll(entity).filter((r) => matches(r, query)), sort);
      return clone(limit ? all.slice(0, limit) : all);
    },
    async get(id) {
      const rec = readAll(entity).find((r) => r.id === id);
      if (!rec) throw Object.assign(new Error(`${entity} ${id} not found`), { status: 404 });
      return clone(rec);
    },
    async create(data) {
      const now = new Date().toISOString();
      const rec = { ...clone(data), id: data?.id || makeId(), created_date: now, updated_date: now };
      writeAll(entity, [...readAll(entity), rec]);
      emit(entity, { type: 'create', id: rec.id, data: rec });
      return clone(rec);
    },
    async update(id, patch) {
      const all = readAll(entity);
      const idx = all.findIndex((r) => r.id === id);
      if (idx === -1) throw Object.assign(new Error(`${entity} ${id} not found`), { status: 404 });
      const { id: _ignore, created_date: _c, ...rest } = clone(patch) || {};
      const rec = { ...all[idx], ...rest, updated_date: new Date().toISOString() };
      all[idx] = rec;
      writeAll(entity, all);
      emit(entity, { type: 'update', id, data: rec });
      return clone(rec);
    },
    async delete(id) {
      const all = readAll(entity);
      const rec = all.find((r) => r.id === id);
      writeAll(entity, all.filter((r) => r.id !== id));
      if (rec) emit(entity, { type: 'delete', id, data: rec });
      return { success: true };
    },
    subscribe(cb) {
      ensureChannel();
      if (!listeners.has(entity)) listeners.set(entity, new Set());
      listeners.get(entity).add(cb);
      return () => listeners.get(entity)?.delete(cb);
    },
  };
}

/** Test helper: wipe every local entity. */
export function _resetLocalDb() {
  memoryStore.clear();
  try {
    const s = storage();
    Object.keys(s).forEach((k) => { if (k.startsWith(PREFIX)) s.removeItem(k); });
  } catch (_) { /* ignore */ }
}
