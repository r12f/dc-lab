/** Sidebar/selection keys for items (vendor products), distinct from item type ids. */
const PREFIX = 'item:';

export const toItemKey = (variantId: string) => `${PREFIX}${variantId}`;

export function fromItemKey(key: string | undefined): string | undefined {
  return key?.startsWith(PREFIX) ? key.slice(PREFIX.length) : undefined;
}
