import type { BreakoutProfile, DeviceDefinition, PortSetting } from '../../domain/device/types';
import type { Library } from '../../domain/library/library';
import { findGroup, parsePortRef } from '../../domain/device/ports';
import { resolvePort, withSetting } from '../../domain/device/port-settings';
import { ROLE_TRAITS } from '../../domain/device/roles';
import { newProfile } from '../../domain/device/factory';
import { findProfile } from '../../domain/device/breakout';
import { uniqueId } from '../../domain/ids';
import { Button } from '../../ui/button';
import { Section, SelectField, TextField } from '../../ui/fields';
import { PortSettingFields } from '../../ui/port-setting-fields';
import { modeColor } from './drawing/port-style';
import { ProfileOverridesList } from './profile-overrides-list';

interface Props {
  lib: Library;
  device: DeviceDefinition;
  readOnly: boolean;
  onChange(device: DeviceDefinition): void;
  /** Built-in device: profiles are still editable, saved through this (only profile fields change). */
  onProfilesChange?(device: DeviceDefinition): void;
  /** Built-in device whose profiles were edited: puts the shipped ones back. */
  onResetProfiles?(): void;
  profileId?: string;
  onProfileChange(id: string | undefined): void;
  selectedPorts: ReadonlySet<string>;
  onSelectPorts(refs: string[]): void;
}

/** Profile list + per-group defaults + per-port settings for the selected ports. */
export function BreakoutProfilesEditor(props: Props) {
  const { lib, device, profileId, onProfileChange, selectedPorts, onSelectPorts, onResetProfiles } = props;
  // Profiles of a built-in device are editable even though the device itself is read-only.
  const onChange = props.onProfilesChange ?? props.onChange;
  const readOnly = props.readOnly && !props.onProfilesChange;
  // No explicit pick = the device's default profile (what placements use when they pick none).
  const profile = findProfile(device, profileId);
  const isDefault = profile?.id === device.defaultProfileId;
  const setProfile = (p: BreakoutProfile) =>
    onChange({ ...device, breakoutProfiles: device.breakoutProfiles.map((x) => (x.id === p.id ? p : x)) });
  const add = () => {
    const p = newProfile(uniqueId('profile', device.breakoutProfiles.map((x) => x.id)), 'New profile');
    onChange({ ...device, breakoutProfiles: [...device.breakoutProfiles, p] });
    onProfileChange(p.id);
  };

  const refs = [...selectedPorts];
  const groups = [...new Set(refs.map((r) => parsePortRef(r)?.groupId))];
  const selGroup = groups.length === 1 && groups[0] ? findGroup(device, groups[0]) : undefined;
  /** Shared value across selected ports for each field (undefined when they differ). */
  const shared: PortSetting = {};
  if (profile && refs.length) {
    for (const key of ['mode', 'reach', 'opticId', 'cableId'] as const) {
      const vals = new Set(refs.map((r) => profile.overrides[r]?.[key]));
      if (vals.size === 1) shared[key] = [...vals][0];
    }
  }
  /** Resolution of a port without its profile override (what "inherit" means). */
  const inheritedFor = (ref: string) => resolvePort(lib, device, ref, profile && { ...profile, overrides: {} });
  /** Resolution with the shared override applied (drives option filtering). */
  const effectiveFor = (ref: string, setting: PortSetting) =>
    resolvePort(lib, device, ref, profile && { ...profile, overrides: withSetting(profile.overrides, ref, setting) });
  const applyToSelected = (setting: PortSetting) => {
    if (!profile) return;
    let overrides = profile.overrides;
    for (const r of refs) overrides = withSetting(overrides, r, setting);
    setProfile({ ...profile, overrides });
  };

  return (
    <Section title="Breakout profiles" actions={!readOnly && <Button onClick={add}>+ Profile</Button>}>
      <SelectField label="Profile shown on canvas" value={profile?.id ?? ''}
        options={device.breakoutProfiles.map((p) => ({ value: p.id, label: `${p.name}${p.id === device.defaultProfileId ? ' (default)' : ''}` }))}
        onChange={(v) => onProfileChange(v || undefined)} />
      {profile && !readOnly && !isDefault && (
        <Button onClick={() => onChange({ ...device, defaultProfileId: profile.id })}>Make default</Button>
      )}
      {onResetProfiles && <Button onClick={onResetProfiles} title="Discard this project's profile edits">Reset to built-in profiles</Button>}
      {profile && (
        <fieldset disabled={readOnly} className="plain">
          <TextField label="Profile name" value={profile.name} onChange={(name) => setProfile({ ...profile, name })} />
          {refs.length > 0 && selGroup ? (
            <div className="card">
              <strong>{refs.length === 1 ? `Port ${refs[0]}` : `${refs.length} ports in ${selGroup.label}`}</strong>
              <PortSettingFields lib={lib} group={selGroup} value={shared} inherited={inheritedFor(refs[0])}
                effective={effectiveFor(refs[0], shared)}
                onChange={applyToSelected} />
              <div className="row2">
                <Button onClick={() => onSelectPorts(Array.from({ length: selGroup.count }, (_, i) => `${selGroup.id}/${i + 1}`))}>
                  Select whole group
                </Button>
                <Button onClick={() => applyToSelected({})}>Clear overrides</Button>
              </div>
            </div>
          ) : (
            <p className="muted">{refs.length ? 'Select ports from a single group.' : 'Click ports on the canvas to configure them.'}</p>
          )}
          <details className="card">
            <summary>Group defaults</summary>
            {device.ports.filter((g) => ROLE_TRAITS[g.role].pluggable || g.role === 'laser').map((g) => (
              <div key={g.id} className="subcard">
                <strong>{g.label}</strong>
                <PortSettingFields lib={lib} group={g} value={profile.groupDefaults[g.id] ?? {}}
                  effective={resolvePort(lib, device, `${g.id}/1`, { ...profile, overrides: {} })}
                  onChange={(s) => setProfile({ ...profile, groupDefaults: withSetting(profile.groupDefaults, g.id, s) })} />
              </div>
            ))}
          </details>
          <ProfileOverridesList lib={lib} profile={profile} onSelect={(r) => onSelectPorts([r])} />
          {isDefault
            ? <p className="muted">Default profile: used by placements that pick none. Make another profile default to delete it.</p>
            : <Button variant="danger" onClick={() => {
              onChange({ ...device, breakoutProfiles: device.breakoutProfiles.filter((x) => x.id !== profile.id) });
              onProfileChange(undefined);
            }}>Delete profile</Button>}
        </fieldset>
      )}
      <div className="chips">
        {['1x', '2x', '4x', '8x'].map((f) => (
          <span key={f} className="chip" style={{ background: modeColor(`${f}100G`), color: '#0f172a' }}>{f}</span>
        ))}
        <span className="chip">top bar = optic · bottom boxes = cable connectors</span>
      </div>
    </Section>
  );
}
