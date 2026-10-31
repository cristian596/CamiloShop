export const SEARCH_MIN_LENGTH = 2;
export const SEARCH_MAX_LENGTH = 80;

/** Trims, collapses whitespace and caps length; returns null when too short to search. */
export function normalizeSearchQuery(raw: string | string[] | undefined | null): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string") return null;
  const query = value.replace(/\s+/g, " ").trim().slice(0, SEARCH_MAX_LENGTH);
  return query.length >= SEARCH_MIN_LENGTH ? query : null;
}

/** Escapes LIKE wildcards so user input is matched literally. */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}
