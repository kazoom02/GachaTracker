// Pure filtering, ordering, and pagination for the highlighted 4★ / 5★ timeline.
// Input rows are newest-first, matching pullRows() in main.js.

export function paginateHighlights(rows, options = {}) {
  const rarity = Number(options.rarity || 5);
  const order = options.order === 'oldest' ? 'oldest' : 'newest';
  const pageSize = Math.max(1, Number(options.pageSize) || 40);
  let filtered = (Array.isArray(rows) ? rows : []).filter((row) => Number(row.rarity) === rarity);
  if (order === 'oldest') filtered = filtered.slice().reverse();

  const total = filtered.length;
  const maxPage = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, Number(options.page) || 1), maxPage);
  const offset = (page - 1) * pageSize;
  const items = filtered.slice(offset, offset + pageSize);

  return {
    items,
    total,
    page,
    maxPage,
    start: total ? offset + 1 : 0,
    end: Math.min(total, offset + pageSize),
  };
}
