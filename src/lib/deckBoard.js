/**
 * Solo deck board ("goldfishing"): play an Archidekt deck on your own board.
 * Pure reducer so the rules are unit-tested; state is JSON and saved locally.
 */
import { shuffle } from '@/lib/random';
import { makeId } from '@/lib/localDb';

export const ZONES = ['library', 'hand', 'battlefield', 'graveyard', 'exile', 'command'];
export const ZONE_LABEL = {
  library: 'Library', hand: 'Hand', battlefield: 'Battlefield',
  graveyard: 'Graveyard', exile: 'Exile', command: 'Command zone',
};
const UNDO_LIMIT = 40;

const isLand = (c) => /\bland\b/i.test(c.type || '');
export { isLand };

function freshCard(c) {
  return {
    id: makeId(),
    name: c.name,
    type: c.type || '',
    image_url: c.image_url || null,
    scryfall_id: c.scryfall_id || null,
    power: c.power ?? null,
    toughness: c.toughness ?? null,
    tapped: false,
    counters: 0,
    token: Boolean(c.is_token),
    commander: Boolean(c.is_commander),
  };
}

/** Build a new game from a parsed deck: commanders to the command zone, rest shuffled, draw 7. */
export function createBoard(deck, { startingLife = 40, handSize = 7 } = {}) {
  const command = [];
  const library = [];
  (deck.cards || []).forEach((c) => {
    if (c.is_token) return; // tokens are created on demand
    const n = c.quantity || 1;
    for (let i = 0; i < n; i++) (c.is_commander ? command : library).push(freshCard(c));
  });
  const shuffled = shuffle(library);
  const tokens = (deck.cards || []).filter((c) => c.is_token).map((c) => ({ name: c.name, type: c.type, image_url: c.image_url, power: c.power, toughness: c.toughness, is_token: true }));
  return {
    id: makeId(),
    deck: { name: deck.name, archidekt_id: deck.archidekt_id || null, size: library.length + command.length },
    tokens,
    zones: {
      library: shuffled.slice(handSize),
      hand: shuffled.slice(0, handSize),
      battlefield: [],
      graveyard: [],
      exile: [],
      command,
    },
    life: startingLife,
    startingLife,
    turn: 1,
    landsThisTurn: 0,
    mulligans: 0,
    past: [],
  };
}

export function findCard(state, id) {
  for (const z of ZONES) {
    const card = state.zones[z].find((c) => c.id === id);
    if (card) return { card, zone: z };
  }
  return { card: null, zone: null };
}

function move(state, id, to, { top = true } = {}) {
  const { card, zone } = findCard(state, id);
  if (!card) return state;
  const zones = { ...state.zones, [zone]: state.zones[zone].filter((c) => c.id !== id) };
  // Tokens stop existing when they leave the battlefield.
  if (card.token && to !== 'battlefield') return { ...state, zones };
  const moved = to === 'battlefield' ? card : { ...card, tapped: false, counters: 0 };
  const dest = zones[to] || [];
  // Library: index 0 is the top. Other zones: newest last (graveyard shows newest first in UI).
  zones[to] = to === 'library' ? (top ? [moved, ...dest] : [...dest, moved]) : [...dest, moved];
  let s = { ...state, zones };
  if (to === 'battlefield' && zone === 'hand' && isLand(card)) s = { ...s, landsThisTurn: s.landsThisTurn + 1 };
  return s;
}

function draw(state, n = 1) {
  const take = state.zones.library.slice(0, n);
  return {
    ...state,
    zones: { ...state.zones, library: state.zones.library.slice(take.length), hand: [...state.zones.hand, ...take] },
  };
}

function core(state, a) {
  switch (a.type) {
    case 'draw': return draw(state, a.n || 1);
    case 'mill': {
      const take = state.zones.library.slice(0, a.n || 1);
      return { ...state, zones: { ...state.zones, library: state.zones.library.slice(take.length), graveyard: [...state.zones.graveyard, ...take] } };
    }
    case 'move': return move(state, a.id, a.to, { top: a.top !== false });
    case 'tap': {
      const zones = { ...state.zones, battlefield: state.zones.battlefield.map((c) => (c.id === a.id ? { ...c, tapped: !c.tapped } : c)) };
      return { ...state, zones };
    }
    case 'untapAll':
      return { ...state, zones: { ...state.zones, battlefield: state.zones.battlefield.map((c) => ({ ...c, tapped: false })) } };
    case 'counter': {
      const zones = { ...state.zones, battlefield: state.zones.battlefield.map((c) => (c.id === a.id ? { ...c, counters: c.counters + a.delta } : c)) };
      return { ...state, zones };
    }
    case 'shuffle': return { ...state, zones: { ...state.zones, library: shuffle(state.zones.library) } };
    case 'mulligan': {
      const library = shuffle([...state.zones.library, ...state.zones.hand]);
      return { ...draw({ ...state, zones: { ...state.zones, library, hand: [] } }, 7), mulligans: state.mulligans + 1 };
    }
    case 'nextTurn': {
      // Untap, then draw for the turn.
      const untapped = core(state, { type: 'untapAll' });
      return { ...draw(untapped, 1), turn: state.turn + 1, landsThisTurn: 0 };
    }
    case 'life': return { ...state, life: state.life + a.delta };
    case 'token': {
      const t = freshCard({ ...a.token, is_token: true });
      return { ...state, zones: { ...state.zones, battlefield: [...state.zones.battlefield, t] } };
    }
    default: return state;
  }
}

export function boardReducer(state, action) {
  if (action.type === 'load') return action.state;
  if (!state) return state;
  if (action.type === 'undo') {
    const prev = state.past?.[state.past.length - 1];
    return prev ? { ...prev, past: state.past.slice(0, -1) } : state;
  }
  if (action.type === 'restart') {
    const all = ZONES.flatMap((z) => state.zones[z]).filter((c) => !c.token);
    const deck = { name: state.deck.name, archidekt_id: state.deck.archidekt_id, cards: all.map((c) => ({ ...c, quantity: 1, is_commander: c.commander })) };
    return { ...createBoard(deck, { startingLife: state.startingLife }), tokens: state.tokens };
  }
  const next = core(state, action);
  if (next === state) return state;
  const { past: _p, ...snap } = state;
  const past = [...(state.past || []), snap];
  return { ...next, past: past.length > UNDO_LIMIT ? past.slice(-UNDO_LIMIT) : past };
}
