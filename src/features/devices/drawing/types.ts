import type { ResolvedPort } from '../../../domain/device/portSettings';
import type { Library } from '../../../domain/library/Library';

/** Inputs shared by every device drawing strategy. */
export interface DrawingContext {
  /** Effective setting of a port (mode, reach, module, cable). */
  resolve(portRef: string): ResolvedPort | undefined;
  lib: Library;
  selectedPorts: ReadonlySet<string>;
  onPortClick?(portRef: string, additive: boolean): void;
}
