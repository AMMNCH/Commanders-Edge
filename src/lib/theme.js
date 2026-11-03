/**
 * Shared player palette. Keys are stored in game documents, so existing keys
 * (purple, blue, red, green, gold, white) must keep working.
 */
export const PLAYER_PALETTE = {
  purple: { name: 'Swamp',    accent: '#a78bfa', deep: '#2e1065', mid: '#5b21b6' },
  blue:   { name: 'Island',   accent: '#60a5fa', deep: '#0c1e4a', mid: '#1d4ed8' },
  red:    { name: 'Mountain', accent: '#f87171', deep: '#450a0a', mid: '#b91c1c' },
  green:  { name: 'Forest',   accent: '#4ade80', deep: '#052e16', mid: '#15803d' },
  gold:   { name: 'Plains',   accent: '#facc15', deep: '#3f2a04', mid: '#a16207' },
  white:  { name: 'Silver',   accent: '#cbd5e1', deep: '#1e293b', mid: '#475569' },
  teal:   { name: 'Simic',    accent: '#2dd4bf', deep: '#042f2e', mid: '#0f766e' },
  pink:   { name: 'Rakdos',   accent: '#f472b6', deep: '#500724', mid: '#be185d' },
};

export const COLOR_KEYS = Object.keys(PLAYER_PALETTE);

export function playerColor(key, fallbackIndex = 0) {
  return PLAYER_PALETTE[key] || PLAYER_PALETTE[COLOR_KEYS[fallbackIndex % COLOR_KEYS.length]];
}

export function accentOf(key, fallbackIndex = 0) {
  return playerColor(key, fallbackIndex).accent;
}

/** Panel background for a player. */
export function panelGradient(key, fallbackIndex = 0) {
  const c = playerColor(key, fallbackIndex);
  return `radial-gradient(120% 90% at 50% 0%, ${c.mid} 0%, ${c.deep} 70%, #07060b 100%)`;
}
