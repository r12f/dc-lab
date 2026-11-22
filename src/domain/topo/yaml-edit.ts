import { bracketDepth, mappingColon, parseInlineYaml, parseYaml, withoutComment, type YamlValue } from './yaml';

/**
 * Edits a YAML source in place: a value at a path is set, inserted, renamed or removed by rewriting only the lines
 * that hold it, so comments, blank lines and the layout of everything else stay as written. Covers the YAML that
 * parseYaml reads; a value written inline (scalar or flow collection) is rewritten inline, a block stays a block.
 */

/** A path into a YAML document: map keys and list indexes. */
export type YamlPath = (string | number)[];

type Obj = { [k: string]: YamlValue };
const isObj = (v: YamlValue | undefined): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);

interface Pos { line: number; col: number }
interface Range { from: Pos; to: Pos }
/** A map entry or list item of a block collection, located in the source lines. */
interface Entry {
  key?: string;
  /** The key's text (map entries). */
  keyRange?: Range;
  /** First and last source line of the entry, its value included. */
  first: number;
  last: number;
  /** Value written on the entry's line(s): a scalar or a flow collection. */
  inline?: Range;
  /** Value written as a nested block. */
  child?: Block;
  /** First key of a list item, written on the item's dash line (`- name: x`). */
  onDash?: boolean;
}
interface Block { kind: 'map' | 'list'; indent: number; entries: Entry[]; first: number; last: number }
/** A logical line: one source line, or a flow collection joined over several. */
interface LLine { first: number; last: number; indent: number; text: string }

const isDash = (l: LLine) => l.text === '-' || l.text.startsWith('- ');

/** The block structure of a source (as parseYaml reads it), with where each entry and value sits. */
function scan(lines: string[]): Block | undefined {
  const ls: LLine[] = [];
  for (let n = 0; n < lines.length; n++) {
    let t = withoutComment(lines[n]).replace(/\s+$/, '');
    if (!t.trim() || /^(---|\.\.\.)$/.test(t.trim())) continue;
    const first = n;
    let d = bracketDepth(t);
    while (d > 0 && n + 1 < lines.length) {
      n++;
      const more = withoutComment(lines[n]).trim();
      t += ` ${more}`;
      d += bracketDepth(more);
    }
    ls.push({ first, last: n, indent: t.length - t.trimStart().length, text: t.trim() });
  }
  let p = 0;
  const endOf = (l: LLine): Pos => (l.first === l.last
    ? { line: l.first, col: l.indent + l.text.length }
    : { line: l.last, col: withoutComment(lines[l.last]).trimEnd().length });
  const block = (indent: number): Block => (isDash(ls[p]) ? list(indent) : map(indent));
  function map(indent: number, onDash = false): Block {
    const b: Block = { kind: 'map', indent, entries: [], first: ls[p].first, last: ls[p].last };
    let dashKey = onDash;
    while (p < ls.length && ls[p].indent === indent && !isDash(ls[p])) {
      const l = ls[p];
      const c = mappingColon(l.text);
      if (c < 0) throw new Error(`line ${l.first + 1}: expected "key: value"`);
      p++;
      const after = l.text.slice(c + 1);
      const e: Entry = {
        key: String(parseInlineYaml(l.text.slice(0, c), l.first + 1)),
        keyRange: { from: { line: l.first, col: l.indent }, to: { line: l.first, col: l.indent + c } },
        first: l.first, last: l.last, ...(dashKey ? { onDash: true } : {}),
      };
      dashKey = false;
      if (after.trim()) e.inline = { from: { line: l.first, col: l.indent + c + 1 + (after.length - after.trimStart().length) }, to: endOf(l) };
      else {
        const nx = ls[p];
        if (nx && (nx.indent > indent || (nx.indent === indent && isDash(nx)))) { e.child = block(nx.indent); e.last = e.child.last; }
      }
      b.entries.push(e);
      b.last = e.last;
    }
    return b;
  }
  function list(indent: number): Block {
    const b: Block = { kind: 'list', indent, entries: [], first: ls[p].first, last: ls[p].last };
    while (p < ls.length && ls[p].indent === indent && isDash(ls[p])) {
      const l = ls[p];
      const rest = l.text.slice(1).trimStart();
      const col = indent + (l.text.length - rest.length);
      p++;
      const e: Entry = { first: l.first, last: l.last };
      if (!rest) {
        const nx = ls[p];
        if (nx && nx.indent > indent) { e.child = block(nx.indent); e.last = e.child.last; }
      } else if (!'{["\''.includes(rest[0]) && mappingColon(rest) >= 0) {
        ls.splice(p, 0, { first: l.first, last: l.last, indent: col, text: rest });
        e.child = map(col, true);
        e.last = e.child.last;
      } else if (rest.startsWith('- ')) {
        ls.splice(p, 0, { first: l.first, last: l.last, indent: col, text: rest });
        e.child = list(col);
        e.last = e.child.last;
      } else e.inline = { from: { line: l.first, col }, to: endOf(l) };
      b.entries.push(e);
      b.last = e.last;
    }
    return b;
  }
  return ls.length ? block(ls[0].indent) : undefined;
}

