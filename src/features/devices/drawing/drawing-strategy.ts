import type { ComponentType } from 'react';
import type { DeviceDefinition } from '../../../domain/device/types';
import { PduDrawing, pduSize } from './pdu-drawing';
import { RackDeviceDrawing, rackDeviceSize, type DrawingSize } from './rack-device-drawing';
import type { DrawingContext } from './types';
import { FillerDrawing, fillerSize } from './filler-drawing';
import { traitsOf } from '../../../domain/device/categories';

export interface DeviceDrawingStrategy {
  size(device: DeviceDefinition): DrawingSize;
  Component: ComponentType<{ device: DeviceDefinition; ctx: DrawingContext }>;
}

const rackStrategy: DeviceDrawingStrategy = { size: rackDeviceSize, Component: RackDeviceDrawing };
const verticalPduStrategy: DeviceDrawingStrategy = { size: pduSize, Component: PduDrawing };
const fillerStrategy: DeviceDrawingStrategy = { size: fillerSize, Component: FillerDrawing };

/** Picks how a device is drawn: zero-U PDUs as a vertical strip, blanking panels/stiffeners as plain panels, else faceplates. */
export function drawingStrategyFor(device: DeviceDefinition): DeviceDrawingStrategy {
  if (traitsOf(device.category).filler) return fillerStrategy;
  if (device.category === 'pdu' && device.height.units === 0) return verticalPduStrategy;
  return rackStrategy;
}
