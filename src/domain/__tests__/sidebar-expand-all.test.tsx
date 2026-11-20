import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Sidebar } from '../../ui/sidebar';

describe('sidebar expand / collapse all', () => {
  it('filterable sidebars show icon-only Expand all / Collapse all buttons beside the filter', () => {
    const html = renderToStaticMarkup(
      <Sidebar title="T" filterable items={[{ id: 'a', name: 'A', path: ['F', 'G'] }]} selectedId={undefined} onSelect={() => {}} />,
    );
    const filter = /<div class="sidebar-filter">(.*?)<\/div>/.exec(html)![1];
    expect(filter).toContain('aria-label="Expand all"');
    expect(filter).toContain('aria-label="Collapse all"');
    expect(filter).toMatch(/>⊞<\/button>.*>⊟<\/button>/);
  });
});
