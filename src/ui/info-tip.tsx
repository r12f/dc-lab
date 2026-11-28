import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import { createPortal } from 'react-dom';

const GAP = 8;
const MARGIN = 8;

export interface AnchorBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface InfoTipState {
  hovered: boolean;
  focused: boolean;
  dismissed: boolean;
}

export type InfoTipAction = 'mouseenter' | 'mouseleave' | 'focus' | 'blur' | 'escape';

export const INITIAL_INFO_TIP_STATE: InfoTipState = {
  hovered: false,
  focused: false,
  dismissed: false,
};

export function reduceInfoTipState(state: InfoTipState, action: InfoTipAction): InfoTipState {
  switch (action) {
    case 'mouseenter':
      return { ...state, hovered: true, dismissed: false };
    case 'mouseleave':
      return { ...state, hovered: false, dismissed: state.focused ? state.dismissed : false };
    case 'focus':
      return { ...state, focused: true, dismissed: false };
    case 'blur':
      return { ...state, focused: false, dismissed: state.hovered ? state.dismissed : false };
    case 'escape':
      return { ...state, dismissed: true };
  }
}

export function isInfoTipOpen(state: InfoTipState): boolean {
  return (state.hovered || state.focused) && !state.dismissed;
}

/** Whether any part of `anchor` remains visible within `viewport`. */
export function isAnchorInViewport(
  anchor: Pick<AnchorBox, 'left' | 'top' | 'right' | 'bottom'>,
  viewport: { width: number; height: number },
): boolean {
  return anchor.bottom > 0 && anchor.top < viewport.height && anchor.right > 0 && anchor.left < viewport.width;
}

/** Position a `.tooltip` box cleanly inside the viewport without overlapping `anchor`. */
export function computeInfoTipPosition(
  anchor: AnchorBox,
  tip: { width: number; height: number },
  viewport: { width: number; height: number },
): { left: number; top: number } {
  const maxLeft = Math.max(MARGIN, viewport.width - tip.width - MARGIN);
  const maxTop = Math.max(MARGIN, viewport.height - tip.height - MARGIN);
  const clampX = (x: number) => Math.max(MARGIN, Math.min(maxLeft, x));
  const clampY = (y: number) => Math.max(MARGIN, Math.min(maxTop, y));
  const centeredX = clampX(anchor.left + anchor.width / 2 - tip.width / 2);

  if (anchor.bottom + GAP >= MARGIN && anchor.bottom + GAP + tip.height <= viewport.height - MARGIN) {
    return { left: centeredX, top: anchor.bottom + GAP };
  }
  if (anchor.top - GAP - tip.height >= MARGIN) {
    return { left: centeredX, top: anchor.top - GAP - tip.height };
  }
  if (anchor.left - GAP - tip.width >= MARGIN) {
    return { left: anchor.left - GAP - tip.width, top: clampY(anchor.top + anchor.height / 2 - tip.height / 2) };
  }
  if (anchor.right + GAP + tip.width <= viewport.width - MARGIN) {
    return { left: anchor.right + GAP, top: clampY(anchor.top + anchor.height / 2 - tip.height / 2) };
  }
  return { left: centeredX, top: clampY(anchor.bottom + GAP) };
}

const TRIGGER_BASE_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 16,
  height: 16,
  minWidth: 16,
  padding: 0,
  margin: 0,
  border: 0,
  borderRadius: '50%',
  background: 'transparent',
  fontSize: 12,
  lineHeight: 1,
  cursor: 'help',
  userSelect: 'none',
  flex: 'none',
  verticalAlign: 'middle',
};

export interface InfoTipProps {
  text: string;
  label?: string;
  /** Optional controlled open state (e.g. for deterministic rendering tests). */
  open?: boolean;
}

export function stopInfoTipClick(e: Pick<MouseEvent<HTMLElement>, 'preventDefault' | 'stopPropagation'>): void {
  e.preventDefault();
  e.stopPropagation();
}

export function handleInfoTipKeyDown(
  e: Pick<KeyboardEvent<HTMLElement>, 'key' | 'preventDefault' | 'stopPropagation'>,
  dispatch: (action: InfoTipAction) => void,
): void {
  if (e.key === 'Escape') {
    e.stopPropagation();
    dispatch('escape');
  } else if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault();
    e.stopPropagation();
    dispatch('focus');
  }
}

/**
 * Compact keyboard-focusable `ⓘ` indicator that displays `text` in a floating `.tooltip`
 * portaled to `document.body` on mouse hover or keyboard focus. Uses a non-form-control `<span role="button">`
 * so ancestor `<fieldset disabled>` wrappers (read-only built-in catalog items) never disable hover or Tab focus.
 */
export function InfoTip({ text, label = 'More information', open: controlledOpen }: InfoTipProps) {
  const tipId = useId();
  const [state, setState] = useState<InfoTipState>(INITIAL_INFO_TIP_STATE);
  const [offscreen, setOffscreen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number }>();
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);

  const wantOpen = controlledOpen ?? isInfoTipOpen(state);
  const shown = wantOpen && !offscreen;

  const dispatch = (action: InfoTipAction) => setState((prev) => reduceInfoTipState(prev, action));

  useLayoutEffect(() => {
    if (!wantOpen) {
      setOffscreen(false);
      setPos(undefined);
      return;
    }
    const updatePosition = () => {
      const trigger = triggerRef.current;
      if (!trigger || typeof window === 'undefined') return;
      const rect = trigger.getBoundingClientRect();
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      if (!isAnchorInViewport(rect, viewport)) {
        setOffscreen(true);
        setPos(undefined);
        return;
      }
      setOffscreen(false);
      const tip = tipRef.current;
      if (!tip) return;
      setPos(
        computeInfoTipPosition(
          rect,
          { width: tip.offsetWidth, height: tip.offsetHeight },
          viewport,
        ),
      );
    };
    updatePosition();
    if (typeof window === 'undefined') return;
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [wantOpen, offscreen, text]);

  useEffect(() => {
    if (!shown || typeof window === 'undefined') return;
    const onWindowKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') dispatch('escape');
    };
    window.addEventListener('keydown', onWindowKeyDown);
    return () => window.removeEventListener('keydown', onWindowKeyDown);
  }, [shown]);

  const tooltipEl = shown ? (
    <div
      ref={tipRef}
      id={tipId}
      role="tooltip"
      className="tooltip"
      style={pos ? { left: pos.left, top: pos.top } : { left: -9999, top: -9999 }}
    >
      {text}
    </div>
  ) : null;

  return (
    <>
      <span
        ref={triggerRef}
        role="button"
        tabIndex={0}
        aria-label={label}
        aria-describedby={shown ? tipId : undefined}
        style={{ ...TRIGGER_BASE_STYLE, color: shown ? 'var(--accent)' : 'var(--muted)' }}
        onMouseEnter={() => dispatch('mouseenter')}
        onMouseLeave={() => dispatch('mouseleave')}
        onFocus={() => dispatch('focus')}
        onBlur={() => dispatch('blur')}
        onClick={stopInfoTipClick}
        onKeyDown={(e) => handleInfoTipKeyDown(e, dispatch)}
      >
        ⓘ
      </span>
      {tooltipEl && (typeof document !== 'undefined' && document.body ? createPortal(tooltipEl, document.body) : tooltipEl)}
    </>
  );
}
