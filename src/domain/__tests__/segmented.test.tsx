import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Segmented } from '../../ui/segmented';

describe('segmented view switch', () => {
  it('one radio per option, the chosen one checked, the pill slid to its index', () => {
    const html = renderToStaticMarkup(<Segmented value="cabling" onChange={() => {}} options={[
      { value: 'plan', label: 'Layout' }, { value: 'cabling', label: 'Cabling' }, { value: 'tracing', label: 'Tracing' },
    ]} />);
    expect(html.match(/role="radio"/g)).toHaveLength(3);
    expect(html).toMatch(/aria-checked="true"[^>]*>Cabling</);
    expect(html).toContain('translateX(100%)');
  });
});
