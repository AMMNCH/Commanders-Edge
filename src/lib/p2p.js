/**
 * p2p — phone-to-phone sync for linked games, with no server of our own.
 *
 * The phone that creates a game is its HOST: it keeps the real copy of the
 * game and listens on a peer ID derived from the join code. Other phones are
 * GUESTS: they connect to that ID (PeerJS's free public broker introduces the
 * two browsers, then data flows directly over WebRTC), get the full game, send
 * their own changes as small patches, and receive every update live.
 *
 * `withP2P(localEntity)` wraps the offline GameSession store so the rest of the
 * app keeps using the same create/filter/get/update/subscribe API.
 */
import Peer from 'peerjs';
import { useSyncExternalStore } from 'react';

const PREFIX = 'cmdr-edge-v1-';
const ROLE_KEY = 'ce_p2p_roles';
const JOIN_TIMEOUT_MS = 12000;
const RETRY_MS = 3000;

function peerOptions() {
  const env = import.meta.env || {};
  const opts = { debug: 0 };
  if (env.VITE_PEER_HOST) {
    opts.host = env.VITE_PEER_HOST;
    opts.port = Number(env.VITE_PEER_PORT || 443);
    opts.path = env.VITE_PEER_PATH || '/';
    opts.secure = env.VITE_PEER_SECURE !== '0';
  }
  return opts;
}



// ── Roles (remembered so a refresh reconnects as host or guest) ─────────────
function readRoles() {
  try { return JSON.parse(localStorage.getItem(ROLE_KEY) || '{}'); } catch (_) { return {}; }
}
function setRole(code, role) {
  try {
    const r = readRoles();
    r[code] = role;
    localStorage.setItem(ROLE_KEY, JSON.stringify(r));
  } catch (_) { /* ignore */ }
}
export const getRole = (code) => readRoles()[code] || null;

// ── Status (for the UI) ──────────────────────────────────────────────────────
const statuses = new Map(); // code -> { state, peers }
const statusSubs = new Set();
function setStatus(code, patch) {
  statuses.set(code, { ...(statuses.get(code) || {}), ...patch });
  statusSubs.forEach((fn) => fn());
}
const EMPTY = { state: 'idle', peers: 0 };
export function useLinkStatus(code) {
  return useSyncExternalStore(
    (fn) => { statusSubs.add(fn); return () => statusSubs.delete(fn); },
    () => (code && statuses.get(code)) || EMPTY,
    () => EMPTY
  );
}

// ── Patches: only what changed, per player for the players array ───────────
const META = new Set(['id', 'created_date', 'updated_date']);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function makePatch(prev, next) {
  const fields = {};
  let players = null;
  Object.keys(next).forEach((k) => {
    if (META.has(k) || same(prev?.[k], next[k])) return;
    if (k === 'players' && Array.isArray(prev?.players) && Array.isArray(next.players)
      && prev.players.length === next.players.length) {
      players = {};
      next.players.forEach((p, i) => { if (!same(prev.players[i], p)) players[i] = p; });
    } else {
      fields[k] = next[k];
    }
  });
  return { fields, players };
}

export function applyPatch(doc, patch) {
  const out = { ...doc, ...(patch.fields || {}) };
  if (patch.players && Array.isArray(out.players)) {
    out.players = out.players.map((p, i) => (patch.players[i] !== undefined ? patch.players[i] : p));
  }
  return out;
}

