/**
 * backend — the single place the app talks to persistence/realtime.
 *
 * Cloud mode (Base44): used when VITE_BASE44_APP_ID is configured (or the app is
 * opened from the Base44 builder, which passes ?app_id=). Linked games sync
 * across phones in real time.
 *
 * Local mode: no server needed. Data lives on this device; linked games sync
 * between tabs of this browser only. Add `?local=1` to force local mode, or
 * `?local=0` to go back to cloud.
 */
import { createLocalEntity } from '@/lib/localDb';
import { fetchArchidektDeck as fetchArchidektDeckDirect } from '@/lib/archidekt';
import { appParams } from '@/lib/app-params';
import { base44 } from '@/api/base44Client';

const ENTITIES = ['GameSession', 'DuelGame', 'HordeDeck', 'WebRTCSignal'];
export const isCloud = appParams.cloud;
export const mode = isCloud ? 'cloud' : 'local';

/** Base44 entities, hardened so a missing `get` still works. */
function cloudEntity(name) {
  const e = base44.entities[name];
  return {
    list: (...a) => e.list(...a),
    filter: (...a) => e.filter(...a),
    get: async (id) => {
      if (typeof e.get === 'function') return e.get(id);
      const r = await e.filter({ id });
      return r?.[0];
    },
    create: (d) => e.create(d),
    update: (id, d) => e.update(id, d),
    delete: (id) => e.delete(id),
    subscribe: (cb) => e.subscribe(cb),
  };
}

export const db = Object.fromEntries(
  ENTITIES.map((name) => [name, isCloud ? cloudEntity(name) : createLocalEntity(name)])
);

export const functions = {
  /** Mirrors base44.functions.invoke: resolves to `{ data }`. */
  async invoke(name, payload) {
    if (isCloud) {
      try {
        return await base44.functions.invoke(name, payload);
      } catch (err) {
        // The cloud function can fail (cold start, quota). Archidekt can also be
        // reached straight from the browser, so try that before giving up.
        if (name !== 'fetchArchidektDeck') throw err;
      }
    }
    if (name === 'fetchArchidektDeck') {
      return { data: await fetchArchidektDeckDirect(payload) };
    }
    throw new Error(`Function "${name}" needs cloud mode`);
  },
};

/** AI helpers only exist in cloud mode — callers must check `ai.available`. */
export const ai = {
  available: isCloud,
  invokeLLM: (args) => base44.integrations.Core.InvokeLLM(args),
  uploadFile: (args) => base44.integrations.Core.UploadFile(args),
};

/**
 * Read-modify-write a document against the freshest server copy, which shrinks
 * the window where two phones overwrite each other's changes.
 */
export async function patchDoc(entity, id, updater, fallback) {
  let base = fallback;
  try {
    const fresh = await db[entity].get(id);
    if (fresh) base = fresh;
  } catch (_) { /* use fallback */ }
  if (!base) return null;
  const next = updater(JSON.parse(JSON.stringify(base)));
  const { id: _i, created_date: _c, updated_date: _u, created_by: _b, ...body } = next;
  await db[entity].update(id, body);
  return { ...next, id };
}
