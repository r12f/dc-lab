import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CrossCablingPanel } from '../../features/layout/cross-cabling-panel';
import { Library } from '../library/library';
import { BUILTIN_CATALOG_FOR_TESTS } from './catalog-fixture';
import { emptyProject } from '../project/types';
import type { RackDesign } from '../design/types';
import type { DcLayout } from '../layout/types';

const rack = (id: string, deviceId: string, portRef: string): RackDesign => ({
  id, name: id, templateId: 'network-48ru-600', cables: [],
  placements: [{ id: `${id}-d`, deviceId, label: 'D1', mount: { kind: 'rack', position: 10, face: 'front' }, portSettings: {}, groupSettings: {} }],
  crossRack: [{ placementId: `${id}-d`, portRef, connector: 1 }],
} as unknown as RackDesign);

describe('cross cabling panel', () => {
  it('a one-leg port marked on connector 1 is pickable (not a blank placeholder)', () => {
    const lib = new Library(BUILTIN_CATALOG_FOR_TESTS, emptyProject());
    const designs = [rack('sw', 'switch-64x1600g-osfp', 'service/1'), rack('fh', 'fiber-housing-2ru-288xmmc16', 'rt1/1')];
    const layout = {
      id: 'l', name: 'L', room: { widthMm: 1, depthMm: 1 }, whitespace: { x: 0, y: 0, widthMm: 1, depthMm: 1 },
      facilities: [], rows: [], aisles: [], sequence: [], trays: [], doors: [],
      assignments: designs.map((d) => ({ id: `a-${d.id}`, rowId: 'r', startTile: 0, designId: d.id, label: d.id })),
    } as DcLayout;
    const html = renderToStaticMarkup(
      <CrossCablingPanel lib={lib} designs={(id) => designs.find((d) => d.id === id)} layout={layout}
        sides={{ a: 'a-sw', b: 'a-fh' }} onSides={() => {}} onChange={() => {}} />,
    );
    // Each side shows its marked connector as a button, labelled with the plain port name.
    expect(html.match(/<button[^>]*class="cross-port[^"]*"[^>]*>[^<]+<\/button>/g)?.length).toBe(2);
  });
});
