/** Finished-game history for pass-and-play tables (device-local). */
const KEY = 'ce_history_v1';
const CURRENT = 'ce_table_current_v1';
const MAX_GAMES = 200;

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (_) {
    return fallback;
  }
}

function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) { /* quota/private mode */ }
}

export function listGames() {
  return read(KEY, []);
}

export function saveGame(summary) {
  const games = listGames().filter((g) => g.id !== summary.id);
  write(KEY, [summary, ...games].slice(0, MAX_GAMES));
}

export function deleteGame(id) {
  write(KEY, listGames().filter((g) => g.id !== id));
}

export function clearHistory() {
  write(KEY, []);
}

/** Names used before, most recent first — for quick setup. */
export function knownPlayerNames() {
  const seen = new Set();
  const names = [];
  listGames().forEach((g) => g.players.forEach((p) => {
    const k = p.name.trim().toLowerCase();
    if (!seen.has(k) && !/^player \d+$/i.test(p.name)) { seen.add(k); names.push(p.name); }
  }));
  return names.slice(0, 24);
}

// ── In-progress table (survives refresh / phone lock) ───────────────────────
export function loadCurrentTable() {
  return read(CURRENT, null);
}

export function saveCurrentTable(state) {
  if (!state) { try { localStorage.removeItem(CURRENT); } catch (_) { /* ignore */ } return; }
  // Keep the undo stack short on disk; it is the bulk of the payload.
  write(CURRENT, { ...state, past: (state.past || []).slice(-20) });
}