/** Text of an inline value, its comments dropped (a flow collection may span lines). */
function inlineText(lines: string[], r: Range): string {
  if (r.from.line === r.to.line) return lines[r.from.line].slice(r.from.col, r.to.col);
  return [
    withoutComment(lines[r.from.line].slice(r.from.col)),
    ...lines.slice(r.from.line + 1, r.to.line).map(withoutComment),
    lines[r.to.line].slice(0, r.to.col),
  ].join(' ');
}

function replaceRange(lines: string[], r: Range, text: string): void {
  const head = lines[r.from.line].slice(0, r.from.col);
  const tail = lines[r.to.line].slice(r.to.col);
  lines.splice(r.from.line, r.to.line - r.from.line + 1, head + text + tail);
}

// --- Writing values -----------------------------------------------------------------------------------------------

const SPECIAL_START = /^[-?:,[\]{}#&*!|>'"%@`]/;
const LOOKS_TYPED = /^(true|false|null|~|[-+]?\d+(\.\d+)?)$/;

const quote = (s: string) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\t/g, '\\t')}"`;

/** Whether a string reads back as itself unquoted; in a flow collection braces must nest and hold its commas. */
function plainOk(s: string, inFlow: boolean): boolean {
  if (s === '' || s.trim() !== s || LOOKS_TYPED.test(s) || SPECIAL_START.test(s) || s.includes(': ') || s.includes(' #')
    || s.endsWith(':') || /["\n\t]/.test(s)) return false;
  if (!inFlow) return true;
  if (/[[\]]/.test(s)) return false;
  let d = 0;
  for (const c of s) {
    if (c === '{') d++;
    else if (c === '}') { if (!d) return false; d--; } else if (c === ',' && !d) return false;
  }
  return d === 0;
}

/**
 * A string as a YAML scalar: plain when it reads back as the same string, else double-quoted. New values in a flow
 * collection are quoted when they hold brackets or commas (`"etp{1-64}"`, `"${pod}"`), as the files write them.
 */
function scalarText(s: string, inFlow: boolean): string {
  return plainOk(s, inFlow) && (!inFlow || !/[,[\]{}#]/.test(s)) ? s : quote(s);
}

/** A value replacing a scalar written as `old`: a string keeps its quoting (quoted stays quoted, plain stays plain if it can). */
function replacement(v: YamlValue, old: string, inFlow: boolean): string {
  if (typeof v !== 'string') return flowYaml(v, inFlow);
  if (old.startsWith('"') || old.startsWith("'")) return quote(v);
  return plainOk(v, inFlow) ? v : quote(v);
}

/** A map key: plain when it is a simple name, else quoted (`"1": 54`). */
function keyText(k: string): string {
  return /^[A-Za-z_][\w-]*$/.test(k) && !LOOKS_TYPED.test(k) ? k : `"${k.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/** A value written inline: a scalar, or a flow collection (`{ a: 1, b: [x, y] }`). */
export function flowYaml(v: YamlValue, inFlow = false): string {
  if (v === null) return 'null';
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (typeof v === 'string') return scalarText(v, inFlow);
  if (Array.isArray(v)) return `[${v.map((x) => flowYaml(x, true)).join(', ')}]`;
  const kv = Object.entries(v);
  return kv.length ? `{ ${kv.map(([k, x]) => `${keyText(k)}: ${flowYaml(x, true)}`).join(', ')} }` : '{}';
}

const pad = (n: number) => ' '.repeat(n);
const empty = (v: YamlValue) => (Array.isArray(v) ? !v.length : isObj(v) ? !Object.keys(v).length : true);

/**
 * Lines of `key: value` at an indent. Maps nest as blocks `depth` levels deep, then go inline; lists of scalars go
 * inline, other lists are block lists of items.
 */
function emitEntry(key: string, v: YamlValue, indent: number, depth = 1): string[] {
  const head = `${pad(indent)}${keyText(key)}:`;
  if (empty(v) || (Array.isArray(v) && v.every((x) => !x || typeof x !== 'object')) || (isObj(v) && depth <= 0)) return [`${head} ${flowYaml(v)}`];
  if (Array.isArray(v)) return [head, ...v.flatMap((x) => emitItem(x, indent + 2, depth - 1))];
  return [head, ...Object.entries(v as Obj).flatMap(([k, x]) => emitEntry(k, x, indent + 2, depth - 1))];
}

/** Lines of a list item: a map `depth` > 0 deep as a block (first key on the dash line), else inline. */
function emitItem(v: YamlValue, indent: number, depth = 0): string[] {
  if (!isObj(v) || empty(v) || depth <= 0) return [`${pad(indent)}- ${flowYaml(v)}`];
  const [[k0, v0], ...more] = Object.entries(v);
  const first = emitEntry(k0, v0, indent + 2, depth - 1);
  first[0] = `${pad(indent)}- ${first[0].trimStart()}`;
  return [...first, ...more.flatMap(([k, x]) => emitEntry(k, x, indent + 2, depth - 1))];
}

/** `value` placed under a path that does not exist yet. */
function nest(path: YamlPath, value: YamlValue): YamlValue {
  return path.reduceRight<YamlValue>((v, seg) => (typeof seg === 'number' ? [v] : { [seg]: v }), value);
}

/** A copy of `cur` with the value at `path` set (or removed, for undefined). */
function setPlain(cur: YamlValue | undefined, path: YamlPath, value: YamlValue | undefined): YamlValue {
  if (!path.length) return value === undefined ? null : value;
  const [seg, ...rest] = path;
  if (typeof seg === 'number') {
    const a = Array.isArray(cur) ? [...cur] : [];
    if (!rest.length && value === undefined) a.splice(seg, 1);
    else a[seg] = setPlain(a[seg], rest, value);
    return a;
  }
  const o: Obj = isObj(cur) ? { ...cur } : {};
  if (!rest.length && value === undefined) delete o[seg];
  else o[seg] = setPlain(o[seg], rest, value);
  return o;
}

/** A copy of `cur` with the map key at `path` renamed, keeping the key order. */
function renamePlain(cur: YamlValue | undefined, path: YamlPath, to: string): YamlValue | undefined {
  const [seg, ...rest] = path;
  if (cur === undefined || cur === null || typeof cur !== 'object') return cur;
  if (Array.isArray(cur)) return typeof seg === 'number' && seg < cur.length ? cur.map((x, i) => (i === seg ? renamePlain(x, rest, to)! : x)) : cur;
  if (!(String(seg) in cur)) return cur;
  if (rest.length) return { ...cur, [seg]: renamePlain(cur[seg], rest, to)! };
  return Object.fromEntries(Object.entries(cur).map(([k, v]) => [k === String(seg) ? to : k, v]));
}

// --- Edits inside a one-line flow value ----------------------------------------------------------------------------

/** A value in a flow collection, with where its text sits (offsets into the flow text). */
interface FlowVal {
  start: number;
  end: number;
  map?: { key: string; keyStart: number; keyEnd: number; value: FlowVal }[];
  list?: FlowVal[];
}

/** Positions of the values of a flow text (mirrors parseYaml's flow reader; the text is known to parse). */
function scanFlow(src: string): FlowVal {
  let i = 0;
  const ws = () => { while (i < src.length && /\s/.test(src[i])) i++; };
  const token = (stop: string): [number, number] => {
    ws();
    const start = i;
    if (src[i] === '"' || src[i] === "'") {
      const q = src[i++];
      while (i < src.length && !(src[i] === q && src[i - 1] !== '\\')) i++;
      return [start, ++i];
    }
    let d = 0;
    while (i < src.length) {
      const c = src[i];
      if (c === '{' && i > start) d++;
      else if (c === '}' && d > 0) d--;
      else if (d === 0 && (',]}'.includes(c) || (stop && c === stop && (src[i + 1] === ' ' || src[i + 1] === undefined)))) break;
      i++;
    }
    let end = i;
    while (end > start && /\s/.test(src[end - 1])) end--;
    return [start, end];
  };
  const value = (): FlowVal => {
    ws();
    const start = i;
    if (src[i] === '{') {
      i++;
      const map: NonNullable<FlowVal['map']> = [];
      ws();
      if (src[i] === '}') return { start, end: ++i, map };
      for (;;) {
        const [keyStart, keyEnd] = token(':');
        i++;
        map.push({ key: String(parseInlineYaml(src.slice(keyStart, keyEnd))), keyStart, keyEnd, value: value() });
        ws();
        if (src[i++] === ',') continue;
        return { start, end: i, map };
      }
    }
    if (src[i] === '[') {
      i++;
      const list: FlowVal[] = [];
      ws();
      if (src[i] === ']') return { start, end: ++i, list };
      for (;;) {
        list.push(value());
        ws();
        if (src[i++] === ',') continue;
        return { start, end: i, list };
      }
    }
    const [s, e] = token('');
    return { start: s, end: e };
  };
  return value();
}

/**
 * A one-line flow text with the value at `path` set (undefined: removed) by replacing only that value's text, so
 * the spacing around the others stays as written; undefined when the edit needs the value rewritten whole.
 */
function flowSet(txt: string, path: YamlPath, value: YamlValue | undefined): string | undefined {
  const at = (s: number, e: number, t: string) => txt.slice(0, s) + t + txt.slice(e);
  let node = scanFlow(txt);
  for (let k = 0; k < path.length; k++) {
    const seg = path[k];
    const last = k === path.length - 1;
    if (node.map) {
      const items = node.map;
      const i = items.findIndex((m) => m.key === String(seg));
      if (i < 0) {
        if (!last || value === undefined) return undefined;
        const kv = `${keyText(String(seg))}: ${flowYaml(value, true)}`;
        return items.length ? at(items[items.length - 1].value.end, items[items.length - 1].value.end, `, ${kv}`) : at(node.start, node.end, `{ ${kv} }`);
      }
      if (!last) { node = items[i].value; continue; }
      if (value !== undefined) return at(items[i].value.start, items[i].value.end, replacement(value, txt.slice(items[i].value.start, items[i].value.end), true));
      if (items.length === 1) return at(node.start, node.end, '{}');
      return i > 0 ? at(items[i - 1].value.end, items[i].value.end, '') : at(items[0].keyStart, items[1].keyStart, '');
    }
    if (node.list && typeof seg === 'number') {
      const items = node.list;
      if (seg >= items.length) {
        if (!last || value === undefined || seg !== items.length) return undefined;
        return items.length ? at(items[seg - 1].end, items[seg - 1].end, `, ${flowYaml(value, true)}`) : at(node.start, node.end, `[${flowYaml(value, true)}]`);
      }
      if (!last) { node = items[seg]; continue; }
      if (value !== undefined) return at(items[seg].start, items[seg].end, replacement(value, txt.slice(items[seg].start, items[seg].end), true));
      if (items.length === 1) return at(node.start, node.end, '[]');
      return seg > 0 ? at(items[seg - 1].end, items[seg].end, '') : at(items[0].start, items[1].start, '');
    }
    return undefined;
  }
  return undefined;
}

/** A one-line flow text with the map key at `path` renamed in place; undefined when it is not there. */
function flowRename(txt: string, path: YamlPath, to: string): string | undefined {
  let node: FlowVal | undefined = scanFlow(txt);
  for (let k = 0; node && k < path.length; k++) {
    const seg = path[k];
    if (node.map) {
      const m: NonNullable<FlowVal['map']>[number] | undefined = node.map.find((x) => x.key === String(seg));
      if (!m) return undefined;
      if (k === path.length - 1) return txt.slice(0, m.keyStart) + keyText(to) + txt.slice(m.keyEnd);
      node = m.value;
    } else node = node.list && typeof seg === 'number' ? node.list[seg] : undefined;
  }
  return undefined;
}

/** Applies a flow edit to an entry's one-line inline value; false when it is not one or the edit needs a rewrite. */
function inFlow(lines: string[], r: Range, edit: (txt: string) => string | undefined): boolean {
  if (r.from.line !== r.to.line) return false;
  const line = lines[r.from.line];
  const out = edit(line.slice(r.from.col, r.to.col));
  if (out === undefined) return false;
  lines[r.from.line] = line.slice(0, r.from.col) + out + line.slice(r.to.col);
  return true;
}

// --- Applying edits -----------------------------------------------------------------------------------------------

/** Line to insert a new map key at: before the first entry its `order` ranks after it, else after the map. */
function insertAt(b: Block, key: string, order: readonly string[]): number {
  const rank = (k?: string) => { const i = k === undefined ? -1 : order.indexOf(k); return i < 0 ? Infinity : i; };
  const r = rank(key);
  if (r !== Infinity) {
    const next = b.entries.find((e) => rank(e.key) > r && !e.onDash);
    if (next) return next.first;
  }
  return b.last + 1;
}

/** Sets an entry's value: inline values stay inline, blocks are rewritten as blocks. */
function setEntry(lines: string[], parent: Block, e: Entry, value: YamlValue): void {
  if (e.inline) { replaceRange(lines, e.inline, replacement(value, inlineText(lines, e.inline), false)); return; }
  // A list item whose map starts on its dash line: the whole item is rewritten.
  if (parent.kind === 'list' && e.child && e.child.first === e.first) {
    lines.splice(e.first, e.last - e.first + 1, ...emitItem(value, parent.indent, isObj(value) ? 1 : 0));
    return;
  }
  const head = e.keyRange ? lines[e.first].slice(0, e.keyRange.to.col + 1) : lines[e.first].replace(/-\s*$/, '-');
  const indent = (e.child?.indent ?? parent.indent + 2);
  const inline = empty(value) || !value || typeof value !== 'object' || (Array.isArray(value) && value.every((x) => !x || typeof x !== 'object'));
  const body = inline ? [] : Array.isArray(value) ? value.flatMap((x) => emitItem(x, indent)) : Object.entries(value as Obj).flatMap(([k, x]) => emitEntry(k, x, indent));
  lines.splice(e.first, e.last - e.first + 1, inline ? `${head} ${flowYaml(value)}` : head, ...body);
}

function removeEntry(lines: string[], e: Entry, owner?: { parent: Block; entry: Entry }): void {
  if (e.onDash && owner) {
    // The item's first key sits on its dash line: rewrite the item without it.
    const item = (parseYaml(lines.slice(owner.entry.first, owner.entry.last + 1).join('\n')) as YamlValue[])[0];
    setEntry(lines, owner.parent, owner.entry, setPlain(item, [e.key!], undefined));
    return;
  }
  lines.splice(e.first, e.last - e.first + 1);
  // An entry set off by blank lines leaves one, not two.
  if (e.first > 0 && !lines[e.first - 1]?.trim() && e.first < lines.length && !lines[e.first].trim()) lines.splice(e.first - 1, 1);
}

/** How a new value is written. */
export interface EditOptions {
  /** Map keys in their preferred order: a new key goes before the first existing key ranked after it. */
  order?: readonly string[];
  /**
   * Block levels of a new value: a map entry's maps nest as blocks this deep (default 1), a list item is a block
   * map (first key on the dash line) when > 0 (default 0: inline).
   */
  depth?: number;
  /** A blank line before a new entry (between groups, between links). */
  gap?: boolean;
  /**
   * A map or list set where a scalar was written inline becomes a block under its key (a pool's ports becoming
   * `{ ports, optic }`), the line's comment kept on the key; otherwise inline stays inline.
   */
  block?: boolean;
}

function applyIn(lines: string[], b: Block, path: YamlPath, value: YamlValue | undefined, opts: EditOptions,
  owner?: { parent: Block; entry: Entry }): void {
  const [seg, ...rest] = path;
  const e = b.kind === 'map' ? b.entries.find((x) => x.key === String(seg)) : typeof seg === 'number' ? b.entries[seg] : undefined;
  if (!e) {
    if (value === undefined) return;
    const v = nest(rest, value);
    const gap = opts.gap ? [''] : [];
    if (b.kind === 'map') lines.splice(insertAt(b, String(seg), opts.order ?? []), 0, ...gap, ...emitEntry(String(seg), v, b.indent, (opts.depth ?? 1) + rest.length));
    else if (seg === b.entries.length) lines.splice(b.last + 1, 0, ...gap, ...emitItem(v, b.indent, (opts.depth ?? 0) + rest.length));
    return;
  }
  if (rest.length) {
    if (e.child) { applyIn(lines, e.child, rest, value, opts, { parent: b, entry: e }); return; }
    const cur = e.inline ? parseInlineYaml(inlineText(lines, e.inline)) : null;
    const next = setPlain(cur, rest, value);
    // Filling an empty `key: []` / `key:` writes the collection as a new block, as if the key were new.
    if (e.key !== undefined && !e.onDash && (cur === null || empty(cur)) && value !== undefined) {
      lines.splice(e.first, e.last - e.first + 1, ...emitEntry(e.key, next, b.indent, (opts.depth ?? 1) + rest.length));
      return;
    }
    if (e.inline && inFlow(lines, e.inline, (txt) => flowSet(txt, rest, value))) return;
    setEntry(lines, b, e, next);
    return;
  }
  if (value !== undefined) {
    if (opts.block && e.inline && e.key !== undefined && !e.onDash && value && typeof value === 'object' && !empty(value)
      && e.inline.from.line === e.inline.to.line) {
      const line = lines[e.inline.from.line];
      const comment = line.slice(e.inline.to.col).trim();
      const out = emitEntry(e.key, value, b.indent, opts.depth ?? 1);
      if (comment.startsWith('#')) out[0] = `${out[0]}${' '.repeat(Math.max(1, line.indexOf(comment) - out[0].length))}${comment}`;
      lines.splice(e.first, e.last - e.first + 1, ...out);
      return;
    }
    setEntry(lines, b, e, value);
    return;
  }
  // Removing the last entry leaves an empty collection, not a null.
  if (b.entries.length === 1 && owner && !e.onDash) { setEntry(lines, owner.parent, owner.entry, b.kind === 'list' ? [] : {}); return; }
  removeEntry(lines, e, owner);
}

function split(source: string): { lines: string[]; eol: string } {
  return { lines: source.split(/\r?\n/), eol: source.includes('\r\n') ? '\r\n' : '\n' };
}

/**
 * The source with the value at `path` set; `undefined` removes it. Missing keys are created: a new map key goes
 * before the first existing key `order` ranks after it (else at the end), a list grows by appending (index =
 * length). The source must parse.
 */
export function setYamlIn(source: string, path: YamlPath, value: YamlValue | undefined, opts: EditOptions = {}): string {
  const { lines, eol } = split(source);
  const root = scan(lines);
  if (!root) {
    if (value === undefined || typeof path[0] !== 'string') return source;
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
    return [...lines, ...emitEntry(path[0], nest(path.slice(1), value), 0, (opts.depth ?? 1) + path.length - 1), ''].join(eol);
  }
  if (root.kind !== 'map') throw new Error('the document must be a map');
  applyIn(lines, root, path, value, opts);
  return lines.join(eol);
}

/** The source with the map key at `path` renamed (`to` must not exist next to it). */
export function renameYamlKey(source: string, path: YamlPath, to: string): string {
  const { lines, eol } = split(source);
  let b = scan(lines);
  for (let i = 0; b && i < path.length; i++) {
    const seg = path[i];
    const e = b.kind === 'map' ? b.entries.find((x) => x.key === String(seg)) : typeof seg === 'number' ? b.entries[seg] : undefined;
    if (!e) return source;
    if (i === path.length - 1) {
      if (!e.keyRange) return source;
      replaceRange(lines, e.keyRange, keyText(to));
      return lines.join(eol);
    }
    if (e.child) { b = e.child; continue; }
    if (!e.inline) return source;
    if (inFlow(lines, e.inline, (txt) => flowRename(txt, path.slice(i + 1), to))) return lines.join(eol);
    const cur = parseInlineYaml(inlineText(lines, e.inline));
    replaceRange(lines, e.inline, flowYaml(renamePlain(cur, path.slice(i + 1), to) ?? null));
    return lines.join(eol);
  }
  return source;
}
