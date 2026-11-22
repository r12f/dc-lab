import { useMemo, useRef, type UIEvent } from 'react';
import type { Problem } from '../../domain/topo/virtual';

interface Props {
  value: string;
  onChange(value: string): void;
  problems: Problem[];
}

/** Code pane: monospace textarea with line numbers and the parse problems under it. */
export function TopoEditor({ value, onChange, problems }: Props) {
  const gutter = useRef<HTMLDivElement>(null);
  const lines = useMemo(() => value.split('\n').length, [value]);
  const bad = new Set(problems.map((p) => p.line).filter((n): n is number => n !== undefined));
  const sync = (e: UIEvent<HTMLTextAreaElement>) => { if (gutter.current) gutter.current.scrollTop = e.currentTarget.scrollTop; };
  return (
    <div className="topo-editor">
      <div className="topo-code">
        <div className="topo-gutter" ref={gutter} aria-hidden="true">
          {Array.from({ length: lines }, (_, i) => <div key={i} className={bad.has(i + 1) ? 'bad' : ''}>{i + 1}</div>)}
        </div>
        <textarea value={value} spellCheck={false} wrap="off" aria-label="Topology source (YAML)"
          onChange={(e) => onChange(e.target.value)} onScroll={sync}
          onKeyDown={(e) => {
            // Tab inserts two spaces (YAML forbids tab indentation).
            if (e.key !== 'Tab') return;
            e.preventDefault();
            const t = e.currentTarget; const s = t.selectionStart;
            const next = `${value.slice(0, s)}  ${value.slice(t.selectionEnd)}`;
            onChange(next);
            requestAnimationFrame(() => { t.selectionStart = t.selectionEnd = s + 2; });
          }} />
      </div>
      <div className={`topo-problems ${problems.length ? 'has' : ''}`}>
        {problems.length
          ? <ul>{problems.map((p, i) => <li key={i}>{p.line ? `line ${p.line}: ` : ''}{p.message.replace(/^line \d+: /, '')}</li>)}</ul>
          : 'No problems.'}
      </div>
    </div>
  );
}
