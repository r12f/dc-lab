import type { ComponentType } from 'react';
import type { ModuleTab } from '../state/ui-slice';
import { DevicesModule } from '../features/devices/devices-module';
import { RacksModule } from '../features/racks/racks-module';
import { OpticsModule } from '../features/optics/optics-module';
import { DesignerModule } from '../features/designer/designer-module';
import { LayoutModule } from '../features/layout/layout-module';

export interface ModuleDef {
  id: ModuleTab;
  label: string;
  component: ComponentType;
}

/** Module registry: tab order and the component rendered for each. */
export const MODULES: ModuleDef[] = [
  { id: 'devices', label: 'Devices (L10)', component: DevicesModule },
  { id: 'optics', label: 'Optics & Cables', component: OpticsModule },
  { id: 'racks', label: 'Racks', component: RacksModule },
  { id: 'designer', label: 'Rack Designer (L11)', component: DesignerModule },
  { id: 'layout', label: 'DC Layout (L12)', component: LayoutModule },
];
