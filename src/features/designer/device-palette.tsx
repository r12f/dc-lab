import { useState } from 'react';
import type { Library } from '../../domain/library/library';
import { formatHeight } from '../../domain/units';
import { categoryPaint } from '../../theme/paint';

export const DEVICE_DRAG_TYPE = 'application/x-dclab-device';

/** Searchable device list; drag onto the elevation or click to add at the first free unit. */
export function DevicePalette({ lib, onAdd }: { lib: Library; onAdd(deviceId: string): void }) {
  const [q, setQ] = useState('');
  const devices = lib.devices.items().filter((d) => d.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="palette">
      <div className="sidebar-group-title">Device palette</div>
      <input placeholder="Filter devices…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="palette-list">
        {devices.map((d) => (
          <div
            key={d.id}
            className="palette-item"
            draggable
            onDragStart={(e) => e.dataTransfer.setData(DEVICE_DRAG_TYPE, d.id)}
            onDoubleClick={() => onAdd(d.id)}
            title="Drag onto the rack, or double-click to add"
          >
            <span className="swatch" style={{ background: categoryPaint(d.category) }} />
            <span className="sidebar-item-name">{d.name}</span>
            <span className="badge">{formatHeight(d.height)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
