/** Device-level preferences (sound, haptics, screen wake). */
import { useSyncExternalStore } from 'react';

const KEY = 'ce_settings_v1';
const DEFAULTS = { sound: true, haptics: true, keepAwake: true, cmdDamageAffectsLife: true, seatMode: 'auto' };
const subs = new Set();
let cache = null;

export function getSettings() {
  if (cache) return cache;
  try {
    cache = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch (_) {
    cache = { ...DEFAULTS };
  }
  return cache;
}

export function updateSettings(patch) {
  cache = { ...getSettings(), ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch (_) { /* ignore */ }
  subs.forEach((fn) => fn());
}

export function useSettings() {
  const settings = useSyncExternalStore(
    (fn) => { subs.add(fn); return () => subs.delete(fn); },
    getSettings,
    getSettings
  );
  return [settings, updateSettings];
}

/** Short vibration on supported phones. */
export function buzz(ms = 8) {
  if (!getSettings().haptics) return;
  try { navigator.vibrate?.(ms); } catch (_) { /* ignore */ }
}
