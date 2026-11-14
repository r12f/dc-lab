import type { Library } from '../domain/library/library';
import type { PortGroup, PortSetting } from '../domain/device/types';
import type { ResolvedPort } from '../domain/device/port-settings';
import { modesOf, speedLabel } from '../domain/device/breakout';
import { ROLE_TRAITS } from '../domain/device/roles';
import { cableConnector, compatibleCables, compatibleOptics, directAttachType, isEnginePort, moduleType, moduleTypeLabel, modulesOfType, reachOptions } from '../domain/ports/optic-match';
import { reachOrder } from '../domain/optics/grouping';
import { SelectField } from './fields';

const INHERIT = '__inherit';
const NONE = '';

interface Props {
  lib: Library;
  group: PortGroup;
  value: PortSetting;
  onChange(value: PortSetting): void;
  /** What the port resolves to with `value` applied (drives option filtering). */
  effective?: ResolvedPort;
  /** What the port resolves to without `value` (shown as "inherit (…)"). */
  inherited?: ResolvedPort;
  /**
   * Breakout profile: only cage + connector matter — no cable pick, no DAC/AEC/AOC reach (an empty cage's
   * connector is the cage itself; direct-attach cables are chosen in the Rack Designer cabling view).
   */
  profile?: boolean;
}

const field = (v: string | undefined) => (v === undefined ? INHERIT : v);
const unfield = (v: string) => (v === INHERIT ? undefined : v);

/**
 * Speed → Module Type → Module → (cable) for one port or group.
 * - Module Type: None, or a reach class the cage takes at <= port speed (2xDR4, 2xLR4, DR4…; variants such as
 *   "2xDR4 LPO" / "2 km" and PSM4 fold into their type). The cable connector follows from it and is shown.
 *   None leaves the cage empty: the connector is the cage form factor (OSFP, QSFP-DD…).
 * - Module (when a type is set): every module of that type the cage takes (QSFP-DD takes QSFP56 / QSFP28, not
 *   the reverse) at <= port speed — "auto" picks the one at the breakout's speed.
 * Rack Designer (not `profile`) also offers DAC / AEC / AOC and the cable. CPO/NPO ports pick the engine reach.
 */
export function PortSettingFields({ lib, group, value, onChange, effective, inherited, profile }: Props) {
  if (group.role === 'laser') return <LaserModuleField lib={lib} group={group} value={value} onChange={onChange} inherited={inherited} />;
  if (!ROLE_TRAITS[group.role].pluggable) {
    return <p className="muted">{`${ROLE_TRAITS[group.role].label} ports have no speed or reach settings.`}</p>;
  }
  const engine = isEnginePort(group);
  const mode = effective?.mode ?? value.mode ?? modesOf(group)[0];
  const types = reachOptions(lib, group, mode).filter((r) => !profile || !directAttachType(r))
    .sort((x, y) => Number(!!directAttachType(y)) - Number(!!directAttachType(x)) || reachOrder(x) - reachOrder(y));
  const type = effective?.reach && !directAttachType(effective.reach) ? moduleType(effective.reach) : undefined;
  const label = (r?: string) => (r && !directAttachType(r) ? moduleTypeLabel(moduleType(r), group.speedGbps) : r);
  const modules = type && !engine ? modulesOfType(lib, group, type) : [];
  const cables = compatibleCables(lib, group, effective?.optic, effective?.reach, mode);
  const set = (patch: PortSetting) => onChange({ ...value, ...patch });
  const inh = (s?: string) => `inherit (${s ?? 'none'})`;
  const connector = connectorText(group, effective);

  return (
    <>
      <SelectField label="Speed / breakout" value={field(value.mode)}
        options={[{ value: INHERIT, label: inh(inherited && speedLabel(inherited.mode)) }, ...modesOf(group).map((m) => ({ value: m, label: speedLabel(m) || m }))]}
        onChange={(v) => set({ mode: unfield(v), opticId: undefined })} />
      <SelectField label={engine ? `Reach (${group.opticalEngine?.toUpperCase() ?? 'fiber'} engine)` : 'Module Type'} value={field(engine ? value.reach : label(value.reach))}
        options={[
          { value: INHERIT, label: inh(inherited?.reach ? label(inherited.reach) : inherited ? 'None' : undefined) },
          { value: NONE, label: engine ? 'unset' : 'None' },
          ...types.map((r) => ({ value: r, label: r })),
        ]}
        onChange={(v) => set({ reach: unfield(v), opticId: undefined })} />
      {modules.length > 0 && (
        <SelectField label="Module" value={field(value.opticId)}
          options={[
            { value: INHERIT, label: effective?.optic && effective.autoOptic ? `auto: ${effective.optic.name}` : inh(inherited?.optic?.name) },
            ...modules.map((o) => ({ value: o.id, label: `${o.name}${o.formFactor !== group.formFactor ? ` (${o.formFactor} in ${group.formFactor})` : ''}` })),
          ]}
          onChange={(v) => set({ opticId: unfield(v) })} />
      )}
      <p className="muted">{`Connector Type: ${connector}`}</p>
      {!profile && (
        <SelectField label={`Cable (fits ${connector})`}
          value={field(value.cableId)}
          options={[
            { value: INHERIT, label: inh(lib.cableMedia.get(inherited?.cableId)?.name) },
            { value: NONE, label: 'none' },
            ...cables.map((c) => ({ value: c.id, label: c.name })),
          ]}
          onChange={(v) => set({ cableId: unfield(v) })} />
      )}
      {!engine && missingModule(lib, group, mode, effective) && <p className="muted">{missingModule(lib, group, mode, effective)}</p>}
    </>
  );
}

/** The port's cable connector(s): the module's ("2x MPO-12", "LC"), else the reach's, else the cage itself ("OSFP"). */
function connectorText(group: PortGroup, eff?: ResolvedPort): string {
  if (isEnginePort(group)) return group.formFactor;
  if (eff?.optic?.fiberConnector) return eff.optic.fiberConnector;
  return cableConnector(group, undefined, eff?.reach) ?? group.formFactor;
}

/** External laser source cages (CPO): only a module choice. */
function LaserModuleField({ lib, group, value, onChange, inherited }: Omit<Props, 'effective'>) {
  const modules = lib.optics.items().filter((o) => o.formFactor === group.formFactor);
  return (
    <SelectField label={`Laser module (${group.formFactor})`} value={field(value.opticId)}
      options={[
        { value: INHERIT, label: `inherit (${inherited?.optic?.name ?? 'none'})` },
        { value: NONE, label: 'none (empty cage)' },
        ...modules.map((o) => ({ value: o.id, label: o.name })),
      ]}
      onChange={(v) => onChange({ ...value, opticId: unfield(v) })} />
  );
}

/** Hint when the chosen speed/reach has no module in the catalog. */
function missingModule(lib: Library, group: PortGroup, mode: string, eff?: ResolvedPort): string | undefined {
  if (!eff?.reach || eff.optic || directAttachType(eff.reach)) return undefined;
  return compatibleOptics(lib, group, mode).length
    ? `No ${eff.reach} module for ${group.formFactor} at ${mode} in the catalog.`
    : `No module in the catalog fits ${group.formFactor} at ${mode}.`;
}
