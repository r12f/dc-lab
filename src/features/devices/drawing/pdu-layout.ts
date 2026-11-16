import type { DeviceDefinition, PortGroup } from '../../../domain/device/types';
import { formatPortRef } from '../../../domain/device/ports';
import type { PortBox } from './faceplate-layout';

export interface BankBlock {
  bank: string;
  groups: PortGroup[];
  y: number;
  h: number;
}

export interface PduLayout {
  width: number;
  height: number;
  headerH: number;
  banks: BankBlock[];
  ports: PortBox[];
  /** Non-outlet ports (mgmt/console) in the header. */
  headerPorts: PortBox[];
}

const W = 180;
const OUT = { w: 46, h: 32, gap: 6 };
const BANK_PAD = 26;

/** Vertical PDU strip: header (input, mgmt) then outlet banks stacked top to bottom. */
export function layoutPdu(device: DeviceDefinition): PduLayout {
  const outlets = device.ports.filter((g) => g.role === 'outlet');
  const others = device.ports.filter((g) => g.role !== 'outlet');
  // Header ports (mgmt, console, sensor…) wrap two per row so they stay inside the strip.
  const headerPorts: PortBox[] = [];
  const HP = { w: 70, h: 28, gapX: 8, gapY: 6, perRow: 2, y0: 66 };
  const x0 = (W - (HP.perRow * HP.w + (HP.perRow - 1) * HP.gapX)) / 2;
  let n = 0;
  for (const g of others) {
    for (let i = 0; i < g.count; i++, n++) {
      const col = n % HP.perRow;
      const row = Math.floor(n / HP.perRow);
      headerPorts.push({ ref: formatPortRef({ groupId: g.id, index: i + 1 }), group: g, index: i + 1,
        x: x0 + col * (HP.w + HP.gapX), y: HP.y0 + row * (HP.h + HP.gapY), w: HP.w, h: HP.h });
    }
  }
  const headerRows = Math.max(1, Math.ceil(n / HP.perRow));
  const headerH = HP.y0 + headerRows * (HP.h + HP.gapY) + 6;
  const bankNames = [...new Set(outlets.map((g) => g.bank ?? '-'))];
  const banks: BankBlock[] = [];
  const ports: PortBox[] = [];
  let y = headerH;
  for (const bank of bankNames) {
    const groups = outlets.filter((g) => (g.bank ?? '-') === bank);
    let row = 0;
    const y0 = y + BANK_PAD;
    for (const g of groups) {
      for (let i = 0; i < g.count; i++) {
        // A vertical strip: one column of outlets unless the group asks for more (`rows` = outlets side by side).
        const cols = Math.max(1, g.rows);
        const col = i % cols;
        if (i > 0 && col === 0) row++;
        const big = ['C19', 'C13/C19'].includes(g.formFactor.toUpperCase());
        ports.push({
          ref: formatPortRef({ groupId: g.id, index: i + 1 }), group: g, index: i + 1,
          x: 30 + col * (OUT.w + OUT.gap + 24), y: y0 + row * (OUT.h + OUT.gap), w: big ? OUT.w + 10 : OUT.w, h: OUT.h,
        });
      }
      row++;
    }
    const h = BANK_PAD + row * (OUT.h + OUT.gap) + 8;
    banks.push({ bank, groups, y, h });
    y += h + 6;
  }
  return { width: W, height: y + 10, headerH, banks, ports, headerPorts };
}
