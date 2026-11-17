"use strict";
const { test } = require("node:test"), assert = require("node:assert/strict");
const { EditorState } = require("@codemirror/state");
const { history, undo, redo, isolateHistory } = require("@codemirror/commands");
const { resolution, resolutionEffect, resolutionHistory, prepareResolution, chooseResolution, combineConflictText, resolutionDirty, validResolutionBlocks } = require("../src/conflict-document.js");
const block = (a = "local\n", b = "incoming\n") => `<<<<<<< HEAD\n${a}||||||| base\nancestor\n=======\n${b}>>>>>>> side\n`;
function editor(result, operation = "merge") {
  const prepared = prepareResolution({ result, operation });
  let state = EditorState.create({ doc: prepared.doc, extensions: [history(), resolution.init(() => prepared.blocks), resolutionHistory] });
  return { get state() { return state; }, dispatch(tr) { state = tr.state || state.update(tr).state; }, prepared };
}
const choose = (e, id, choice, first = false) => e.dispatch({ ...chooseResolution(e.state, id, choice, first), annotations: isolateHistory.of("full") });

test("editable local result preserves both automatic merges and tracks unresolved blocks without markers", () => {
  const e = editor("auto local\n" + block() + "auto incoming\n" + block("x\n", "y\n") + "tail\n");
  assert.equal(e.state.doc.toString(), "auto local\nlocal\nauto incoming\nx\ntail\n");
  assert.equal(e.state.field(resolution).filter(b => !b.handled).length, 2);
  assert.equal(resolutionDirty(e.state, e.prepared.doc), false);
  choose(e, 0, "local"); assert.equal(resolutionDirty(e.state, e.prepared.doc), true);
  assert.equal(e.state.doc.eq(e.prepared.doc), true);
});
test("rebase seeds the local replayed side and compares it with upstream", () => {
  const e = editor(block("upstream\n", "replayed local\n"), "rebase");
  assert.equal(e.state.doc.toString(), "replayed local\n");
  assert.equal(e.state.field(resolution)[0].other, "upstream\n");
});
test("adjacent conflicts, empty local chunks, BOM on a marker and CRLF preserve correct anchors", () => {
  const e = editor("\ufeff" + block("", "first\n") + block("second\n", "other\n"));
  const chunks = e.state.field(resolution);
  assert.equal(chunks[0].from, 1); assert.equal(chunks[0].to, 1);
  assert.equal(e.state.doc.sliceString(chunks[1].from, chunks[1].to), "second\n");
  choose(e, 0, "other"); choose(e, 1, "other");
  assert.equal(e.state.doc.toString(), "\ufefffirst\nother\n");
  const p = prepareResolution({ result: ("\ufeff" + block()).replace(/\n/g, "\r\n") });
  const s = EditorState.create({ doc: p.doc, extensions: EditorState.lineSeparator.of("\r\n") });
  assert.equal(s.sliceDoc(), "\ufefflocal\r\n");
});
test("choosing other changes one region; native undo/redo restore content and flags together", () => {
  const e = editor("prefix\n" + block() + "middle\n" + block());
  choose(e, 0, "other");
  assert.equal(e.state.doc.toString(), "prefix\nincoming\nmiddle\nlocal\n");
  assert.equal(e.state.field(resolution)[1].handled, false);
  undo(e); assert.equal(e.state.doc.eq(e.prepared.doc), true); assert.equal(e.state.field(resolution)[0].handled, false);
  redo(e); assert.equal(e.state.field(resolution)[0].handled, true);
});
test("state-only marking is undoable even when accepting local changes no text", () => {
  const e = editor(block()); choose(e, 0, "local");
  assert.equal(e.state.field(resolution)[0].handled, true);
  undo(e); assert.equal(e.state.field(resolution)[0].handled, false);
  redo(e); assert.equal(e.state.field(resolution)[0].handled, true);
});
test("both preserves common headings once, follows displayed order and is repeatable", () => {
  const local = "## 发布安排\n\n每周五发布。\n", incoming = "## 发布安排\n\n测试后发布。\n";
  const e = editor(block(local, incoming));
  choose(e, 0, "both"); assert.equal(e.state.doc.toString(), "## 发布安排\n\n测试后发布。\n每周五发布。\n");
  choose(e, 0, "both"); assert.equal((e.state.doc.toString().match(/每周五发布/g) || []).length, 1);
  choose(e, 0, "both", true); assert.equal(e.state.doc.toString(), "## 发布安排\n\n每周五发布。\n测试后发布。\n");
  assert.equal(combineConflictText("same\n", "same\n"), "same\n");
  assert.equal((combineConflictText("H\na\nrepeat\na\n", "H\nb\nrepeat\nb\n").match(/repeat/g) || []).length, 2);
});

