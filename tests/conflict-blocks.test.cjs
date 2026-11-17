"use strict";
const { test } = require("node:test"), assert = require("node:assert/strict");
const { EditorState, StateField, Text } = require("@codemirror/state");
const { conflictBlocks, updateConflictBlocks, conflictChoice } = require("../src/conflict-blocks.js");
const field = StateField.define({ create: state => conflictBlocks(state.doc), update: updateConflictBlocks });
const block = (a = "local\n", b = "remote\n", base = "") => `<<<<<<< HEAD\n${a}${base ? "||||||| base\n" + base : ""}=======\n${b}>>>>>>> side\n`;
const state = text => EditorState.create({ doc: text, extensions: [field] });

test("conflict choices replace one block and preserve all surrounding automatic merges", () => {
  const s = state("prefix\n" + block() + "middle\n" + block("a\n", "b\n") + "suffix\n");
  const parsed = s.field(field); assert.equal(parsed.blocks.length, 2); assert.equal(parsed.invalid, false);
  for (const [choice, expected] of [["ours", "local\n"], ["theirs", "remote\n"], ["both", "local\nremote\n"]]) {
    const first = parsed.blocks[0];
    const next = s.update({ changes: { from: first.from, to: first.to, insert: conflictChoice(s.doc, first, choice) } }).state;
    assert.equal(next.doc.toString(), "prefix\n" + expected + "middle\n" + block("a\n", "b\n") + "suffix\n");
    assert.equal(next.field(field).blocks.length, 1);
  }
});
test("diff3/zdiff3-style ancestor contents are excluded from choices", () => {
  const s = state(block("a\n", "b\n", "ancestor\n")), first = s.field(field).blocks[0];
  assert.equal(s.doc.sliceString(first.baseFrom, first.baseTo), "ancestor\n");
  assert.equal(conflictChoice(s.doc, first, "both"), "a\nb\n");
});
test("custom marker sizes, empty sides and end-of-file markers are recognized", () => {
  const s = state(block("", "b\n").replace(/[<=>]{7}/g, m => m + m).trimEnd()), parsed = s.field(field);
  assert.equal(parsed.invalid, false); assert.equal(parsed.blocks.length, 1);
  assert.equal(conflictChoice(s.doc, parsed.blocks[0], "ours"), "");
});
test("incomplete, nested, mismatched and stray markers cannot silently become resolved", () => {
  for (const text of ["<<<<<<< HEAD\na\n", "=======\n", block().replace("=======", "========"), block().replace("local", "<<<<<<< nested\nlocal"), block().replace("remote", "||||||| stray\nremote")]) {
    const parsed = state(text).field(field); assert.equal(parsed.invalid, true); assert.ok(parsed.markers.length);
  }
});
test("ordinary edits map remaining blocks without re-reading the entire document", () => {
  const s = state("top\n" + block() + "bottom\n");
  const next = s.update({ changes: { from: 1, insert: "before\n" } }).state;
  assert.deepEqual(next.field(field), conflictBlocks(next.doc));
  const at = next.doc.length;
  const last = next.update({ changes: { from: at, insert: "tail\n" } }).state;
  assert.deepEqual(last.field(field), conflictBlocks(last.doc));
});
test("manual edits inside a conflict update the candidate; newly typed markers are found", () => {
  let s = state(block());
  const at = s.field(field).blocks[0].oursFrom;
  s = s.update({ changes: { from: at, insert: "manual\n" } }).state;
  assert.equal(conflictChoice(s.doc, s.field(field).blocks[0], "ours"), "manual\nlocal\n");
  s = state("plain\n"); s = s.update({ changes: { from: 0, insert: block() } }).state;
  assert.equal(s.field(field).blocks.length, 1);
});
test("CRLF file output and BOM survive a chunk choice", () => {
  const original = ("\ufeffintro\n" + block() + "tail\n").replace(/\n/g, "\r\n");
  const s = EditorState.create({ doc: original, extensions: [field, EditorState.lineSeparator.of("\r\n")] });
  const first = s.field(field).blocks[0];
  const next = s.update({ changes: { from: first.from, to: first.to, insert: Text.of(conflictChoice(s.doc, first, "both").split("\n")) } }).state;
  assert.equal(next.sliceDoc(), "\ufeffintro\r\nlocal\r\nremote\r\ntail\r\n");
});
