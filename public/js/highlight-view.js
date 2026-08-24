// Pure filtering and ordering for the highlighted 4★ / 5★ timeline.
// Input rows are newest-first, matching pullRows() in main.js.

export function filterHighlights(rows, options = {}) {
  const rarity = Number(options.rarity || 5);
  const order = options.order === 'oldest' ? 'oldest' : 'newest';
  let filtered = (Array.isArray(rows) ? rows : []).filter((row) => Number(row.rarity) === rarity);
  if (order === 'oldest') filtered = filtered.slice().reverse();
  return filtered;
}
