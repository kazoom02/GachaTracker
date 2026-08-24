// Pure WuWa history reconciliation. Both inputs are chronological (oldest first).
// Kuro may return only a recent window, so a shorter response can still contain
// brand-new pulls and must not be discarded just because its length is smaller.

function stablePart(value) {
  return String(value ?? '').trim().toLowerCase();
}

function exactKey(pull) {
  return [
    stablePart(pull.time),
    contentKey(pull),
  ].join('|');
}

function contentKey(pull) {
  const resourceId = stablePart(pull.resourceId);
  const identity = resourceId ? `id:${resourceId}` : `name:${stablePart(pull.name)}`;
  return `${identity}|${Number(pull.rarity) || 0}`;
}

function suffixPrefixOverlap(stored, fresh, keyOf) {
  const max = Math.min(stored.length, fresh.length);
  for (let size = max; size > 0; size--) {
    const storedStart = stored.length - size;
    let matches = true;
    for (let i = 0; i < size; i++) {
      if (keyOf(stored[storedStart + i]) !== keyOf(fresh[i])) {
        matches = false;
        break;
      }
    }
    if (matches) return size;
  }
  return 0;
}

function byTime(a, b) {
  const at = stablePart(a.time);
  const bt = stablePart(b.time);
  if (at !== bt) return at < bt ? -1 : 1;
  return 0;
}

function occurrenceDifference(stored, fresh) {
  const have = new Map();
  for (const pull of stored) {
    const key = exactKey(pull);
    have.set(key, (have.get(key) || 0) + 1);
  }

  const seen = new Map();
  const additions = [];
  for (const pull of fresh) {
    const key = exactKey(pull);
    const occurrence = (seen.get(key) || 0) + 1;
    seen.set(key, occurrence);
    if (occurrence > (have.get(key) || 0)) additions.push(pull);
  }
  return additions;
}

export function mergeWuwaHistory(storedAsc, freshAsc) {
  const stored = Array.isArray(storedAsc) ? storedAsc.slice() : [];
  const fresh = Array.isArray(freshAsc) ? freshAsc.slice() : [];

  if (!fresh.length) return { list: stored, added: 0, strategy: 'empty-response' };
  if (!stored.length) return { list: fresh, added: fresh.length, strategy: 'initial' };

  // Normal live-import path, including a rolling API window: the old history's
  // tail is the new response's head, and anything after it is genuinely new.
  let overlap = suffixPrefixOverlap(stored, fresh, exactKey);
  let strategy = 'exact-overlap';

  // File exports can express the same server time in a different timezone.
  // Fall back to a content sequence only when it is long enough to be credible.
  if (!overlap) {
    const contentOverlap = suffixPrefixOverlap(stored, fresh, contentKey);
    const credibleLength = Math.min(4, stored.length, fresh.length);
    if (contentOverlap >= credibleLength) {
      overlap = contentOverlap;
      strategy = 'content-overlap';
    }
  }

  if (overlap) {
    const additions = fresh.slice(overlap);
    return { list: stored.concat(additions), added: additions.length, strategy };
  }

  // If the snapshots do not meet at a boundary, retain all stored history and
  // add only exact occurrence-count differences. Counting occurrences preserves
  // duplicate items inside a ten-pull without duplicating a repeated import.
  const additions = occurrenceDifference(stored, fresh);
  if (!additions.length) return { list: stored, added: 0, strategy: 'already-contained' };

  return {
    list: stored.concat(additions).sort(byTime),
    added: additions.length,
    strategy: 'occurrence-merge',
  };
}
