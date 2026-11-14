/**
 * Rows drawn for an end of `count` connectors, at most `max` rows. Long ends keep the first and the last
 * connectors and elide the middle, so the drawing still shows where the end stops (A1…A4, ⋮, A18…A20).
 * Each row is a 0-based connector index, or `{ gap }` = how many connectors the elided row stands for.
 */
export type ConnectorSlot = number | { gap: number };

export function connectorSlots(count: number, max = 8): ConnectorSlot[] {
  if (count <= max) return Array.from({ length: count }, (_, i) => i);
  const head = Math.ceil((max - 1) / 2);
  const tail = max - 1 - head;
  return [
    ...Array.from({ length: head }, (_, i) => i),
    { gap: count - head - tail },
    ...Array.from({ length: tail }, (_, i) => count - tail + i),
  ];
}
