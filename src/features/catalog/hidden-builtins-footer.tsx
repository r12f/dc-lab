import { useAppStore } from '../../state/store';

/**
 * Sidebar footer: "Show n hidden built-in item(s)" for the built-ins of one module that were deleted (hidden);
 * clicking it brings back exactly those.
 */
export function HiddenBuiltinsFooter({ builtinIds }: { builtinIds: readonly string[] }) {
  const hidden = useAppStore((s) => s.project.hiddenBuiltins);
  const restore = useAppStore((s) => s.restoreBuiltins);
  const mine = hidden.filter((id) => builtinIds.includes(id));
  if (!mine.length) return null;
  return (
    <button type="button" className="link" onClick={() => restore(mine)}>
      {`Show ${mine.length} hidden built-in item${mine.length > 1 ? 's' : ''}`}
    </button>
  );
}
