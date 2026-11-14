import type { BreakoutProfile, DeviceDefinition, PortSetting } from '../../domain/device/types';
import type { Library } from '../../domain/library/library';
import { findGroup, parsePortRef } from '../../domain/device/ports';
import { resolvePort, withSetting } from '../../domain/device/port-settings';
import { ROLE_TRAITS } from '../../domain/device/roles';
import { newProfile } from '../../domain/device/factory';
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
  profileId?: string;
  onProfileChange(id: string | undefined): void;
  selectedPorts: ReadonlySet<string>;
  onSelectPorts(refs: string[]): void;
}

/** Profile list + per-group defaults + per-port settings for the selected ports. */
export function BreakoutProfilesEditor({ lib, device, readOnly, onChange, profileId, onProfileChange, selectedPorts, onSelectPorts }: Props) {
  const profile = device.breakoutProfiles.find((p) => p.id === profileId);
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
      <SelectField label="Profile shown on canvas" value={profileId ?? ''}
        options={[{ value: '', label: '(native — no breakout)' }, ...device.breakoutProfiles.map((p) => ({ value: p.id, label: p.name }))]}
        onChange={(v) => onProfileChange(v || undefined)} />
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
          <Button variant="danger" onClick={() => {
            onChange({ ...device, breakoutProfiles: device.breakoutProfiles.filter((x) => x.id !== profile.id) });
            onProfileChange(undefined);
          }}>Delete profile</Button>
        </fieldset>
      )}
      <div className="chips">
        {['1x', '2x', '4x', '8x'].map((f) => (
          <span key={f} className="chip" style={{ background: modeColor(`${f}100G`), color: '#fff' }}>{f}</span>
        ))}
        <span className="chip">top bar = optic · bottom bar = cable</span>
      </div>
    </Section>
  );
}
