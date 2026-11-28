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

  if (anchor.bottom + GAP + tip.height <= viewport.height - MARGIN) {
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
  flex: 'none',
  verticalAlign: 'middle',
};

export interface InfoTipProps {
  text: string;
  label?: string;
  /** Optional controlled open state (e.g. for deterministic rendering tests). */
  open?: boolean;
}

export function stopInfoTipClick(e: Pick<MouseEvent<HTMLButtonElement>, 'preventDefault' | 'stopPropagation'>): void {
  e.preventDefault();
  e.stopPropagation();
}

/**
 * Compact keyboard-focusable `ⓘ` indicator that displays `text` in a floating `.tooltip`
 * portaled to `document.body` on mouse hover or keyboard focus.
 */
export function InfoTip({ text, label = 'More information', open: controlledOpen }: InfoTipProps) {
  const tipId = useId();
  const [state, setState] = useState<InfoTipState>(INITIAL_INFO_TIP_STATE);
  const [pos, setPos] = useState<{ left: number; top: number }>();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);

  const isOpen = controlledOpen ?? isInfoTipOpen(state);

  const dispatch = (action: InfoTipAction) => setState((prev) => reduceInfoTipState(prev, action));

  useLayoutEffect(() => {
    if (!isOpen) {
      setPos(undefined);
      return;
    }
    const updatePosition = () => {
      const trigger = triggerRef.current;
      const tip = tipRef.current;
      if (!trigger || !tip || typeof window === 'undefined') return;
      const rect = trigger.getBoundingClientRect();
      setPos(
        computeInfoTipPosition(
          rect,
          { width: tip.offsetWidth, height: tip.offsetHeight },
          { width: window.innerWidth, height: window.innerHeight },
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
  }, [isOpen, text]);

  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return;
    const onWindowKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') dispatch('escape');
    };
    window.addEventListener('keydown', onWindowKeyDown);
    return () => window.removeEventListener('keydown', onWindowKeyDown);
  }, [isOpen]);

  const onTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      dispatch('escape');
    }
  };

  const tooltipEl = isOpen ? (
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
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-describedby={isOpen ? tipId : undefined}
        style={{ ...TRIGGER_BASE_STYLE, color: isOpen ? 'var(--accent)' : 'var(--muted)' }}
        onMouseEnter={() => dispatch('mouseenter')}
        onMouseLeave={() => dispatch('mouseleave')}
        onFocus={() => dispatch('focus')}
        onBlur={() => dispatch('blur')}
        onClick={stopInfoTipClick}
        onKeyDown={onTriggerKeyDown}
      >
        ⓘ
      </button>
      {tooltipEl && (typeof document !== 'undefined' && document.body ? createPortal(tooltipEl, document.body) : tooltipEl)}
    </>
  );
}
