import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { Sidebar, type SidebarItem } from '../sidebar';

class FakeIFrameElement {}

type Listener = (ev: FakeClickEvent) => void;

interface FakeClickEvent {
  type: 'click';
  bubbles: boolean;
  cancelable: boolean;
  defaultPrevented: boolean;
  button: number;
  detail: number;
  target: FakeNode;
  srcElement: FakeNode;
  currentTarget: FakeNode | null;
  preventDefault(): void;
  stopPropagation(): void;
}

class FakeNode {
  readonly nodeType: number;
  readonly nodeName: string;
  ownerDocument: FakeDocument;
  parentNode: FakeNode | null = null;
  childNodes: FakeNode[] = [];
  private listeners = new Map<string, Listener[]>();

  constructor(nodeType: number, nodeName: string, ownerDocument: FakeDocument) {
    this.nodeType = nodeType;
    this.nodeName = nodeName;
    this.ownerDocument = ownerDocument;
  }

  get firstChild(): FakeNode | null {
    return this.childNodes[0] ?? null;
  }

  get nextSibling(): FakeNode | null {
    if (!this.parentNode) return null;
    const idx = this.parentNode.childNodes.indexOf(this);
    return idx >= 0 ? (this.parentNode.childNodes[idx + 1] ?? null) : null;
  }

  get textContent(): string {
    return this.childNodes.map((c) => c.textContent).join('');
  }

  set textContent(value: string) {
    for (const child of this.childNodes) child.parentNode = null;
    this.childNodes = value ? [new FakeText(String(value), this.ownerDocument)] : [];
    for (const child of this.childNodes) child.parentNode = this;
  }

  appendChild<T extends FakeNode>(child: T): T {
    if (child.parentNode) child.parentNode.removeChild(child);
    child.parentNode = this;
    this.childNodes.push(child);
    return child;
  }

  insertBefore<T extends FakeNode>(child: T, ref: FakeNode | null): T {
    if (!ref) return this.appendChild(child);
    if (child.parentNode) child.parentNode.removeChild(child);
    const idx = this.indexOfChild(ref);
    child.parentNode = this;
    if (idx === -1) this.childNodes.push(child);
    else this.childNodes.splice(idx, 0, child);
    return child;
  }

  private indexOfChild(node: FakeNode): number {
    return this.childNodes.indexOf(node);
  }

  removeChild<T extends FakeNode>(child: T): T {
    const idx = this.childNodes.indexOf(child);
    if (idx >= 0) {
      this.childNodes.splice(idx, 1);
      child.parentNode = null;
    }
    return child;
  }

  addEventListener(type: string, fn: Listener, opts?: boolean | { capture?: boolean }): void {
    const capture = typeof opts === 'boolean' ? opts : Boolean(opts?.capture);
    const key = `${type}:${capture ? '1' : '0'}`;
    const list = this.listeners.get(key) ?? [];
    list.push(fn);
    this.listeners.set(key, list);
  }

  removeEventListener(type: string, fn: Listener, opts?: boolean | { capture?: boolean }): void {
    const capture = typeof opts === 'boolean' ? opts : Boolean(opts?.capture);
    const key = `${type}:${capture ? '1' : '0'}`;
    const list = this.listeners.get(key);
    if (!list) return;
    const idx = list.indexOf(fn);
    if (idx >= 0) list.splice(idx, 1);
  }

  dispatchClick(): void {
    let stopped = false;
    const ev: FakeClickEvent = {
      type: 'click',
      bubbles: true,
      cancelable: true,
      defaultPrevented: false,
      button: 0,
      detail: 1,
      target: this,
      srcElement: this,
      currentTarget: null,
      preventDefault() {
        this.defaultPrevented = true;
      },
      stopPropagation() {
        stopped = true;
      },
    };
    const path: FakeNode[] = [];
    for (let cur: FakeNode | null = this; cur; cur = cur.parentNode) {
      path.push(cur);
    }
    for (let i = path.length - 1; i >= 0 && !stopped; i -= 1) {
      ev.currentTarget = path[i];
      for (const fn of [...(path[i].listeners.get('click:1') ?? [])]) fn(ev);
    }
    for (let i = 0; i < path.length && !stopped; i += 1) {
      ev.currentTarget = path[i];
      for (const fn of [...(path[i].listeners.get('click:0') ?? [])]) fn(ev);
    }
  }
}

class FakeText extends FakeNode {
  nodeValue: string;

  constructor(text: string, ownerDocument: FakeDocument) {
    super(3, '#text', ownerDocument);
    this.nodeValue = text;
  }

