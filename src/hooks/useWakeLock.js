import { useEffect } from 'react';

/** Keep the screen on while `enabled` (Screen Wake Lock API, where supported). */
export default function useWakeLock(enabled) {
  useEffect(() => {
    if (!enabled || typeof navigator === 'undefined' || !navigator.wakeLock) return undefined;
    let lock = null;
    let cancelled = false;
    const acquire = async () => {
      try {
        lock = await navigator.wakeLock.request('screen');
        if (cancelled) lock.release();
      } catch (_) { /* denied or unsupported */ }
    };
    const onVisible = () => { if (document.visibilityState === 'visible') acquire(); };
    acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      lock?.release?.().catch?.(() => {});
    };
  }, [enabled]);
}
