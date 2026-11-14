import { Button } from './Button';

/** Shown on built-in items: they cannot be edited, only duplicated into the project. */
export function ReadOnlyNotice({ onDuplicate }: { onDuplicate(): void }) {
  return (
    <div className="notice">
      Built-in item (read-only).
      <Button variant="primary" onClick={onDuplicate}>Duplicate to edit</Button>
    </div>
  );
}