  override get textContent(): string {
    return this.nodeValue;
  }

  override set textContent(value: string) {
    this.nodeValue = String(value);
  }
}

class FakeElement extends FakeNode {
  readonly tagName: string;
  readonly namespaceURI: string;
  style: Record<string, unknown> = {};
  className = '';
  disabled = false;
  value = '';
  private attributes = new Map<string, string>();

  constructor(tag: string, ownerDocument: FakeDocument, namespaceURI = 'http://www.w3.org/1999/xhtml') {
    super(1, tag.toUpperCase(), ownerDocument);
    this.tagName = tag.toUpperCase();
    this.namespaceURI = namespaceURI;
  }

  setAttribute(name: string, val: string): void {
    const str = String(val);
    this.attributes.set(name, str);
    if (name === 'class') this.className = str;
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  removeAttribute(name: string): void {
    this.attributes.delete(name);
    if (name === 'class') this.className = '';
  }

  hasClass(cls: string): boolean {
    return this.className.split(/\s+/).includes(cls);
  }

  queryAll(pred: (el: FakeElement) => boolean): FakeElement[] {
    const out: FakeElement[] = [];
    const visit = (node: FakeNode): void => {
      if (node instanceof FakeElement) {
        if (pred(node)) out.push(node);
      }
      for (const child of node.childNodes) visit(child);
    };
    visit(this);
    return out;
  }
}

class FakeDocument extends FakeNode {
  documentElement: FakeElement;
  body: FakeElement;
  activeElement: FakeElement;
  defaultView: {
    HTMLIFrameElement: typeof FakeIFrameElement;
    document: FakeDocument;
    navigator: { userAgent: string };
    event?: undefined;
  };

  constructor() {
    // Pass temporary placeholder before `this` is initialized, then point `ownerDocument` to self.
    super(9, '#document', null as unknown as FakeDocument);
    this.ownerDocument = this;
    this.documentElement = new FakeElement('html', this);
    this.body = new FakeElement('body', this);
    this.documentElement.appendChild(this.body);
    this.activeElement = this.body;
    this.defaultView = {
      HTMLIFrameElement: FakeIFrameElement,
      document: this,
      navigator: { userAgent: 'node' },
    };
  }

  createElement(tag: string): FakeElement {
    return new FakeElement(tag, this);
  }

  createElementNS(ns: string, tag: string): FakeElement {
    return new FakeElement(tag, this, ns);
  }

