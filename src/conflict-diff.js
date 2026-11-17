"use strict";

const { Change, diff } = require("@codemirror/merge");

const limits = { scanLimit: 500 };

// Anchor identical whole lines before comparing characters. Otherwise similar
// deleted/inserted paragraphs can displace the unchanged context between them.
function conflictDiff(a, b) {
  if (a === b) return [];
  const initial = diff(a, b, limits);
  if (!initial.length) return initial;
  const first = initial[0], last = initial[initial.length - 1];
  const startA = first.fromA ? a.lastIndexOf("\n", first.fromA - 1) + 1 : 0;
  const startB = first.fromB ? b.lastIndexOf("\n", first.fromB - 1) + 1 : 0;
  const lineEnd = (text, pos) => {
    if (!pos || text[pos - 1] === "\n") return pos;
    const newline = text.indexOf("\n", pos); return newline < 0 ? text.length : newline + 1;
  };
  // Keep large equal prefixes/suffixes out of the line table.
  const endA = lineEnd(a, last.toA), endB = lineEnd(b, last.toB);
  const ids = new Map();
  function encode(text) {
    const tokens = [], offsets = [0];
    for (let from = 0; from < text.length;) {
      const newline = text.indexOf("\n", from), to = newline < 0 ? text.length : newline + 1;
      const line = text.slice(from, to);
      let id = ids.get(line);
      if (id === undefined) { id = ids.size; ids.set(line, id); }
      if (id >= 0xf800) return null;
      // One UTF-16 unit per line, skipping surrogate code units.
      tokens.push(String.fromCharCode(id < 0xd800 ? id : id + 0x800)); offsets.push(to); from = to;
    }
    return { text: tokens.join(""), offsets };
  }
  const linesA = encode(a.slice(startA, endA)), linesB = encode(b.slice(startB, endB));
  if (!linesA || !linesB) return initial;
  const changes = [];
  for (const block of diff(linesA.text, linesB.text, limits)) {
    const fromA = startA + linesA.offsets[block.fromA], toA = startA + linesA.offsets[block.toA];
    const fromB = startB + linesB.offsets[block.fromB], toB = startB + linesB.offsets[block.toB];
    for (const change of diff(a.slice(fromA, toA), b.slice(fromB, toB), limits)) {
      changes.push(new Change(fromA + change.fromA, fromA + change.toA, fromB + change.fromB, fromB + change.toB));
    }
  }
  return changes;
}

const conflictDiffConfig = { override: conflictDiff };
module.exports = { conflictDiff, conflictDiffConfig };
