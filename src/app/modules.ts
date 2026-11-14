import type { ComponentType } from 'react';
import type { ModuleTab } from '../state/uiSlice';
import { DevicesModule } from '../features/devices/DevicesModule';
import { RacksModule } from '../features/racks/RacksModule';
import { DesignerModule } from '../features/designer/DesignerModule';
import { LayoutModule } from '../features/layout/LayoutModule';

export interface ModuleDef {
  id: ModuleTab;
  label: string;
  component: ComponentType;
}

/** Module registry: tab order and the component rendered for each. */
export const MODULES: ModuleDef[] = [
  { id: 'devices', label: 'Devices (L10)', component: DevicesModule },
  { id: 'racks', label: 'Racks', component: RacksModule },
  { id: 'designer', label: 'Rack Designer (L11)', component: DesignerModule },
  { id: 'layout', label: 'DC Layout', component: LayoutModule },
];