  createTextNode(text: string): FakeText {
    return new FakeText(text, this);
  }
}

const SAMPLE_ITEMS: SidebarItem[] = [
  {
    id: 'optic:osfp-800g-dr8',
    name: '800G OSFP DR8',
    path: ['OSFP', '800G'],
    children: [
      { id: 'item:osfp-800g-dr8-generic', name: 'Generic / OSFP-800G-DR8', path: ['OSFP', '800G'] },
    ],
  },
  {
    id: 'cable:dac-800g',
    name: '800G OSFP DAC',
    path: ['DAC'],
  },
  {
    id: 'cable:cat6a-patch',
    name: 'Cat6A patch',
    path: ['Other', 'RJ45'],
  },
];

interface MountedHarness {
  container: FakeElement;
  setExternalSelectedId(id: string | undefined): Promise<void>;
  getSelectedId(): string | undefined;
  folderRow(label: string): FakeElement | undefined;
  itemRow(name: string): FakeElement | undefined;
  buttonByAriaLabel(label: string): FakeElement | undefined;
  visibleFolderLabels(): string[];
  openFolderLabels(): string[];
  visibleItemNames(): string[];
  click(el: FakeElement | undefined, description: string): Promise<void>;
  unmount(): Promise<void>;
}

const activeCleanups: (() => Promise<void>)[] = [];

afterEach(async () => {
  while (activeCleanups.length > 0) {
    const fn = activeCleanups.pop()!;
    await fn();
  }
});

async function mountSidebar(opts: {
  items?: SidebarItem[];
  initialSelectedId?: string;
  defaultCollapsed?: boolean;
}): Promise<MountedHarness> {
  const g = globalThis as Record<string, unknown>;
  const prevWindow = g.window;
  const prevDocument = g.document;
  const prevAct = g.IS_REACT_ACT_ENVIRONMENT;

  const doc = new FakeDocument();
  g.window = doc.defaultView;
  g.document = doc;
  g.IS_REACT_ACT_ENVIRONMENT = true;

  const container = doc.createElement('div');
  doc.body.appendChild(container);
  const root: Root = createRoot(container as unknown as Element);

  let currentSelected: string | undefined = opts.initialSelectedId;
  let externalSelectSetter: ((id: string | undefined) => void) | undefined;

  function Wrapper() {
    const [sel, setSel] = useState<string | undefined>(opts.initialSelectedId);
    currentSelected = sel;
    externalSelectSetter = setSel;
    return (
      <Sidebar
        title="Optics & Cables"
        items={opts.items ?? SAMPLE_ITEMS}
        filterable
        defaultCollapsed={opts.defaultCollapsed ?? true}
        selectedId={sel}
        onSelect={(id) => setSel(id)}
      />
    );
  }

  await act(async () => {
    root.render(<Wrapper />);
  });

  let cleaned = false;
  const unmount = async () => {
    if (cleaned) return;
    cleaned = true;
    await act(async () => {
      root.unmount();
    });
    const restore = (key: string, val: unknown) => {
      if (val === undefined) delete g[key];
      else g[key] = val;
    };
    restore('window', prevWindow);
    restore('document', prevDocument);
    restore('IS_REACT_ACT_ENVIRONMENT', prevAct);
  };
  activeCleanups.push(unmount);

  const folderNameOf = (el: FakeElement): string =>
    el.queryAll((c) => c.hasClass('sidebar-item-name'))[0]?.textContent ?? '';

  const folderCaretOf = (el: FakeElement): string =>
    el.queryAll((c) => c.hasClass('caret'))[0]?.textContent ?? '';

  return {
    container,
    async setExternalSelectedId(id: string | undefined) {
      await act(async () => {
        externalSelectSetter?.(id);
      });
    },
    getSelectedId: () => currentSelected,
    folderRow(label: string) {
      return container.queryAll((el) => el.hasClass('tree-folder') && folderNameOf(el) === label)[0];
    },
    itemRow(name: string) {
      return container.queryAll((el) => el.hasClass('sidebar-item') && folderNameOf(el) === name)[0];
    },
    buttonByAriaLabel(label: string) {
      return container.queryAll((el) => el.tagName === 'BUTTON' && el.getAttribute('aria-label') === label)[0];
    },
    visibleFolderLabels() {
      return container.queryAll((el) => el.hasClass('tree-folder')).map(folderNameOf);
    },
    openFolderLabels() {
      return container
        .queryAll((el) => el.hasClass('tree-folder') && folderCaretOf(el) === '▾')
        .map(folderNameOf);
    },
    visibleItemNames() {
      return container.queryAll((el) => el.hasClass('sidebar-item')).map(folderNameOf);
    },
    async click(el: FakeElement | undefined, description: string) {
      if (!el) throw new Error(`Missing element to click: ${description}`);
      await act(async () => {
        el.dispatchClick();
      });
    },
    unmount,
  };
}

describe('Sidebar defaultCollapsed folder state', () => {
  it('keeps manually expanded folders open and highlights item when clicking Cat6A patch under Other -> RJ45', async () => {
    const ui = await mountSidebar({ defaultCollapsed: true });

    // Initially all folders are collapsed when nothing is selected.
    expect(ui.openFolderLabels()).toEqual([]);
    expect(ui.visibleFolderLabels()).toEqual(['DAC', 'OSFP', 'Other']);
    expect(ui.itemRow('Cat6A patch')).toBeUndefined();

    // Expand Other -> RJ45, then click Cat6A patch.
    await ui.click(ui.folderRow('Other'), 'Other folder');
    expect(ui.openFolderLabels()).toEqual(['Other']);
    expect(ui.folderRow('RJ45')).toBeDefined();

    await ui.click(ui.folderRow('RJ45'), 'RJ45 folder');
    expect(ui.openFolderLabels()).toEqual(['Other', 'RJ45']);
    expect(ui.itemRow('Cat6A patch')).toBeDefined();

    await ui.click(ui.itemRow('Cat6A patch'), 'Cat6A patch item');
    expect(ui.getSelectedId()).toBe('cable:cat6a-patch');
    expect(ui.openFolderLabels()).toEqual(['Other', 'RJ45']);
    expect(ui.itemRow('Cat6A patch')?.hasClass('active')).toBe(true);

    // Expanding another folder (DAC) and selecting an item inside it keeps Other -> RJ45 open too.
    await ui.click(ui.folderRow('DAC'), 'DAC folder');
    await ui.click(ui.itemRow('800G OSFP DAC'), '800G OSFP DAC item');
    expect(ui.getSelectedId()).toBe('cable:dac-800g');
    expect(ui.openFolderLabels()).toEqual(['DAC', 'Other', 'RJ45']);
    expect(ui.itemRow('Cat6A patch')).toBeDefined();
    expect(ui.itemRow('800G OSFP DAC')?.hasClass('active')).toBe(true);
  });

  it('keeps all folders open after Expand all when selecting Cat6A patch', async () => {
    const ui = await mountSidebar({ defaultCollapsed: true });

    await ui.click(ui.buttonByAriaLabel('Expand all'), 'Expand all button');
    expect(ui.openFolderLabels()).toEqual(['DAC', 'OSFP', '800G', 'Other', 'RJ45']);

    await ui.click(ui.itemRow('Cat6A patch'), 'Cat6A patch item');
    expect(ui.getSelectedId()).toBe('cable:cat6a-patch');
    expect(ui.openFolderLabels()).toEqual(['DAC', 'OSFP', '800G', 'Other', 'RJ45']);
    expect(ui.itemRow('Cat6A patch')?.hasClass('active')).toBe(true);
  });

  it('closes all folders and item children on Collapse all, and reveals ancestor folders on a subsequent selectedId change', async () => {
    const ui = await mountSidebar({
      defaultCollapsed: true,
      initialSelectedId: 'optic:osfp-800g-dr8',
    });

    // Initial selectedId opens OSFP -> 800G. Expand variant children on 800G OSFP DR8 as well.
    expect(ui.openFolderLabels()).toEqual(['OSFP', '800G']);
    const dr8Caret = ui.itemRow('800G OSFP DR8')?.queryAll((c) => c.hasClass('caret'))[0];
    await ui.click(dr8Caret, '800G OSFP DR8 caret');
    expect(ui.visibleItemNames()).toContain('Generic / OSFP-800G-DR8');

    // Collapse all closes every folder (including OSFP/800G) and resets expanded item children.
    await ui.click(ui.buttonByAriaLabel('Collapse all'), 'Collapse all button');
    expect(ui.openFolderLabels()).toEqual([]);
    expect(ui.visibleItemNames()).toEqual([]);

    // Re-opening OSFP -> 800G manually verifies the variant child caret was cleared by Collapse all.
    await ui.click(ui.folderRow('OSFP'), 'OSFP folder');
    await ui.click(ui.folderRow('800G'), '800G folder');
    expect(ui.visibleItemNames()).toEqual(['800G OSFP DR8']);
    await ui.click(ui.buttonByAriaLabel('Collapse all'), 'Collapse all button');
    expect(ui.openFolderLabels()).toEqual([]);

    // Subsequent selectedId change (e.g. + New creating/selecting an item inside a collapsed folder) reveals its path.
    await ui.setExternalSelectedId('cable:cat6a-patch');
    expect(ui.openFolderLabels()).toEqual(['Other', 'RJ45']);
    expect(ui.itemRow('Cat6A patch')?.hasClass('active')).toBe(true);

    // Selecting another item in a collapsed folder reveals the new path without leaving unpinned folders open.
    await ui.setExternalSelectedId('optic:osfp-800g-dr8');
    expect(ui.openFolderLabels()).toEqual(['OSFP', '800G']);
    expect(ui.itemRow('800G OSFP DR8')?.hasClass('active')).toBe(true);
  });

  it('preserves default-open behavior and manual toggling when defaultCollapsed is false', async () => {
    const ui = await mountSidebar({ defaultCollapsed: false });

    // All folders start open by default.
    expect(ui.openFolderLabels()).toEqual(['DAC', 'OSFP', '800G', 'Other', 'RJ45']);

    // Clicking Other header explicitly closes Other; selecting an item in DAC keeps Other closed.
    await ui.click(ui.folderRow('Other'), 'Other folder');
    expect(ui.openFolderLabels()).toEqual(['DAC', 'OSFP', '800G']);
    await ui.click(ui.itemRow('800G OSFP DAC'), '800G OSFP DAC item');
    expect(ui.openFolderLabels()).toEqual(['DAC', 'OSFP', '800G']);

    // Selecting Cat6A patch externally opens Other -> RJ45 even though Other was manually closed.
    await ui.setExternalSelectedId('cable:cat6a-patch');
    expect(ui.openFolderLabels()).toEqual(['DAC', 'OSFP', '800G', 'Other', 'RJ45']);
    expect(ui.itemRow('Cat6A patch')?.hasClass('active')).toBe(true);
  });
});
