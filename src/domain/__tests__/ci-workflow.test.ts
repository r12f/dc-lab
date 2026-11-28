import { describe, expect, it } from 'vitest';

const workflows = import.meta.glob('../../../.github/workflows/*.yml', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

function workflowByName(filename: string): string {
  const entry = Object.entries(workflows).find(([key]) => key.endsWith(`/${filename}`));
  expect(entry, `missing .github/workflows/${filename}`).toBeDefined();
  return entry![1];
}

describe('GitHub Actions CI workflow', () => {
  it('defines pull_request and workflow_dispatch checks for typecheck, test, and build', () => {
    const ci = workflowByName('ci.yml');

    expect(ci).toMatch(/\bon:\s*\n\s+pull_request:\s*\n\s+branches:\s*\[main\]/);
    expect(ci).toMatch(/\n\s+workflow_dispatch:/);
    expect(ci).toMatch(/\bpermissions:\s*\n\s+contents:\s*read\b/);
    expect(ci).toMatch(/\bconcurrency:\s*\n\s+group:\s*\$\{\{\s*github\.workflow\s*\}\}-\$\{\{\s*github\.ref\s*\}\}\s*\n\s+cancel-in-progress:\s*true\b/);
    expect(ci).toContain('runs-on: ubuntu-latest');
    expect(ci).toContain('uses: actions/checkout@v4');
    expect(ci).toContain('uses: actions/setup-node@v4');
    expect(ci).toMatch(/node-version:\s*22/);
    expect(ci).toMatch(/cache:\s*npm/);

    const installIdx = ci.indexOf('- run: npm ci');
    const typecheckIdx = ci.indexOf('- run: npm run typecheck');
    const testIdx = ci.indexOf('- run: npm test');
    const buildIdx = ci.indexOf('- run: npm run build');
    expect(installIdx).toBeGreaterThan(-1);
    expect(typecheckIdx).toBeGreaterThan(installIdx);
    expect(testIdx).toBeGreaterThan(typecheckIdx);
    expect(buildIdx).toBeGreaterThan(testIdx);
  });

  it('keeps pages.yml deployment workflow intact', () => {
    const pages = workflowByName('pages.yml');
    expect(pages).toContain('name: Deploy to GitHub Pages');
    expect(pages).toContain('uses: actions/deploy-pages@v4');
  });
});
