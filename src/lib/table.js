/**
 * Pass-and-play table engine. Pure functions only, so the rules are unit-tested
 * and the UI stays thin. State is JSON-serialisable and persisted per device.
 */
import { COLOR_KEYS } from '@/lib/theme';
import { makeId } from '@/lib/localDb';

export const POISON_LETHAL = 10;
export const COMMANDER_LETHAL = 21;
export const UNDO_LIMIT = 60;
export const LOG_LIMIT = 300;

export const TABLE_COUNTERS = [
  { id: 'energy', label: 'Energy', icon: '⚡' },
  { id: 'experience', label: 'Experience', icon: '🌟' },
  { id: 'rad', label: 'Rad', icon: '☢️' },
  { id: 'storm', label: 'Storm', icon: '🌩️' },
  { id: 'treasure', label: 'Treasure', icon: '💎' },
  { id: 'tax', label: 'Cmdr tax', icon: '🪙' },
];

export function createPlayer(i, overrides = {}) {
  return {
    id: overrides.id || makeId(),
    name: overrides.name || `Player ${i + 1}`,
    color: overrides.color || COLOR_KEYS[i % COLOR_KEYS.length],
    commander: overrides.commander || '',
    art: overrides.art || '',
    life: overrides.life ?? 40,
    poison: 0,
    cmdDmg: {},
    counters: {},
    conceded: false,
  };
}

export function createTable({ players = [], startingLife = 40, format = 'commander' } = {}) {
  const now = Date.now();
  return {
    id: makeId(),
    version: 1,
    format,
    startingLife,
    startedAt: now,
    endedAt: null,
    players: players.map((p, i) => createPlayer(i, { ...p, life: startingLife })),
    turn: { active: null, number: 0, startedAt: null },
    monarchId: null,
    initiativeId: null,
    winnerId: null,
    log: [],
    past: [],
  };
}

// ── Derived rules ────────────────────────────────────────────────────────────
export function deathReason(p) {
  if (!p) return null;
  if (p.conceded) return 'conceded';
  if (p.life <= 0) return 'life';
  if (p.poison >= POISON_LETHAL) return 'poison';
  if (Object.values(p.cmdDmg || {}).some((d) => d >= COMMANDER_LETHAL)) return 'commander';
  return null;
}

export const isAlive = (p) => !deathReason(p);

export function alivePlayers(state) {
  return state.players.filter(isAlive);
}

/** The last player standing, if the game has more than one player. */
export function survivor(state) {
  if (state.players.length < 2) return null;
  const alive = alivePlayers(state);
  return alive.length === 1 ? alive[0] : null;
}

function nextAliveIndex(state, from) {
  const n = state.players.length;
  for (let step = 1; step <= n; step++) {
    const idx = (from + step) % n;
    if (isAlive(state.players[idx])) return idx;
  }
  return from;
}

// ── Reducer ──────────────────────────────────────────────────────────────────
const UNDOABLE = new Set([
  'life', 'setLife', 'poison', 'cmdDmg', 'counter', 'concede',
  'nextTurn', 'setActive', 'monarch', 'initiative',
]);

function snapshot(state) {
  const { past: _p, ...rest } = state;
  return rest;
}

function withLog(state, entry) {
  const log = [...state.log, { t: Date.now(), turn: state.turn.number, ...entry }];
  return { ...state, log: log.length > LOG_LIMIT ? log.slice(-LOG_LIMIT) : log };
}

function updatePlayer(state, id, fn) {
  return { ...state, players: state.players.map((p) => (p.id === id ? fn(p) : p)) };
}

function applyWinner(state) {
  const s = survivor(state);
  if (s && !state.winnerId) return { ...state, winnerId: s.id, endedAt: Date.now() };
  if (!s && state.winnerId && alivePlayers(state).length > 1) {
    // An undo/heal brought someone back — the game is on again.
    return { ...state, winnerId: null, endedAt: null };
  }
  return state;
}

