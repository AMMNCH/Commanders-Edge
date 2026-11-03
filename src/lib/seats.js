/**
 * Seat layouts for a phone lying flat in the middle of the table.
 * Players are listed in clockwise turn order. Rotation is the direction each
 * player's panel faces: 0 = bottom edge, 180 = top edge, 90 = left edge,
 * -90 = right edge.
 */
const L = 90;
const R = -90;
const T = 180;

const LAYOUTS = {
  1: { cols: 1, rows: 1, seats: [{ row: 1, col: 1, rot: 0 }] },
  2: { cols: 1, rows: 2, seats: [{ row: 1, col: 1, rot: T }, { row: 2, col: 1, rot: 0 }] },
  3: { cols: 2, rows: 2, seats: [
    { row: 1, col: 1, colSpan: 2, rot: T },
    { row: 2, col: 2, rot: R },
    { row: 2, col: 1, rot: L },
  ] },
  4: { cols: 2, rows: 2, seats: [
    { row: 1, col: 1, rot: L }, { row: 1, col: 2, rot: R },
    { row: 2, col: 2, rot: R }, { row: 2, col: 1, rot: L },
  ] },
  5: { cols: 2, rows: 3, seats: [
    { row: 1, col: 1, colSpan: 2, rot: T },
    { row: 2, col: 2, rot: R }, { row: 3, col: 2, rot: R },
    { row: 3, col: 1, rot: L }, { row: 2, col: 1, rot: L },
  ] },
  6: { cols: 2, rows: 3, seats: [
    { row: 1, col: 1, rot: L }, { row: 1, col: 2, rot: R }, { row: 2, col: 2, rot: R },
    { row: 3, col: 2, rot: R }, { row: 3, col: 1, rot: L }, { row: 2, col: 1, rot: L },
  ] },
};

/** Upright layout for desktops/landscape: a plain grid, nobody rotated. */
function upright(n) {
  const cols = n <= 2 ? n : n <= 4 ? 2 : 3;
  const rows = Math.ceil(n / cols);
  return {
    cols, rows,
    seats: Array.from({ length: n }, (_, i) => ({ row: Math.floor(i / cols) + 1, col: (i % cols) + 1, rot: 0 })),
  };
}

export function seatLayout(n, mode = 'table') {
  if (mode === 'upright') return upright(n);
  return LAYOUTS[Math.min(6, Math.max(1, n))];
}

export function resolveSeatMode(setting) {
  if (setting === 'table' || setting === 'upright') return setting;
  if (typeof window === 'undefined') return 'table';
  return window.innerWidth > window.innerHeight * 1.1 ? 'upright' : 'table';
}
