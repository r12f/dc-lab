import { formatGbps } from '../../../domain/units';
import type { PortGroup } from '../../../domain/device/types';
import { groupConnector } from '../../../domain/device/port-label';

/**
 * Label above a port group: form factor and native speed, e.g. "QSFP-DD 400G ×32",
 * "MPO-16 800G CPO ×128", "MGMT RJ45 1G". Uses the group label when it differs from the form factor.
 */
export function groupTitle(g: PortGroup): string {
  const c = groupConnector(g);
  const name = g.label && g.label !== g.formFactor ? `${g.label} ${c}` : c;
  const speed = g.speedGbps > 0 ? ` ${formatGbps(g.speedGbps)}` : '';
  const engine = g.opticalEngine ? ` ${g.opticalEngine.toUpperCase()}` : '';
  const count = g.count > 1 ? ` ×${g.count}` : '';
  return `${name}${speed}${engine}${count}`;
}
