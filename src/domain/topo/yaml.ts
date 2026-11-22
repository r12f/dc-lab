/**
 * Small YAML reader for topology files: block maps and lists, flow `{}` / `[]` (may span lines), quoted and
 * plain scalars, `#` comments. Anchors, tags, multi-documents and block scalars (`|`, `>`) are not supported.
 */
export type YamlValue = string | number | boolean | null | YamlValue[] | { [key: string]: YamlValue };

export class YamlError extends Error {
  constructor(message: string, readonly line: number) {
    super(`line ${line}: ${message}`);
  }
}

interface Line { indent: number; text: string; no: number }

/** Strips a trailing `# comment` that is outside quotes and starts the line or follows whitespace. */
function stripComment(s: string): string {
  let q: string | undefined;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === q && s[i - 1] !== '\\') q = undefined; continue; }
    if (c === '"' || c === "'") q = c;
    else if (c === '#' && (i === 0 || /\s/.test(s[i - 1]))) return s.slice(0, i);
  }
  return s;
}

function depthDelta(s: string): number {
  let d = 0; let q: string | undefined;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === q && s[i - 1] !== '\\') q = undefined; continue; }
    if (c === '"' || c === "'") q = c;
    else if (c === '{' || c === '[') d++;
    else if (c === '}' || c === ']') d--;
  }
  return d;
}

function scalar(raw: string, no: number): YamlValue {
  const s = raw.trim();
  if (s === '' || s === '~' || s === 'null') return null;
  if (s[0] === '"') {
    if (!s.endsWith('"') || s.length < 2) throw new YamlError('unterminated string', no);
    return s.slice(1, -1).replace(/\\(["\\nt])/g, (_, c: string) => (c === 'n' ? '\n' : c === 't' ? '\t' : c));
  }
  if (s[0] === "'") {
    if (!s.endsWith("'") || s.length < 2) throw new YamlError('unterminated string', no);
    return s.slice(1, -1).replace(/''/g, "'");
  }
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (/^[-+]?\d+(\.\d+)?$/.test(s)) return Number(s);
  return s;
}

/** Index of the `:` that ends a mapping key (followed by space or end), outside quotes and brackets. */
function keyColon(s: string): number {
  let q: string | undefined; let d = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === q && s[i - 1] !== '\\') q = undefined; continue; }
    if (c === '"' || c === "'") q = c;
    else if (c === '{' || c === '[') d++;
    else if (c === '}' || c === ']') d--;
    else if (c === ':' && d === 0 && (i + 1 === s.length || s[i + 1] === ' ')) return i;
  }
  return -1;
}

function keyText(raw: string, no: number): string {
  const k = scalar(raw, no);
  if (k === null || typeof k === 'object') throw new YamlError('bad key', no);
  return String(k);
}

/** Flow collection parser (`{ a: 1, b: [x, y] }`). */
function parseFlow(src: string, no: number): YamlValue {
  let i = 0;
  const ws = () => { while (i < src.length && /\s/.test(src[i])) i++; };
  const value = (): YamlValue => {
    ws();
    const c = src[i];
    if (c === '{') {
      i++; const out: { [k: string]: YamlValue } = {};
      ws();
      if (src[i] === '}') { i++; return out; }
      for (;;) {
        ws();
        const k = token(':');
        if (src[i] !== ':') throw new YamlError(`expected ':' after "${k}"`, no);
        i++;
        out[keyText(k, no)] = value();
        ws();
        if (src[i] === ',') { i++; continue; }
        if (src[i] === '}') { i++; return out; }
        throw new YamlError("expected ',' or '}'", no);
      }
    }
    if (c === '[') {
      i++; const out: YamlValue[] = [];
      ws();
      if (src[i] === ']') { i++; return out; }
      for (;;) {
        out.push(value());
        ws();
        if (src[i] === ',') { i++; continue; }
        if (src[i] === ']') { i++; return out; }
        throw new YamlError("expected ',' or ']'", no);
      }
    }
    return scalar(token(''), no);
  };
  /** Reads a scalar token up to `,` `]` `}` (and `stop`), honouring quotes. */
  const token = (stop: string): string => {
    ws();
    const start = i;
    if (src[i] === '"' || src[i] === "'") {
      const q = src[i++];
      while (i < src.length && !(src[i] === q && src[i - 1] !== '\\')) i++;
      if (i >= src.length) throw new YamlError('unterminated string', no);
      i++;
      return src.slice(start, i);
    }
    // Braces inside a plain scalar (`p{1-4}`, `e{1,7}`) belong to it: only an unnested `,` `]` `}` ends it.
    let d = 0;
    while (i < src.length) {
      const c = src[i];
      if (c === '{' && i > start) d++;
      else if (c === '}' && d > 0) d--;
      else if (d === 0 && (',]}'.includes(c) || (stop && c === stop && (src[i + 1] === ' ' || src[i + 1] === undefined)))) break;
      i++;
    }
    return src.slice(start, i).trim();
  };
  const v = value();
  ws();
  if (i < src.length) throw new YamlError(`unexpected "${src.slice(i, i + 10)}"`, no);
  return v;
}

