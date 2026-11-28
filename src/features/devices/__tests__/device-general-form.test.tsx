import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SHIPPED_CATALOG } from '../../../domain/__tests__/catalog-fixture';
import type { DeviceDefinition } from '../../../domain/device/types';
import { DeviceGeneralForm, REPEATABLE_TOOLTIP_TEXT } from '../device-general-form';
import {
  INITIAL_INFO_TIP_STATE,
  InfoTip,
  computeInfoTipPosition,
  isInfoTipOpen,
  reduceInfoTipState,
  stopInfoTipClick,
} from '../../../ui/info-tip';

function findElements(
  node: ReactNode,
  predicate: (el: ReactElement<Record<string, unknown>>) => boolean,
  acc: ReactElement<Record<string, unknown>>[] = [],
): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) {
    for (const child of node) findElements(child, predicate, acc);
    return acc;
  }
  if (!isValidElement(node)) return acc;
  const el = node as ReactElement<Record<string, unknown>>;
  if (predicate(el)) acc.push(el);
  if (el.props && 'children' in el.props) {
    findElements(el.props.children as ReactNode, predicate, acc);
  }
  return acc;
}

describe('DeviceGeneralForm Repeatable checkbox and InfoTip', () => {
  const sampleDevice: DeviceDefinition = SHIPPED_CATALOG.devices.find((d) => d.id === 'switch-64x800g-osfp')!;

  it('renders short "Repeatable" label with InfoTip trigger and omits long inline explanation from the form body', () => {
    const html = renderToStaticMarkup(<DeviceGeneralForm device={sampleDevice} onChange={() => {}} />);

    expect(html).toContain('<span>Repeatable</span>');
    expect(html).toContain('aria-label="About Repeatable"');
    expect(html).toContain('>ⓘ</button>');
    expect(html).not.toContain(REPEATABLE_TOOLTIP_TEXT);
    expect(html).not.toContain('Repeatable —');
    expect(html).not.toContain('role="tooltip"');
  });

  it('shows the tooltip with role="tooltip" and matching aria-describedby on hover and keyboard focus', () => {
    // 1. State machine transitions across mouse hover, keyboard focus, blur, and Escape.
    let s = INITIAL_INFO_TIP_STATE;
    expect(isInfoTipOpen(s)).toBe(false);

    // Mouse hover opens, mouse leave closes.
    s = reduceInfoTipState(s, 'mouseenter');
    expect(isInfoTipOpen(s)).toBe(true);
    s = reduceInfoTipState(s, 'mouseleave');
    expect(isInfoTipOpen(s)).toBe(false);

    // Keyboard focus opens; moving mouse in and out while focused keeps it open until blur or Escape.
    s = reduceInfoTipState(s, 'focus');
    expect(isInfoTipOpen(s)).toBe(true);
    s = reduceInfoTipState(s, 'mouseenter');
    s = reduceInfoTipState(s, 'mouseleave');
    expect(isInfoTipOpen(s)).toBe(true);

    // Escape dismisses while focused; blur + re-focus opens again.
    s = reduceInfoTipState(s, 'escape');
    expect(isInfoTipOpen(s)).toBe(false);
    s = reduceInfoTipState(s, 'blur');
    s = reduceInfoTipState(s, 'focus');
    expect(isInfoTipOpen(s)).toBe(true);

    // 2. Extract the exact InfoTip element rendered by DeviceGeneralForm and render its open state.
    const tree = DeviceGeneralForm({ device: sampleDevice, onChange: () => {} });
    const infoTips = findElements(tree, (el) => el.type === InfoTip);
    expect(infoTips).toHaveLength(1);
    expect(infoTips[0].props.text).toBe(
      'One placement can stack n copies (drawn as one block, counted n times in the BOM). Not for devices cabled individually (switches).',
    );

    const openHtml = renderToStaticMarkup(
      <InfoTip
        label={String(infoTips[0].props.label)}
        text={String(infoTips[0].props.text)}
        open
      />,
    );
    const describedBy = /aria-describedby="([^"]+)"/.exec(openHtml)?.[1];
    const tooltipId = /<div id="([^"]+)" role="tooltip" class="tooltip"/.exec(openHtml)?.[1];
    expect(describedBy).toBeTruthy();
    expect(tooltipId).toBe(describedBy);
    expect(openHtml).toContain(REPEATABLE_TOOLTIP_TEXT);
  });

  it('toggles repeatable via onChange when the checkbox changes and never toggles when clicking/focusing InfoTip', () => {
    const onChange = vi.fn<(next: DeviceDefinition) => void>();
    const tree = DeviceGeneralForm({ device: sampleDevice, onChange });

    // InfoTip must sit outside <label className="checkbox"> so clicking/focusing ⓘ never activates the checkbox label.
    const labels = findElements(tree, (el) => el.type === 'label' && el.props.className === 'checkbox');
    expect(labels).toHaveLength(1);
    expect(findElements(labels[0], (el) => el.type === InfoTip)).toHaveLength(0);

    const checkboxes = findElements(labels[0], (el) => el.type === 'input' && el.props.type === 'checkbox');
    expect(checkboxes).toHaveLength(1);
    expect(checkboxes[0].props.checked).toBe(false);

    // Clicking the InfoTip trigger prevents default + stops propagation and never invokes DeviceGeneralForm's onChange.
    const preventDefault = vi.fn();
    const stopPropagation = vi.fn();
    stopInfoTipClick({ preventDefault, stopPropagation });
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(stopPropagation).toHaveBeenCalledOnce();
    expect(onChange).not.toHaveBeenCalled();

    // Toggling the checkbox calls onChange with `{ repeatable: true }`, then `{ repeatable: false }`.
    (checkboxes[0].props.onChange as (e: unknown) => void)({ target: { checked: true } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith({ ...sampleDevice, repeatable: true });

    const repeatableTree = DeviceGeneralForm({ device: { ...sampleDevice, repeatable: true }, onChange });
    const checkedInput = findElements(repeatableTree, (el) => el.type === 'input' && el.props.type === 'checkbox')[0];
    expect(checkedInput.props.checked).toBe(true);
    (checkedInput.props.onChange as (e: unknown) => void)({ target: { checked: false } });
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith({ ...sampleDevice, repeatable: false });
  });

  it('clamps tooltip coordinates cleanly within the viewport near right and bottom inspector edges', () => {
    const viewport = { width: 1280, height: 720 };
    const tipSize = { width: 280, height: 64 };

    // Near right-hand inspector edge with vertical room below: placed below and clamped away from right viewport edge.
    const rightInspectorAnchor = { left: 1180, top: 200, right: 1196, bottom: 216, width: 16, height: 16 };
    const posBelow = computeInfoTipPosition(rightInspectorAnchor, tipSize, viewport);
    expect(posBelow).toEqual({ left: 992, top: 224 });
    expect(posBelow.left + tipSize.width).toBeLessThanOrEqual(viewport.width - 8);

    // Near bottom-right corner: flips cleanly above the trigger.
    const bottomRightAnchor = { left: 1180, top: 680, right: 1196, bottom: 696, width: 16, height: 16 };
    const posAbove = computeInfoTipPosition(bottomRightAnchor, tipSize, viewport);
    expect(posAbove).toEqual({ left: 992, top: 608 });
    expect(posAbove.top).toBeGreaterThanOrEqual(8);
  });
});
