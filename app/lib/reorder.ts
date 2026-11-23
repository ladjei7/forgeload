/** Moves one item to a new position; the others keep their order. Out-of-range moves return the list unchanged. */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  if (from < 0 || from >= list.length || to < 0 || to >= list.length || from === to) return [...list];
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/**
 * Where a dragged row belongs: the row the pointer is over (rows in their current order, with
 * their top and bottom on screen). Above the first row is the top; below the last is the bottom.
 */
export function slotForY(y: number, rows: readonly { top: number; bottom: number }[]): number {
  for (let i = 0; i < rows.length; i++) if (y < rows[i].bottom) return i;
  return Math.max(0, rows.length - 1);
}
