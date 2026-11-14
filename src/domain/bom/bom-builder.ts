import type { BomLine } from './types';

/** Accumulates BOM lines, merging lines with the same key. */
export class BomBuilder {
  private readonly lines = new Map<string, BomLine>();

  add(line: BomLine): this {
    const existing = this.lines.get(line.key);
    if (!existing) {
      this.lines.set(line.key, { ...line, notes: [...line.notes] });
      return this;
    }
    existing.qty += line.qty;
    if (line.lengthM !== undefined) existing.lengthM = (existing.lengthM ?? 0) + line.lengthM;
    for (const n of line.notes) if (!existing.notes.includes(n)) existing.notes.push(n);
    return this;
  }

  addAll(lines: BomLine[], multiplier = 1): this {
    for (const l of lines) {
      this.add({ ...l, qty: l.qty * multiplier, lengthM: l.lengthM === undefined ? undefined : l.lengthM * multiplier });
    }
    return this;
  }

  build(): BomLine[] {
    const order = { rack: 0, device: 1, optic: 2, cable: 3 } as const;
    return [...this.lines.values()].sort((a, b) => order[a.kind] - order[b.kind] || a.item.localeCompare(b.item));
  }
}
