/** Physical kind of a port. */
export type FormFactorKind = 'cage' | 'fiber' | 'copper' | 'power';

export interface FormFactorSpec {
  id: string;
  kind: FormFactorKind;
  /** Module form factors a cage accepts besides its own (backward compatibility). */
  accepts?: string[];
  /** Native per-port speed of a module of this form factor (Gbps), used for compat speed modes. */
  nativeGbps?: number;
}

const spec = (id: string, kind: FormFactorKind, nativeGbps?: number, accepts?: string[]): FormFactorSpec =>
  ({ id, kind, nativeGbps, accepts });

/** Registry of known form factors. Unknown ids are treated as cages that accept only themselves. */
export const FORM_FACTORS: FormFactorSpec[] = [
  spec('SFP+', 'cage', 10),
  spec('SFP28', 'cage', 25, ['SFP+']),
  spec('SFP56', 'cage', 50, ['SFP28', 'SFP+']),
  spec('SFP112', 'cage', 100, ['SFP56', 'SFP28', 'SFP+']),
  spec('QSFP+', 'cage', 40),
  spec('QSFP28', 'cage', 100, ['QSFP+']),
  spec('QSFP56', 'cage', 200, ['QSFP28', 'QSFP+']),
  spec('QSFP112', 'cage', 400, ['QSFP56', 'QSFP28', 'QSFP+']),
  spec('QSFP-DD', 'cage', 400, ['QSFP56', 'QSFP28', 'QSFP+']),
  spec('OSFP', 'cage', 800),
  spec('OSFP-XD', 'cage', 1600),
  spec('ELSFP', 'cage'),
  spec('LC', 'fiber'),
  spec('CS', 'fiber'),
  spec('SN', 'fiber'),
  spec('MPO-12', 'fiber'),
  spec('MPO-16', 'fiber'),
  spec('MMC', 'fiber'),
  spec('MMC-16', 'fiber'),
  spec('RJ45', 'copper'),
  spec('C13', 'power'),
  spec('C19', 'power'),
];

export function formFactorSpec(id: string): FormFactorSpec {
  return FORM_FACTORS.find((f) => f.id.toLowerCase() === id.toLowerCase()) ?? { id, kind: 'cage' };
}

/** Module form factors that physically fit into a cage of `cage` (own form factor first). */
export function acceptedModules(cage: string): string[] {
  return [cage, ...(formFactorSpec(cage).accepts ?? [])];
}

export function moduleFits(cage: string, module: string): boolean {
  return acceptedModules(cage).some((f) => f.toLowerCase() === module.toLowerCase());
}

export function isFiberConnector(id: string): boolean {
  return formFactorSpec(id).kind === 'fiber';
}