test("every sequence of side choices restores candidates independently of previous choices", () => {
  const cases = [
    ["local one\nlocal two\n", "incoming one\nincoming two\n", "incoming one\nincoming two\nlocal one\nlocal two\n", "local one\nlocal two\nincoming one\nincoming two\n"],
    ["", "incoming insertion\n", "incoming insertion\n", "incoming insertion\n"],
    ["local insertion\n", "", "local insertion\n", "local insertion\n"],
    ["## Heading\n\nlocal\n", "## Heading\n\nincoming\n", "## Heading\n\nincoming\nlocal\n", "## Heading\n\nlocal\nincoming\n"],
  ];
  const choices = ["local", "other", "both"];
  for (const [local, other, otherFirstBoth, localFirstBoth] of cases) for (const operation of ["merge", "rebase"]) for (const first of [false, true]) {
    for (const a of choices) for (const b of choices) for (const c of choices) {
      const e = editor("before\n" + (operation === "rebase" ? block(other, local) : block(local, other)) + "after\n", operation);
      const expected = { local, other, both: first ? localFirstBoth : otherFirstBoth };
      for (const choice of [a, b, c]) {
        choose(e, 0, choice, first);
        assert.equal(e.state.doc.toString(), "before\n" + expected[choice] + "after\n", `${operation} order=${first} ${a}/${b}/${c}: ${choice}`);
        assert.equal(e.state.field(resolution)[0].handled, true);
      }
      undo(e); assert.equal(e.state.doc.toString(), "before\n" + expected[b] + "after\n");
      redo(e); assert.equal(e.state.doc.toString(), "before\n" + expected[c] + "after\n");
    }
  }
});

test("manual local drafts survive adopting the other side and returning to local or both", () => {
  const e = editor("before\n" + block() + "after\n");
  const from = e.state.field(resolution)[0].from;
  e.dispatch({ changes: { from, insert: "edited " } });
  choose(e, 0, "other"); choose(e, 0, "local");
  assert.equal(e.state.doc.toString(), "before\nedited local\nafter\n");
  choose(e, 0, "other"); choose(e, 0, "both");
  assert.equal(e.state.doc.toString(), "before\nincoming\nedited local\nafter\n");
});

test("choices in one block never absorb adjacent or empty conflict regions", () => {
  const candidates = [["local\n", "other\n"], ["", "added\n"], ["deleted\n", ""], ["", ""]];
  for (const first of candidates) for (const second of candidates) for (const index of [0, 1]) {
    const e = editor("before\n" + block(...first) + block(...second) + "after\n");
    const expected = [first[0], second[0]];
    for (const id of [index, 1 - index, index]) for (const choice of ["other", "both", "local"]) {
      choose(e, id, choice);
      const [local, other] = [first, second][id];
      expected[id] = choice === "local" ? local : choice === "other" ? other : other + local;
      assert.equal(e.state.doc.toString(), "before\n" + expected.join("") + "after\n");
      for (const b of e.state.field(resolution)) {
        assert(b.from <= b.to);
        assert.equal(e.state.doc.sliceString(b.from, b.to), expected[b.id]);
      }
    }
  }
});
test("manual edits reopen touched conflicts; crossing boundaries blocks destructive replacements", () => {
  const e = editor("prefix\n" + block() + "tail\n"); choose(e, 0, "local");
  e.dispatch({ changes: { from: e.state.field(resolution)[0].from, insert: "manual " } });
  assert.equal(e.state.field(resolution)[0].handled, false);
  choose(e, 0, "local"); assert.match(e.state.doc.toString(), /manual local/);
  e.dispatch({ changes: { from: 0, to: e.state.doc.length, insert: "manually rebuilt\n" } });
  assert.equal(chooseResolution(e.state, 0, "other", false), null);
  choose(e, 0, "local"); assert.equal(e.state.doc.toString(), "manually rebuilt\n");
  assert.equal(e.state.field(resolution)[0].handled, true);
});
test("invalid marker input remains visible for manual repair, with no fabricated candidates", () => {
  const result = "<<<<<<< HEAD\nunclosed\n", prepared = prepareResolution({ result });
  assert.equal(prepared.doc.toString(), result); assert.equal(prepared.blocks.length, 0);
});
test("serialized resolution anchors and flags validate after JSON round-trip", () => {
  const e = editor(block()); choose(e, 0, "both");
  const blocks = JSON.parse(JSON.stringify(e.state.field(resolution)));
  assert.equal(validResolutionBlocks(blocks, e.state.doc.length), true);
  blocks[0].to = e.state.doc.length + 1; assert.equal(validResolutionBlocks(blocks, e.state.doc.length), false);
  assert.equal(resolutionEffect.of([]).value.length, 0);
});
