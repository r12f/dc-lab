import type { BreakoutProfile } from '../../domain/device/types';
import type { Library } from '../../domain/library/Library';

/** Compact list of per-port overrides in a profile; click to select the port. */
export function ProfileOverridesList({ lib, profile, onSelect }: { lib: Library; profile: BreakoutProfile; onSelect(ref: string): void }) {
  const entries = Object.entries(profile.overrides);
  if (entries.length === 0) return null;
  return (
    <details className="card" open>
      <summary>{`Port overrides (${entries.length})`}</summary>
      <table className="table">
        <tbody>
          {entries.map(([ref, s]) => (
            <tr key={ref} onClick={() => onSelect(ref)} style={{ cursor: 'pointer' }}>
              <td>{ref}</td>
              <td>{s.mode ?? ''}</td>
              <td>{s.opticId === '' ? 'no optic' : lib.optics.get(s.opticId)?.name ?? ''}</td>
              <td>{s.cableId === '' ? 'no cable' : lib.cableMedia.get(s.cableId)?.name ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
