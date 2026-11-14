import type { Library } from '../domain/library/Library';
import type { PortGroup, PortSetting } from '../domain/device/types';
import { modesOf } from '../domain/device/breakout';
import { ROLE_TRAITS } from '../domain/device/roles';
import { SelectField } from './fields';

const INHERIT = '__inherit';
const NONE = '';

interface Props {
  lib: Library;
  group: PortGroup;
  value: PortSetting;
  onChange(value: PortSetting): void;
  /** Labels describing what "inherit" resolves to. */
  inherited?: { mode?: string; optic?: string; cable?: string };
}

const field = (v: string | undefined) => (v === undefined ? INHERIT : v);
const unfield = (v: string) => (v === INHERIT ? undefined : v);

/** Breakout mode, optic and cable selectors for one port or one group. */
export function PortSettingFields({ lib, group, value, onChange, inherited }: Props) {
  if (!ROLE_TRAITS[group.role].pluggable) {
    return <p className="muted">{`${ROLE_TRAITS[group.role].label} ports have no breakout or optics.`}</p>;
  }
  const optics = lib.optics.items().filter((o) => o.connector === group.connector);
  const cables = lib.cableMedia.items();
  const set = (patch: PortSetting) => onChange({ ...value, ...patch });
  return (
    <>
      <SelectField label="Breakout (speed)" value={field(value.mode)}
        options={[{ value: INHERIT, label: `inherit (${inherited?.mode ?? 'native'})` }, ...modesOf(group).map((m) => ({ value: m, label: m }))]}
        onChange={(v) => set({ mode: unfield(v) })} />
      <SelectField label={`Optic (${group.connector})`} value={field(value.opticId)}
        options={[
          { value: INHERIT, label: `inherit (${inherited?.optic ?? 'none'})` },
          { value: NONE, label: 'none' },
          ...optics.map((o) => ({ value: o.id, label: o.name })),
        ]}
        onChange={(v) => set({ opticId: unfield(v) })} />
      <SelectField label="Cable" value={field(value.cableId)}
        options={[
          { value: INHERIT, label: `inherit (${inherited?.cable ?? 'none'})` },
          { value: NONE, label: 'none' },
          ...cables.map((c) => ({ value: c.id, label: c.name })),
        ]}
        onChange={(v) => set({ cableId: unfield(v) })} />
    </>
  );
}