// ── Engine ───────────────────────────────────────────────────────────────────
export function withP2P(local, kind = 'game') {
  // Separate peer IDs per kind so a duel and a linked game can't collide.
  const peerIdFor = (code) => `${PREFIX}${kind}-${String(code).toLowerCase().replace(/[^a-z0-9]/g, '')}`;
  const hosts = new Map(); // code -> { peer, conns:Set }
  const guests = new Map(); // code -> { peer, conn, pending:[], waiters:[], retry }

  const findByCode = async (code) => (await local.filter({ code }))[0] || null;

  // Host: push every change of a hosted game to all guests.
  local.subscribe((ev) => {
    const code = ev?.data?.code;
    const h = code && hosts.get(code);
    if (!h) return;
    h.conns.forEach((c) => { try { c.send({ t: 'doc', doc: ev.data }); } catch (_) { /* dropped */ } });
  });

  function host(code) {
    if (hosts.has(code)) return;
    setRole(code, 'host');
    const peer = new Peer(peerIdFor(code), peerOptions());
    const h = { peer, conns: new Set() };
    hosts.set(code, h);
    setStatus(code, { state: 'connecting', role: 'host', peers: 0 });
    const count = () => setStatus(code, { peers: h.conns.size });

    peer.on('open', () => setStatus(code, { state: 'hosting' }));
    peer.on('connection', (conn) => {
      conn.on('open', async () => {
        h.conns.add(conn);
        count();
        const doc = await findByCode(code);
        conn.send(doc ? { t: 'doc', doc } : { t: 'missing' });
      });
      conn.on('data', async (msg) => {
        if (msg?.t !== 'patch') return;
        const doc = await findByCode(code);
        if (!doc) return;
        await local.update(doc.id, applyPatch(doc, msg.patch)); // subscription re-broadcasts
      });
      const drop = () => { h.conns.delete(conn); count(); };
      conn.on('close', drop);
      conn.on('error', drop);
    });
    peer.on('disconnected', () => {
      setStatus(code, { state: 'connecting' });
      setTimeout(() => { if (!peer.destroyed) peer.reconnect(); }, RETRY_MS);
    });
    peer.on('error', (err) => {
      if (err?.type === 'unavailable-id') {
        // Another tab/phone already hosts this code: follow it instead.
        peer.destroy();
        hosts.delete(code);
        join(code);
        return;
      }
      setStatus(code, { state: 'offline' });
      if (['network', 'server-error', 'socket-error', 'socket-closed'].includes(err?.type)) {
        setTimeout(() => {
          if (peer.destroyed) return;
          if (peer.disconnected) peer.reconnect();
        }, RETRY_MS);
      }
    });
  }

  async function receiveDoc(doc) {
    let existing = null;
    try { existing = await local.get(doc.id); } catch (_) { /* new */ }
    const { id: _i, created_date: _c, updated_date: _u, ...body } = doc;
    return existing ? local.update(doc.id, body) : local.create(doc);
  }

  /** Connect to a game's host. Resolves with the game, or null if unreachable. */
  function join(code) {
    let g = guests.get(code);
    if (!g) {
      g = { peer: null, conn: null, pending: [], waiters: [], retry: null, gotDoc: false };
      guests.set(code, g);
      setStatus(code, { state: 'connecting', role: 'guest', peers: 0 });

      const settle = (doc) => { g.waiters.splice(0).forEach((fn) => fn(doc)); };
      const scheduleRetry = () => {
        clearTimeout(g.retry);
        g.retry = setTimeout(connect, RETRY_MS);
      };
      const connect = () => {
        if (!g.peer || g.peer.destroyed) return;
        if (g.peer.disconnected) { g.peer.reconnect(); return; }
        const conn = g.peer.connect(peerIdFor(code), { reliable: true });
        g.conn = conn;
        conn.on('open', () => {
          setStatus(code, { state: 'connected' });
          g.pending.splice(0).forEach((m) => conn.send(m));
        });
        conn.on('data', async (msg) => {
          if (msg?.t === 'doc' && msg.doc) {
            const saved = await receiveDoc(msg.doc);
            if (!g.gotDoc) { g.gotDoc = true; setRole(code, 'guest'); }
            settle(saved);
          } else if (msg?.t === 'missing') {
            settle(null);
          }
        });
        conn.on('close', () => { setStatus(code, { state: 'offline' }); scheduleRetry(); });
        conn.on('error', () => { setStatus(code, { state: 'offline' }); scheduleRetry(); });
      };

      g.peer = new Peer(peerOptions());
      g.peer.on('open', connect);
      g.peer.on('disconnected', () => { setStatus(code, { state: 'connecting' }); setTimeout(() => g.peer.reconnect(), RETRY_MS); });
      g.peer.on('error', (err) => {
        setStatus(code, { state: 'offline' });
        if (err?.type === 'peer-unavailable') settle(null); // nobody hosts this code right now
        scheduleRetry();
      });
    }
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(null), JOIN_TIMEOUT_MS);
      g.waiters.push((doc) => { clearTimeout(timer); resolve(doc); });
      if (g.gotDoc) findByCode(code).then((d) => { clearTimeout(timer); resolve(d); });
    });
  }

  function sendPatch(code, patch) {
    const g = guests.get(code);
    if (!g) return;
    const msg = { t: 'patch', patch };
    if (g.conn?.open) g.conn.send(msg);
    else g.pending.push(msg);
  }

  /** Reconnect in the background when a game we host/joined is opened again. */
  function revive(rec) {
    const code = rec?.code;
    if (!code) return;
    const role = getRole(code);
    if (role === 'host') host(code);
    else if (role === 'guest' && !guests.has(code)) join(code);
  }

  return {
    ...local,
    /** Local-only lookup that never goes to the network (recent-games list). */
    peek: (...a) => local.filter(...a),
    async filter(query, sort, limit) {
      const res = await local.filter(query, sort, limit);
      const onlyCode = query && Object.keys(query).length === 1 && query.code;
      if (res.length) { if (onlyCode) revive(res[0]); return res; }
      if (!onlyCode) return res;
      const doc = await join(query.code);
      return doc ? [doc] : [];
    },
    async get(id) {
      const rec = await local.get(id);
      revive(rec);
      return rec;
    },
    async create(data) {
      const rec = await local.create(data);
      if (rec.code) host(rec.code);
      return rec;
    },
    async update(id, patch) {
      let prev = null;
      try { prev = await local.get(id); } catch (_) { /* missing */ }
      const next = await local.update(id, patch);
      if (prev?.code && getRole(prev.code) === 'guest') sendPatch(prev.code, makePatch(prev, next));
      return next;
    },
  };
}
