import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { RackPalette } from '../../features/layout/rack-palette';
import { Library } from '../library/library';
import { BUILTIN_CATALOG_FOR_TESTS } from './catalog-fixture';
import { emptyProject } from '../project/types';
import type { RackDesign } from '../design/types';

const design = (id: string, abbr: string): RackDesign => ({ id, name: `Rack ${abbr}`, abbr, templateId: 'network-48ru-600', placements: [], cables: [] } as unknown as RackDesign);

describe('DC Layout rack palette', () => {
  const lib = new Library(BUILTIN_CATALOG_FOR_TESTS, emptyProject());
  const designs = [design('a', 'AA'), design('b', 'BB')];
  const render = (picked: string | undefined, freeTiles: number) => renderToStaticMarkup(
    <RackPalette lib={lib} designs={designs} picked={picked} onPick={() => {}} freeTiles={freeTiles} onAssign={() => ({ error: false, lines: [] })} />,
  );
  it('lists every rack design as a draggable item under its template', () => {
    const html = render(undefined, 0);
    expect(html.match(/class="palette-item[^"]*" [^>]*draggable="true"/g)?.length).toBe(2);
    expect(html).toContain('Network Rack 48RU');
  });
  it('Assign appears (enabled) once a rack is picked and free tiles are selected; its space is always reserved', () => {
    expect(render(undefined, 2)).toContain('visibility:hidden');
    const html = render('b', 2);
    expect(html).toContain('visibility:visible');
    expect(html).toMatch(/<button[^>]*>Assign 2 racks<\/button>/);
    expect(html).not.toMatch(/<button[^>]*disabled[^>]*>Assign/);
    expect(render('b', 0)).toMatch(/<button[^>]*disabled[^>]*>Assign rack<\/button>/);
  });
});
