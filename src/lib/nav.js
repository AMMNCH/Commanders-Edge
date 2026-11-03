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
  if (!HASH_ROUTING) { window.location.href = path; return; }
  const route = (h) => h.replace(/^#/, '').split('?')[0];
  const sameRoute = route(window.location.hash || '#/') === route(path);
  window.location.hash = path;
  // Same page with new params (e.g. switching seats) needs a fresh mount.
  if (sameRoute) window.location.reload();
}
