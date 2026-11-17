"use strict";

// Positions use CodeMirror's document offsets. Git I/O stays in git-conflicts.js.
function conflictBlocks(doc) {
  const blocks = [], markers = [];
  let open, invalid = false, from = 0;
  for (const text of doc.iterLines()) {
    const end = from + text.length, to = Math.min(doc.length, end + 1);
    const bom = from === 0 && text.startsWith("\ufeff") ? 1 : 0, line = text.slice(bom);
    const marker = /^[<|=>]/.test(line) && line.match(/^([<|=>])\1{6,}(?:[ \t].*)?$/);
    if (marker) {
      const kind = marker[1], width = line.match(/^[<|=>]+/)[0].length, markerFrom = from + bom;
      markers.push({ from: markerFrom, to: end });
      if (kind === "<" && !open) open = { from: markerFrom, width, oursFrom: to };
      else if (open && width === open.width && kind === "|" && open.oursTo === undefined) {
        open.oursTo = from; open.baseFrom = to;
      } else if (open && width === open.width && kind === "=" && open.theirsFrom === undefined) {
        if (open.baseFrom !== undefined) open.baseTo = from;
        else open.oursTo = from;
        open.theirsFrom = to;
      } else if (open && width === open.width && kind === ">" && open.theirsFrom !== undefined) {
        blocks.push({ ...open, theirsTo: from, to }); open = null;
      } else invalid = true;
    }
    from = to;
  }
  return { blocks, markers, invalid: invalid || Boolean(open) };
}

function updateConflictBlocks(value, transaction) {
  if (!transaction.docChanged) return value;
  let rescan = value.invalid;
  transaction.changes.iterChangedRanges((fromA, toA, fromB, toB) => {
    const before = transaction.startState.doc, after = transaction.state.doc;
    // Rescan only if conflict contents/markers change or new markers may appear.
    rescan ||= value.blocks.some(block => block.from <= toA && block.to >= fromA)
      || /^\ufeff?[<|=>]{7}/m.test(after.sliceString(after.lineAt(fromB).from, after.lineAt(toB).to))
      || /^\ufeff?[<|=>]{7}/m.test(before.sliceString(before.lineAt(fromA).from, before.lineAt(toA).to));
  });
  if (rescan) return conflictBlocks(transaction.state.doc);
  const map = range => Object.fromEntries(Object.entries(range).map(([key, position]) => [key,
    key.endsWith("From") || key === "from" ? transaction.changes.mapPos(position, 1)
      : key.endsWith("To") || key === "to" ? transaction.changes.mapPos(position, -1) : position]));
  return { blocks: value.blocks.map(map), markers: value.markers.map(map), invalid: false };
}

function conflictChoice(doc, block, choice) {
  const ours = doc.sliceString(block.oursFrom, block.oursTo);
  const theirs = doc.sliceString(block.theirsFrom, block.theirsTo);
  if (choice === "ours") return ours;
  if (choice === "theirs") return theirs;
  if (choice === "both") return ours + theirs;
  throw new Error("Unknown conflict choice");
}

module.exports = { conflictBlocks, updateConflictBlocks, conflictChoice };
