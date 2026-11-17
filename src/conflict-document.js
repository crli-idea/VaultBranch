"use strict";

const { EditorState, StateField, StateEffect, ChangeSet, Text } = require("@codemirror/state");
const { invertedEffects } = require("@codemirror/commands");
const { conflictBlocks, conflictChoice } = require("./conflict-blocks.js");

const resolutionEffect = StateEffect.define();
const resolution = StateField.define({
  create: () => [],
  update(blocks, tr) {
    const explicit = tr.effects.find(effect => effect.is(resolutionEffect));
    if (explicit) return explicit.value;
    if (!tr.docChanged) return blocks;
    return blocks.map(block => {
      let touched = false, crossed = block.crossed;
      tr.changes.iterChangedRanges((from, to) => {
        if (from <= block.to && to >= block.from) {
          touched = true; crossed ||= from < block.from || to > block.to;
        }
      });
      const from = tr.changes.mapPos(block.from, -1), to = tr.changes.mapPos(block.to, 1);
      return { ...block, from, to,
        ...(touched ? { handled: false, choice: "manual", local: tr.newDoc.sliceString(from, to), crossed } : {}) };
    });
  },
});
const resolutionHistory = invertedEffects.of(tr => tr.docChanged || tr.effects.some(effect => effect.is(resolutionEffect))
  ? [resolutionEffect.of(tr.startState.field(resolution))] : []);

function prepareResolution(versions) {
  const doc = EditorState.create({ doc: versions.result }).doc, parsed = conflictBlocks(doc);
  if (parsed.invalid) return { doc, blocks: [] };
  const local = versions.operation === "rebase" ? "theirs" : "ours", other = local === "ours" ? "theirs" : "ours";
  const inserts = parsed.blocks.map(block => Text.of(conflictChoice(doc, block, local).split("\n")));
  const changes = ChangeSet.of(parsed.blocks.map((block, index) => ({ from: block.from, to: block.to, insert: inserts[index] })), doc.length);
  let offset = 0;
  return { doc: changes.apply(doc), blocks: parsed.blocks.map((block, index) => {
    const from = block.from + offset;
    offset += inserts[index].length - (block.to - block.from);
    return { id: index, from, to: from + inserts[index].length, local: inserts[index].toString(),
      other: conflictChoice(doc, block, other), handled: false, choice: "local" };
  }) };
}

function combineConflictText(left, right) {
  const a = left.split("\n"), b = right.split("\n");
  let prefix = 0, suffix = 0;
  while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) prefix++;
  while (suffix < a.length - prefix && suffix < b.length - prefix && a[a.length - suffix - 1] === b[b.length - suffix - 1]) suffix++;
  return [...a.slice(0, prefix), ...a.slice(prefix, a.length - suffix), ...b.slice(prefix, b.length - suffix), ...a.slice(a.length - suffix)].join("\n");
}

function chooseResolution(state, id, choice, localFirst) {
  const blocks = state.field(resolution), index = blocks.findIndex(item => item.id === id), block = blocks[index];
  if (!block || block.crossed && choice !== "local") return null;
  let text = block.local ?? state.doc.sliceString(block.from, block.to);
  if (choice === "other") text = block.other;
  if (choice === "both") {
    text = combineConflictText(...(localFirst ? [text, block.other] : [block.other, text]));
  }
  const insert = Text.of(text.split("\n"));
  const changes = ChangeSet.of({ from: block.from, to: block.to, insert }, state.doc.length);
  const next = blocks.map((item, position) => item.id === id
    ? { ...item, from: changes.mapPos(block.from, -1), to: changes.mapPos(block.from, -1) + insert.length, handled: true, choice }
    : { ...item, from: changes.mapPos(item.from, position < index ? -1 : 1), to: changes.mapPos(item.to, position < index ? -1 : 1) });
  return { changes, effects: resolutionEffect.of(next), selection: { anchor: next.find(item => item.id === id).from } };
}

function resolutionDirty(state, initialDoc) {
  return !state.doc.eq(initialDoc) || state.field(resolution).some(block => block.handled || block.choice === "manual");
}

function validResolutionBlocks(blocks, length) {
  return Array.isArray(blocks) && blocks.every(block => Number.isSafeInteger(block.id) && Number.isSafeInteger(block.from)
    && Number.isSafeInteger(block.to) && block.from >= 0 && block.to >= block.from && block.to <= length && typeof block.other === "string"
    && typeof block.handled === "boolean" && ["local", "other", "both", "manual"].includes(block.choice)
    && (block.local === undefined || typeof block.local === "string")
    && (block.bothBase === undefined || typeof block.bothBase === "string")) && new Set(blocks.map(block => block.id)).size === blocks.length;
}

module.exports = { resolution, resolutionEffect, resolutionHistory, prepareResolution, chooseResolution, resolutionDirty, validResolutionBlocks, combineConflictText };
