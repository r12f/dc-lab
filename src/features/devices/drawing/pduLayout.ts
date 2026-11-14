import type { DeviceDefinition, PortGroup } from '../../../domain/device/types';
import { formatPortRef } from '../../../domain/device/ports';
import type { PortBox } from './faceplateLayout';

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
const COLS = 2;
const BANK_PAD = 26;

/** Vertical PDU strip: header (input, mgmt) then outlet banks stacked top to bottom. */
export function layoutPdu(device: DeviceDefinition): PduLayout {
  const outlets = device.ports.filter((g) => g.role === 'outlet');
  const others = device.ports.filter((g) => g.role !== 'outlet');
  const headerPorts: PortBox[] = [];
  let hx = 16;
  for (const g of others) {
    for (let i = 0; i < g.count; i++) {
      headerPorts.push({ ref: formatPortRef({ groupId: g.id, index: i + 1 }), group: g, index: i + 1, x: hx, y: 66, w: 70, h: 28 });
      hx += 76;
    }
  }
  const headerH = 106;
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
        const col = i % COLS;
        if (i > 0 && col === 0) row++;
        const big = g.formFactor.toUpperCase() === 'C19';
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
