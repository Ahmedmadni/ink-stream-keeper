/**
 * Search the entire in-memory collection before applying the display cap.
 * Slicing first made items past the first 20 permanently undiscoverable.
 */
export function filterCommandItems<T>(
  items: readonly T[],
  query: string,
  searchText: (item: T) => string,
  limit = 20,
): T[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (limit <= 0) return [];
  if (!normalizedQuery) return items.slice(0, limit);
  const matches: T[] = [];
  for (const item of items) {
    if (searchText(item).toLocaleLowerCase().includes(normalizedQuery)) {
      matches.push(item);
      if (matches.length >= limit) break;
    }
  }
  return matches;
}
