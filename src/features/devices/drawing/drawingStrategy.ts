import type { ComponentType } from 'react';
import type { DeviceDefinition } from '../../../domain/device/types';
import { PduDrawing, pduSize } from './PduDrawing';
import { RackDeviceDrawing, rackDeviceSize, type DrawingSize } from './RackDeviceDrawing';
import type { DrawingContext } from './types';

export interface DeviceDrawingStrategy {
  size(device: DeviceDefinition): DrawingSize;
  Component: ComponentType<{ device: DeviceDefinition; ctx: DrawingContext }>;
}

const rackStrategy: DeviceDrawingStrategy = { size: rackDeviceSize, Component: RackDeviceDrawing };
const verticalPduStrategy: DeviceDrawingStrategy = { size: pduSize, Component: PduDrawing };

/** Picks how a device is drawn: zero-U PDUs as a vertical strip, everything else as faceplates. */
export function drawingStrategyFor(device: DeviceDefinition): DeviceDrawingStrategy {
  if (device.category === 'pdu' && device.height.units === 0) return verticalPduStrategy;
  return rackStrategy;
}
