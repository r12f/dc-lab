import { Button } from '../../ui/button';
import { downloadText } from '../../io/download';

/** Downloads one catalog item as a standalone JSON file (one file per item, like the built-in catalog). */
export function ExportJsonButton({ schema, item, label }: { schema: string; item: { id: string }; label: string }) {
  return (
    <Button onClick={() => downloadText(`${item.id}.json`, JSON.stringify({ schema, ...item }, null, 2))}>{label}</Button>
  );
}