export function parseYaml(text: string): YamlValue {
  const lines: Line[] = [];
  const raw = text.replace(/\r\n?/g, '\n').split('\n');
  for (let n = 0; n < raw.length; n++) {
    if (/^\s*\t/.test(raw[n])) throw new YamlError('tabs are not allowed for indentation', n + 1);
    let t = stripComment(raw[n]).replace(/\s+$/, '');
    if (!t.trim()) continue;
    if (/^(---|\.\.\.)$/.test(t.trim())) continue;
    const no = n + 1;
    // A flow collection spanning several lines is joined into one logical line.
    let d = depthDelta(t);
    while (d > 0 && n + 1 < raw.length) {
      n++;
      const more = stripComment(raw[n]).trim();
      t += ' ' + more;
      d += depthDelta(more);
    }
    if (d !== 0) throw new YamlError('unbalanced brackets', no);
    const indent = t.length - t.trimStart().length;
    lines.push({ indent, text: t.trim(), no });
  }
  let p = 0;

  const inline = (s: string, no: number): YamlValue => (s[0] === '{' || s[0] === '[' ? parseFlow(s, no) : scalar(s, no));

  function block(indent: number): YamlValue {
    const first = lines[p];
    if (first.text === '-' || first.text.startsWith('- ')) return list(indent);
    return map(indent);
  }

  /** Value after `key:` — inline, or a nested block (deeper, or a list at the same indent). */
  function afterKey(rest: string, indent: number, no: number): YamlValue {
    if (rest) return inline(rest, no);
    const nx = lines[p];
    if (nx && (nx.indent > indent || (nx.indent === indent && (nx.text === '-' || nx.text.startsWith('- '))))) return block(nx.indent);
    return null;
  }

  function map(indent: number, out: { [k: string]: YamlValue } = {}): YamlValue {
    while (p < lines.length && lines[p].indent === indent) {
      const ln = lines[p];
      if (ln.text === '-' || ln.text.startsWith('- ')) break;
      const c = keyColon(ln.text);
      if (c < 0) throw new YamlError(`expected "key: value", got "${ln.text}"`, ln.no);
      const k = keyText(ln.text.slice(0, c), ln.no);
      if (k in out) throw new YamlError(`duplicate key "${k}"`, ln.no);
      p++;
      out[k] = afterKey(ln.text.slice(c + 1).trim(), indent, ln.no);
    }
    if (p < lines.length && lines[p].indent > indent) throw new YamlError('bad indentation', lines[p].no);
    return out;
  }

  function list(indent: number): YamlValue {
    const out: YamlValue[] = [];
    while (p < lines.length && lines[p].indent === indent && (lines[p].text === '-' || lines[p].text.startsWith('- '))) {
      const ln = lines[p];
      const rest = ln.text.slice(1).trimStart();
      const col = indent + (ln.text.length - rest.length);
      p++;
      if (!rest) {
        const nx = lines[p];
        out.push(nx && nx.indent > indent ? block(nx.indent) : null);
      } else if (rest[0] !== '{' && rest[0] !== '[' && rest[0] !== '"' && rest[0] !== "'" && keyColon(rest) >= 0) {
        // "- key: value" opens a map whose keys sit at the column after "- ".
        lines.splice(p, 0, { indent: col, text: rest, no: ln.no });
        out.push(map(col));
      } else if (rest.startsWith('- ')) {
        lines.splice(p, 0, { indent: col, text: rest, no: ln.no });
        out.push(list(col));
      } else {
        out.push(inline(rest, ln.no));
      }
    }
    if (p < lines.length && lines[p].indent > indent) throw new YamlError('bad indentation', lines[p].no);
    return out;
  }

  if (!lines.length) return null;
  const v = block(lines[0].indent);
  if (p < lines.length) throw new YamlError('bad indentation', lines[p].no);
  return v;
}
