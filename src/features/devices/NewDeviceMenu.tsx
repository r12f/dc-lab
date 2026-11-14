import { DEVICE_TEMPLATES, type DeviceTemplate } from '../../domain/device/templates';

/** Template picker opened by "+ New". */
export function NewDeviceMenu({ onPick, onClose }: { onPick(t: DeviceTemplate): void; onClose(): void }) {
  return (
    <div className="menu" onMouseLeave={onClose}>
      {DEVICE_TEMPLATES.map((t) => (
        <div key={t.id} className="menu-item" onClick={() => { onPick(t); onClose(); }}>
          {t.label}
          <small>{t.description}</small>
        </div>
      ))}
    </div>
  );
}
