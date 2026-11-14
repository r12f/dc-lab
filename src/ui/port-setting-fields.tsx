import type { Library } from '../domain/library/library';
import type { PortGroup, PortSetting } from '../domain/device/types';
import type { ResolvedPort } from '../domain/device/port-settings';
import { modesOf, speedLabel } from '../domain/device/breakout';
import { ROLE_TRAITS } from '../domain/device/roles';
import { cableConnector, compatibleCables, compatibleOptics, directAttachType, isEnginePort, reachOptions } from '../domain/ports/optic-match';
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
 * Speed → reach → module → cable for one port or group. Options are filtered by the cage form factor
 * (incl. backward-compatible modules), the chosen speed and reach. CPO/NPO fiber ports pick reach from
 * the engine and have no module.
 */
export function PortSettingFields({ lib, group, value, onChange, effective, inherited, profile }: Props) {
  if (group.role === 'laser') return <LaserModuleField lib={lib} group={group} value={value} onChange={onChange} inherited={inherited} />;
  if (!ROLE_TRAITS[group.role].pluggable) {
    return <p className="muted">{`${ROLE_TRAITS[group.role].label} ports have no speed or reach settings.`}</p>;
  }
  const engine = isEnginePort(group);
  const mode = effective?.mode ?? value.mode ?? modesOf(group)[0];
  const reaches = reachOptions(lib, group, mode).filter((r) => !profile || !directAttachType(r));
  const modules = compatibleOptics(lib, group, mode).filter((o) => !effective?.reach || o.reach === effective.reach);
  const cables = compatibleCables(lib, group, effective?.optic, effective?.reach, mode);
  const direct = !engine && !!directAttachType(effective?.reach);
  const set = (patch: PortSetting) => onChange({ ...value, ...patch });
  const inh = (s?: string) => `inherit (${s ?? 'none'})`;

  return (
    <>
      <SelectField label="Speed / breakout" value={field(value.mode)}
        options={[{ value: INHERIT, label: inh(inherited && speedLabel(inherited.mode)) }, ...modesOf(group).map((m) => ({ value: m, label: speedLabel(m) || m }))]}
        onChange={(v) => set({ mode: unfield(v), opticId: undefined })} />
      <SelectField label={engine ? `Reach (${group.opticalEngine?.toUpperCase() ?? 'fiber'} engine)` : 'Reach'} value={field(value.reach)}
        options={[
          { value: INHERIT, label: inh(inherited?.reach) },
          { value: NONE, label: engine ? 'unset' : profile ? `none — no module (${group.formFactor} cage: DAC / AEC / AOC)` : 'none (empty cage)' },
          ...reaches.map((r) => ({ value: r, label: r })),
        ]}
        onChange={(v) => set({ reach: unfield(v), opticId: undefined })} />
      {!engine && !direct && (
        <SelectField label={`Module (${group.formFactor} cage)`} value={field(value.opticId)}
          options={[
            { value: INHERIT, label: effective?.optic && effective.autoOptic ? `auto: ${effective.optic.name}` : inh(inherited?.optic?.name) },
            ...modules.map((o) => ({ value: o.id, label: `${o.name}${o.formFactor !== group.formFactor ? ` (${o.formFactor} in ${group.formFactor})` : ''}` })),
          ]}
          onChange={(v) => set({ opticId: unfield(v) })} />
      )}
      {!direct && (
        <p className="muted">{`Cable connector: ${connectorText(group, effective) ?? '— (pick a reach / module)'}`}</p>
      )}
      {!profile && (
        <SelectField label={`Cable${connectorText(group, effective) ? ` (fits ${connectorText(group, effective)})` : ''}`}
          value={field(value.cableId)}
          options={[
            { value: INHERIT, label: inh(lib.cableMedia.get(inherited?.cableId)?.name) },
            { value: NONE, label: 'none' },
            ...cables.map((c) => ({ value: c.id, label: c.name })),
          ]}
          onChange={(v) => set({ cableId: unfield(v) })} />
      )}
      {direct && <p className="muted">{`${effective?.reach} cable plugs into the ${group.formFactor} cage directly — no transceiver.`}</p>}
      {!engine && !direct && modes(lib, group, mode, effective) && <p className="muted">{modes(lib, group, mode, effective)}</p>}
    </>
  );
}

/** The port's cable connector(s), fixed by the module (or the reach): "2x MPO-12", "LC", "MPO-16". */
function connectorText(group: PortGroup, eff?: ResolvedPort): string | undefined {
  if (isEnginePort(group)) return group.formFactor;
  if (eff?.optic?.fiberConnector) return eff.optic.fiberConnector;
  const c = cableConnector(group, undefined, eff?.reach);
  return c === group.formFactor ? `${c} (no module: DAC / AEC / AOC)` : c;
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
function modes(lib: Library, group: PortGroup, mode: string, eff?: ResolvedPort): string | undefined {
  if (!eff?.reach || eff.optic) return undefined;
  return compatibleOptics(lib, group, mode).length
    ? `No ${eff.reach} module for ${group.formFactor} at ${mode} in the catalog.`
    : `No module in the catalog fits ${group.formFactor} at ${mode}.`;
}
