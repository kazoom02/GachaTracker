// Pure Genshin history reconciliation. File exports do not contain HoYoverse pull
// ids, and paimon.moe combines Character Event types 301 and 400 into one sheet.
// Match within the already-selected banner by pull content, then enrich matched
// file rows with their live ids/type so the next URL import can stop early.

function stablePart(value) {
  return String(value ?? '').trim().toLowerCase();
}

function signature(pull) {
  return [
    stablePart(pull.time),
    stablePart(pull.name),
    Number(pull.rarity) || 0,
  ].join('|');
}

function numericIdCompare(a, b) {
  const left = String(a || '');
  const right = String(b || '');
  if (!left || !right || left === right) return 0;
  try {
    return BigInt(left) < BigInt(right) ? -1 : 1;
  } catch {
    const leftNumber = Number(left);
    const rightNumber = Number(right);
    if (leftNumber === rightNumber) return 0;
    return leftNumber < rightNumber ? -1 : 1;
  }
}

function byChrono(a, b) {
  const leftTime = stablePart(a.time);
  const rightTime = stablePart(b.time);
  if (leftTime !== rightTime) return leftTime < rightTime ? -1 : 1;
  const leftOrder = Number(a.sourceOrder);
  const rightOrder = Number(b.sourceOrder);
  if (Number.isFinite(leftOrder) && Number.isFinite(rightOrder) && leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }
  return numericIdCompare(a.id, b.id);
}

export function sortGenshinHistory(pulls) {
  return (Array.isArray(pulls) ? pulls : []).slice().sort(byChrono);
}

function collapseLegacyCrossSourceDuplicates(pulls) {
  const groups = new Map();
  pulls.forEach((pull, index) => {
    const key = signature(pull);
    const group = groups.get(key) || { fileRows: [], liveRows: [] };
    (pull.id ? group.liveRows : group.fileRows).push(index);
    groups.set(key, group);
  });

  const remove = new Set();
  for (const group of groups.values()) {
    // Versions before this reconciler could store both the id-less spreadsheet row
    // and the live row with an id. Only heal when every blank has a live counterpart;
    // an incomplete live window must not erase a genuine repeated pull.
    if (group.liveRows.length < group.fileRows.length) continue;
    for (const index of group.fileRows) remove.add(index);
  }
  return remove.size ? pulls.filter((_, index) => !remove.has(index)) : pulls;
}

export function mergeGenshinHistory(storedAsc, incomingAsc) {
  const stored = (Array.isArray(storedAsc) ? storedAsc : []).map((pull) => ({ ...pull }));
  const list = collapseLegacyCrossSourceDuplicates(stored);
  const incoming = Array.isArray(incomingAsc) ? incomingAsc : [];
  const available = new Map();

  list.forEach((pull, index) => {
    const key = signature(pull);
    const indices = available.get(key) || [];
    indices.push(index);
    available.set(key, indices);
  });

  const consumed = new Map();
  let added = 0;

  for (const pull of incoming) {
    const key = signature(pull);
    const used = consumed.get(key) || 0;
    const matches = available.get(key) || [];

    if (used < matches.length) {
      const index = matches[used];
      const stored = list[index];
      list[index] = {
        ...stored,
        id: stored.id || pull.id || '',
        // File imports cannot distinguish Character Event 301 from 400. The live
        // value is authoritative and makes known-id pagination work next time.
        gachaType: pull.gachaType || stored.gachaType || '',
        itemType: stored.itemType || pull.itemType || '',
      };
      consumed.set(key, used + 1);
      continue;
    }

    list.push({ ...pull });
    consumed.set(key, used + 1);
    added++;
  }

  return { list: sortGenshinHistory(list), added };
}
