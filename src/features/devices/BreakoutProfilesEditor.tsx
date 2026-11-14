import type { BreakoutProfile, DeviceDefinition } from '../../domain/device/types';
import { modesOf } from '../../domain/device/breakout';
import { findGroup, parsePortRef } from '../../domain/device/ports';
import { newProfile } from '../../domain/device/factory';
import { uniqueId } from '../../domain/ids';
import { Button } from '../../ui/Button';
import { Section, SelectField, TextField } from '../../ui/fields';
import { modeColor } from './modeColors';

interface Props {
  device: DeviceDefinition;
  readOnly: boolean;
  onChange(device: DeviceDefinition): void;
  profileId?: string;
  onProfileChange(id: string | undefined): void;
  selectedPort?: string;
}

const INHERIT = '';

function withEntry(map: Record<string, string>, key: string, value: string): Record<string, string> {
  const next = { ...map };
  if (value === INHERIT) delete next[key];
  else next[key] = value;
  return next;
}

export function BreakoutProfilesEditor({ device, readOnly, onChange, profileId, onProfileChange, selectedPort }: Props) {
  const profile = device.breakoutProfiles.find((p) => p.id === profileId);
  const setProfile = (p: BreakoutProfile) =>
    onChange({ ...device, breakoutProfiles: device.breakoutProfiles.map((x) => (x.id === p.id ? p : x)) });
  const add = () => {
    const p = newProfile(uniqueId('profile', device.breakoutProfiles.map((x) => x.id)), 'New profile');
    onChange({ ...device, breakoutProfiles: [...device.breakoutProfiles, p] });
    onProfileChange(p.id);
  };
  const removeProfile = () => {
    if (!profile) return;
    onChange({ ...device, breakoutProfiles: device.breakoutProfiles.filter((x) => x.id !== profile.id) });
    onProfileChange(undefined);
  };

  const portRef = selectedPort && parsePortRef(selectedPort);
  const portGroup = portRef ? findGroup(device, portRef.groupId) : undefined;

  return (
    <Section title="Breakout profiles" actions={!readOnly && <Button onClick={add}>+ Profile</Button>}>
      <SelectField
        label="Profile shown on canvas"
        value={profileId ?? INHERIT}
        options={[{ value: INHERIT, label: '(native — no breakout)' }, ...device.breakoutProfiles.map((p) => ({ value: p.id, label: p.name }))]}
        onChange={(v) => onProfileChange(v || undefined)}
      />
      {profile && (
        <fieldset disabled={readOnly} className="plain">
          <TextField label="Profile name" value={profile.name} onChange={(name) => setProfile({ ...profile, name })} />
          {device.ports.map((g) => (
            <SelectField
              key={g.id}
              label={`${g.label} default`}
              value={profile.groupDefaults[g.id] ?? INHERIT}
              options={[{ value: INHERIT, label: 'native' }, ...modesOf(g).map((m) => ({ value: m, label: m }))]}
              onChange={(v) => setProfile({ ...profile, groupDefaults: withEntry(profile.groupDefaults, g.id, v) })}
            />
          ))}
          {selectedPort && portGroup ? (
            <SelectField
              label={`Port ${selectedPort} override`}
              value={profile.overrides[selectedPort] ?? INHERIT}
              options={[{ value: INHERIT, label: 'group default' }, ...modesOf(portGroup).map((m) => ({ value: m, label: m }))]}
              onChange={(v) => setProfile({ ...profile, overrides: withEntry(profile.overrides, selectedPort, v) })}
            />
          ) : (
            <p className="muted">Click a port on the canvas to override its breakout.</p>
          )}
          {Object.keys(profile.overrides).length > 0 && (
            <div className="chips">
              {Object.entries(profile.overrides).map(([ref, mode]) => (
                <span key={ref} className="chip" style={{ borderColor: modeColor(mode) }}>{ref}: {mode}</span>
              ))}
            </div>
          )}
          <Button variant="danger" onClick={removeProfile}>Delete profile</Button>
        </fieldset>
      )}
      <Legend />
    </Section>
  );
}

function Legend() {
  return (
    <div className="chips">
      {['1x', '2x', '4x', '8x'].map((f) => (
        <span key={f} className="chip" style={{ background: modeColor(`${f}100G`), color: '#fff' }}>{f}</span>
      ))}
    </div>
  );
}
