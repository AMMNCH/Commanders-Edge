/**
 * Routing helpers that work with both the normal history router and the
 * hash router used by the single-file (artifact) build.
 */
export const HASH_ROUTING = import.meta.env.VITE_HASH_ROUTER === '1';

/** Turn an app path ("/Lobby?x=1") into an href for raw <a> tags / location. */
export function pageHref(path) {
  return HASH_ROUTING ? `#${path}` : path;
}

/** Query-string params for the current page, wherever the router keeps them. */
export function getQuery() {
  if (HASH_ROUTING) {
    const hash = window.location.hash || '';
    const i = hash.indexOf('?');
    return new URLSearchParams(i === -1 ? '' : hash.slice(i + 1));
  }
  return new URLSearchParams(window.location.search);
}

/** Full navigation (re-mounts the page), used where pages rely on a fresh load. */
export function goTo(path) {
  window.location.href = pageHref(path);
  if (HASH_ROUTING) window.location.reload();
}
