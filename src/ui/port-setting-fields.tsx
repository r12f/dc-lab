import type { Library } from '../domain/library/library';
import type { PortGroup, PortSetting } from '../domain/device/types';
import type { ResolvedPort } from '../domain/device/port-settings';
import { modesOf, speedLabel } from '../domain/device/breakout';
import { ROLE_TRAITS } from '../domain/device/roles';
import { cableConnector, compatibleCables, compatibleOptics, directAttachType, isEnginePort, pickOptic, reachOptions } from '../domain/ports/optic-match';
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
 * Speed → module → (cable) for one port or group. The module list is "none" plus the reach classes the cage
 * takes at that speed (2xDR4, 2xLR4…): speed + reach fix the module and hence the cable connector, which is
 * shown below — "none" leaves the cage empty and its connector is the cage form factor (OSFP, QSFP-DD…).
 * Rack Designer (not `profile`) also lists DAC / AEC / AOC and picks the cable. CPO/NPO ports pick the engine reach.
 */
export function PortSettingFields({ lib, group, value, onChange, effective, inherited, profile }: Props) {
  if (group.role === 'laser') return <LaserModuleField lib={lib} group={group} value={value} onChange={onChange} inherited={inherited} />;
  if (!ROLE_TRAITS[group.role].pluggable) {
    return <p className="muted">{`${ROLE_TRAITS[group.role].label} ports have no speed or reach settings.`}</p>;
  }
  const engine = isEnginePort(group);
  const mode = effective?.mode ?? value.mode ?? modesOf(group)[0];
  const reaches = reachOptions(lib, group, mode).filter((r) => !profile || !directAttachType(r));
  const cables = compatibleCables(lib, group, effective?.optic, effective?.reach, mode);
  const set = (patch: PortSetting) => onChange({ ...value, ...patch });
  const inh = (s?: string) => `inherit (${s ?? 'none'})`;
  /** "2xDR4 — 2x MPO-12": the reach and the connector its module gives. */
  const reachLabel = (r: string) => {
    if (engine || directAttachType(r)) return r;
    const o = pickOptic(lib, group, mode, r);
    return o?.fiberConnector ? `${r} — ${o.fiberConnector}` : r;
  };
  const connector = connectorText(group, effective);

  return (
    <>
      <SelectField label="Speed / breakout" value={field(value.mode)}
        options={[{ value: INHERIT, label: inh(inherited && speedLabel(inherited.mode)) }, ...modesOf(group).map((m) => ({ value: m, label: speedLabel(m) || m }))]}
        onChange={(v) => set({ mode: unfield(v), opticId: undefined })} />
      <SelectField label={engine ? `Reach (${group.opticalEngine?.toUpperCase() ?? 'fiber'} engine)` : `Module (${group.formFactor} cage)`} value={field(value.reach)}
        options={[
          { value: INHERIT, label: inh(inherited?.reach ?? (inherited ? 'none' : undefined)) },
          { value: NONE, label: engine ? 'unset' : 'none' },
          ...reaches.map((r) => ({ value: r, label: reachLabel(r) })),
        ]}
        onChange={(v) => set({ reach: unfield(v), opticId: undefined })} />
      <p className="muted">{`Cable connector: ${connector}`}</p>
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
