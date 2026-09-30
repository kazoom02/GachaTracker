// Pure WuWa history reconciliation. Both inputs are chronological (oldest first).
// Kuro may return only a recent window, so a shorter response can still contain
// brand-new pulls and must not be discarded just because its length is smaller.

function stablePart(value) {
  return String(value ?? '').trim().toLowerCase();
}

function rarityPart(pull) {
  return Number(pull?.rarity) || 0;
}

function fallbackKey(pull, includeTime = true) {
  return [
    includeTime ? stablePart(pull.time) : '',
    stablePart(pull.name),
    rarityPart(pull),
  ].join('|');
}

function idKey(pull, includeTime = true) {
  const resourceId = stablePart(pull.resourceId);
  if (!resourceId) return '';
  return [
    includeTime ? stablePart(pull.time) : '',
    resourceId,
    rarityPart(pull),
  ].join('|');
}

function sameContent(left, right) {
  if (rarityPart(left) !== rarityPart(right)) return false;
  const leftId = stablePart(left.resourceId);
  const rightId = stablePart(right.resourceId);
  if (leftId && rightId) return leftId === rightId;
  return stablePart(left.name) === stablePart(right.name);
}

function sameExactPull(left, right) {
  return stablePart(left.time) === stablePart(right.time) && sameContent(left, right);
}

function suffixPrefixOverlap(stored, fresh, isMatch) {
  const max = Math.min(stored.length, fresh.length);
  for (let size = max; size > 0; size--) {
    const storedStart = stored.length - size;
    let allMatch = true;
    for (let i = 0; i < size; i++) {
      if (!isMatch(stored[storedStart + i], fresh[i])) {
        allMatch = false;
        break;
      }
    }
    if (allMatch) return size;
  }
  return 0;
}

function enrichPull(stored, fresh) {
  return {
    ...stored,
    resourceId: stored.resourceId || fresh.resourceId || '',
    itemType: stored.itemType || fresh.itemType || '',
  };
}

function byTime(a, b) {
  const at = stablePart(a.time);
  const bt = stablePart(b.time);
  if (at !== bt) return at < bt ? -1 : 1;
  return 0;
}

function indexedBy(pulls, keyOf) {
  const result = new Map();
  pulls.forEach((pull, index) => {
    const key = keyOf(pull);
    if (!key) return;
    const indices = result.get(key) || [];
    indices.push(index);
    result.set(key, indices);
  });
  return result;
}

function takeAvailable(indices, consumed, predicate = () => true) {
  for (const index of indices || []) {
    if (!consumed.has(index) && predicate(index)) {
      consumed.add(index);
      return index;
    }
  }
  return -1;
}

function occurrenceDifference(stored, fresh) {
  const byId = indexedBy(stored, (pull) => idKey(pull));
  const byFallback = indexedBy(stored, (pull) => fallbackKey(pull));
  const consumed = new Set();
  const additions = [];

  for (const pull of fresh) {
    const incomingId = stablePart(pull.resourceId);
    let index = incomingId
      ? takeAvailable(byId.get(idKey(pull)), consumed)
      : -1;

    // An exported Convene row may not have a resource id. In that cross-source
    // case, name + rarity + time is the common identity. Never use the fallback
    // to equate two different non-empty ids.
    if (index < 0) {
      index = takeAvailable(
        byFallback.get(fallbackKey(pull)),
        consumed,
        (candidate) => !incomingId || !stablePart(stored[candidate].resourceId),
      );
    }

    if (index >= 0) stored[index] = enrichPull(stored[index], pull);
    else additions.push(pull);
  }
  return additions;
}

// Versions that compared `id:<resourceId>` with `name:<name>` could append a
// live copy beside every row imported from an id-less Convene export. Heal only
// groups where each id-less row has an id-bearing counterpart, preserving the
// multiplicity of genuine repeated items inside a ten-pull.
export function repairWuwaHistory(pullsAsc) {
  const pulls = (Array.isArray(pullsAsc) ? pullsAsc : []).map((pull) => ({ ...pull }));
  const groups = new Map();
  pulls.forEach((pull, index) => {
    const key = fallbackKey(pull);
    const group = groups.get(key) || { idless: [], identified: [] };
    (stablePart(pull.resourceId) ? group.identified : group.idless).push(index);
    groups.set(key, group);
  });

  const remove = new Set();
  for (const group of groups.values()) {
    if (!group.idless.length || group.identified.length < group.idless.length) continue;
    for (const index of group.idless) remove.add(index);
  }

  // The same broken merge could store the two copies several hours apart when
  // the file used UTC and the live API used server-local time. Recover the two
  // source sequences and remove only a credible suffix/prefix overlap.
  const idless = [];
  const identified = [];
  pulls.forEach((pull, index) => {
    if (remove.has(index)) return;
    const target = stablePart(pull.resourceId) ? identified : idless;
    target.push({ pull, index });
  });
  if (idless.length && identified.length) {
    const overlap = suffixPrefixOverlap(
      idless.map((entry) => entry.pull),
      identified.map((entry) => entry.pull),
      sameContent,
    );
    if (overlap >= 4) {
      for (const entry of idless.slice(idless.length - overlap)) remove.add(entry.index);
    }
  }

  return remove.size ? pulls.filter((_, index) => !remove.has(index)) : pulls;
}

export function mergeWuwaHistory(storedAsc, freshAsc) {
  const stored = repairWuwaHistory(storedAsc);
  const fresh = (Array.isArray(freshAsc) ? freshAsc : []).map((pull) => ({ ...pull }));

  if (!fresh.length) return { list: stored, added: 0, strategy: 'empty-response' };
  if (!stored.length) return { list: fresh, added: fresh.length, strategy: 'initial' };

  // Normal live-import path, including a rolling API window: the old history's
  // tail is the new response's head, and anything after it is genuinely new.
  let overlap = suffixPrefixOverlap(stored, fresh, sameExactPull);
  let strategy = 'exact-overlap';

  // File exports can express the same server time in a different timezone.
  // Fall back to a content sequence only when it is long enough to be credible.
  if (!overlap) {
    const contentOverlap = suffixPrefixOverlap(stored, fresh, sameContent);
    const credibleLength = Math.min(4, stored.length, fresh.length);
    if (contentOverlap >= credibleLength) {
      overlap = contentOverlap;
      strategy = 'content-overlap';
    }
  }

  if (overlap) {
    const storedStart = stored.length - overlap;
    for (let i = 0; i < overlap; i++) {
      stored[storedStart + i] = enrichPull(stored[storedStart + i], fresh[i]);
    }
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
