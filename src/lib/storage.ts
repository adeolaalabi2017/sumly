/**
 * Reads a localStorage value under its current key. If it is missing, falls back
 * to the key used before the Sumly rename, copies the value across and removes
 * the old key, so saved settings survive the rename.
 */
export function getWithLegacy(
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">,
  key: string,
  legacyKey: string
): string | null {
  const current = storage.getItem(key);
  if (current !== null) return current;
  const legacy = storage.getItem(legacyKey);
  if (legacy === null) return null;
  storage.setItem(key, legacy);
  storage.removeItem(legacyKey);
  return legacy;
}
