import { FloatingMenu } from '../../ui/floating-menu';
import { DEVICE_TEMPLATES, type DeviceTemplate } from '../../domain/device/templates';

/** Template picker opened by "+ New". */
export function NewDeviceMenu({ onPick, onClose }: { onPick(t: DeviceTemplate): void; onClose(): void }) {
  return (
    <FloatingMenu onClose={onClose}>
      {DEVICE_TEMPLATES.map((t) => (
        <div key={t.id} className="menu-item" onClick={() => { onPick(t); onClose(); }}>
          {t.label}
          <small>{t.description}</small>
        </div>
      ))}
    </FloatingMenu>
  );
}