function core(state, action) {
  switch (action.type) {
    case 'life': {
      const { id, delta } = action;
      if (!delta) return state;
      const s = updatePlayer(state, id, (p) => ({ ...p, life: p.life + delta }));
      const p = s.players.find((x) => x.id === id);
      return withLog(s, { kind: 'life', id, delta, value: p.life });
    }
    case 'setLife': {
      const { id, value } = action;
      const prev = state.players.find((p) => p.id === id);
      if (!prev || prev.life === value) return state;
      const s = updatePlayer(state, id, (p) => ({ ...p, life: value }));
      return withLog(s, { kind: 'life', id, delta: value - prev.life, value });
    }
    case 'poison': {
      const { id, delta } = action;
      const s = updatePlayer(state, id, (p) => ({ ...p, poison: Math.max(0, p.poison + delta) }));
      return withLog(s, { kind: 'poison', id, delta, value: s.players.find((x) => x.id === id).poison });
    }
    case 'cmdDmg': {
      // Commander damage from `source` to `id`. By default it also costs life.
      const { id, source, delta, affectsLife = true } = action;
      const target = state.players.find((p) => p.id === id);
      if (!target) return state;
      const current = target.cmdDmg?.[source] || 0;
      const next = Math.max(0, current + delta);
      const applied = next - current;
      if (!applied) return state;
      const s = updatePlayer(state, id, (p) => ({
        ...p,
        cmdDmg: { ...p.cmdDmg, [source]: next },
        life: affectsLife ? p.life - applied : p.life,
      }));
      return withLog(s, { kind: 'cmdDmg', id, source, delta: applied, value: next });
    }
    case 'counter': {
      const { id, counter, delta } = action;
      return updatePlayer(state, id, (p) => ({
        ...p,
        counters: { ...p.counters, [counter]: Math.max(0, (p.counters?.[counter] || 0) + delta) },
      }));
    }
    case 'concede': {
      const s = updatePlayer(state, action.id, (p) => ({ ...p, conceded: !p.conceded }));
      return withLog(s, { kind: 'concede', id: action.id });
    }
    case 'rename':
      return updatePlayer(state, action.id, (p) => ({ ...p, name: action.name.slice(0, 24) || p.name }));
    case 'color':
      return updatePlayer(state, action.id, (p) => ({ ...p, color: action.color }));
    case 'commander':
      return updatePlayer(state, action.id, (p) => ({ ...p, commander: action.commander, art: action.art || '' }));
    case 'setActive': {
      const idx = state.players.findIndex((p) => p.id === action.id);
      if (idx === -1) return state;
      const s = {
        ...state,
        turn: { active: idx, number: Math.max(1, state.turn.number), startedAt: Date.now() },
      };
      return withLog(s, { kind: 'turn', id: action.id });
    }
    case 'nextTurn': {
      if (state.turn.active === null) {
        return core(state, { type: 'setActive', id: state.players[0].id });
      }
      const idx = nextAliveIndex(state, state.turn.active);
      const s = { ...state, turn: { active: idx, number: state.turn.number + 1, startedAt: Date.now() } };
      return withLog(s, { kind: 'turn', id: state.players[idx].id });
    }
    case 'monarch':
      return { ...state, monarchId: state.monarchId === action.id ? null : action.id };
    case 'initiative':
      return { ...state, initiativeId: state.initiativeId === action.id ? null : action.id };
    case 'resetGame': {
      // Same seats, fresh game.
      const fresh = createTable({
        players: state.players.map((p) => ({ id: p.id, name: p.name, color: p.color, commander: p.commander, art: p.art })),
        startingLife: state.startingLife,
        format: state.format,
      });
      return { ...fresh, past: [] };
    }
    default:
      return state;
  }
}

export function tableReducer(state, action) {
  if (action.type === 'undo') {
    if (!state.past?.length) return state;
    const prev = state.past[state.past.length - 1];
    return { ...prev, past: state.past.slice(0, -1) };
  }
  if (action.type === 'load') return action.state;

  const next = applyWinner(core(state, action));
  if (next === state) return state;
  if (!UNDOABLE.has(action.type)) return next;
  const past = [...(state.past || []), snapshot(state)];
  return { ...next, past: past.length > UNDO_LIMIT ? past.slice(-UNDO_LIMIT) : past };
}

// ── Summaries for history/stats ──────────────────────────────────────────────
export function summarizeGame(state) {
  const winner = state.players.find((p) => p.id === state.winnerId) || null;
  const damageDealt = {};
  state.log.forEach((e) => {
    if (e.kind === 'cmdDmg' && e.delta > 0) damageDealt[e.source] = (damageDealt[e.source] || 0) + e.delta;
  });
  return {
    id: state.id,
    format: state.format,
    startedAt: state.startedAt,
    endedAt: state.endedAt || Date.now(),
    durationMs: (state.endedAt || Date.now()) - state.startedAt,
    turns: state.turn.number,
    startingLife: state.startingLife,
    winnerName: winner?.name || null,
    winnerId: winner?.id || null,
    players: state.players.map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      commander: p.commander,
      finalLife: p.life,
      poison: p.poison,
      outBy: deathReason(p),
      commanderDamageDealt: damageDealt[p.id] || 0,
    })),
  };
}

/** Aggregate stats keyed by player name (names are how people recur across games). */
export function computeStats(games) {
  const byName = new Map();
  games.forEach((g) => {
    g.players.forEach((p) => {
      const key = p.name.trim().toLowerCase();
      const s = byName.get(key) || { name: p.name, games: 0, wins: 0, commanders: {} };
      s.games += 1;
      if (g.winnerId === p.id) s.wins += 1;
      if (p.commander) s.commanders[p.commander] = (s.commanders[p.commander] || 0) + 1;
      byName.set(key, s);
    });
  });
  const players = [...byName.values()]
    .map((s) => ({
      ...s,
      winRate: s.games ? s.wins / s.games : 0,
      favoriteCommander: Object.entries(s.commanders).sort((a, b) => b[1] - a[1])[0]?.[0] || null,
    }))
    .sort((a, b) => b.wins - a.wins || b.winRate - a.winRate || b.games - a.games);
  const finished = games.filter((g) => g.durationMs > 0);
  const avgDurationMs = finished.length
    ? finished.reduce((sum, g) => sum + g.durationMs, 0) / finished.length
    : 0;
  return { players, totalGames: games.length, avgDurationMs };
}
