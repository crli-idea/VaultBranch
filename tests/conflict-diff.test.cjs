"use strict";

const { test } = require("node:test"), assert = require("node:assert/strict");
const { EditorState } = require("@codemirror/state");
const { Chunk } = require("@codemirror/merge");
const { conflictDiff, conflictDiffConfig } = require("../src/conflict-diff.js");
const { resolution, prepareResolution, chooseResolution } = require("../src/conflict-document.js");

const rows = label => Array.from({ length: 10 }, (_, n) => `${label} · 第 ${n + 1} 行\n`).join("");
const separator = n => `\n公共分隔 ${n}：以下内容保持不变。\n公共分隔 ${n}：用来隔开相邻冲突。\n公共分隔 ${n}：本地与对方完全相同。\n公共分隔 ${n}：不会被采用按钮替换。\n公共分隔 ${n}：可以继续向下查看。\n\n`;
const doc = text => EditorState.create({ doc: text }).doc;
const heads = ["双方修改同一段（各十行）", "双方在同一位置新增（各十行）", "本地删除段落，对方修改（十行）", "本地修改段落，对方删除（十行）"];
const fixture = chunks => "# 同一文件 · 四处真实冲突\n\n每处涉及十行；删除侧为空。文件留给你手动操作，不自动解决。\n\n"
  + chunks.map((text, n) => `## ${n + 1}. ${heads[n]}\n\n${text}${separator(n + 1)}`).join("") + "文件结束。\n";

test("opposite deletions keep their unchanged paragraph outside both highlighted chunks", () => {
  const a = doc(fixture([rows("对方修改"), rows("对方新增"), rows("对方修改段落三"), ""]));
  const b = doc(fixture([rows("本地修改"), rows("本地新增"), "", rows("本地修改段落四")]));
  const chunks = Chunk.build(a, b, conflictDiffConfig);
  assert.equal(chunks.length, 4);
  for (const chunk of chunks) {
    assert(!a.sliceString(chunk.fromA, chunk.endA).includes("公共分隔"));
    assert(!b.sliceString(chunk.fromB, chunk.endB).includes("公共分隔"));
  }
  assert.equal(chunks[2].fromB, chunks[2].toB);
  assert.equal(chunks[3].fromA, chunks[3].toA);
});

function assertUnchangedContext(a, b, chunks) {
  for (const chunk of chunks) for (const [text, from, to] of [[a, chunk.fromA, chunk.endA], [b, chunk.fromB, chunk.endB]]) {
    assert(!text.sliceString(from, to).includes("公共分隔"), "unchanged paragraphs must not be highlighted");
    assert(!text.sliceString(from, to).includes("## "), "unchanged section headings must not be highlighted");
  }
}

test("incremental native chunks retain the separators after side choices, edits and order changes", () => {
  const local = [rows("本地修改"), rows("本地新增"), "", rows("本地修改段落四")];
  const other = [rows("对方修改"), rows("对方新增"), rows("对方修改段落三"), ""];
  const marked = fixture(local.map((text, n) => `<<<<<<< HEAD\n${text}=======\n${other[n]}>>>>>>> incoming\n`));
  const prepared = prepareResolution({ result: marked }), a = doc(fixture(other));
  let state = EditorState.create({ doc: prepared.doc, extensions: resolution.init(() => prepared.blocks) });
  let chunks = Chunk.build(a, state.doc, conflictDiffConfig);
  for (const localFirst of [false, true]) for (const id of [2, 3, 0, 1]) for (const choice of ["other", "local", "both", "other", "local"]) {
    const tr = state.update(chooseResolution(state, id, choice, localFirst));
    state = tr.state; chunks = Chunk.updateB(chunks, a, state.doc, tr.changes, conflictDiffConfig);
    assertUnchangedContext(a, state.doc, chunks);
    const fresh = Chunk.build(a, state.doc, conflictDiffConfig);
    assert.deepEqual(chunks.map(c => [c.fromA, c.toA, c.fromB, c.toB]), fresh.map(c => [c.fromA, c.toA, c.fromB, c.toB]));
  }
  const block = state.field(resolution)[2];
  const tr = state.update({ changes: { from: block.from, insert: "manual paragraph\n" } });
  chunks = Chunk.updateB(chunks, a, tr.state.doc, tr.changes, conflictDiffConfig);
  assertUnchangedContext(a, tr.state.doc, chunks);
});

test("character highlights remain narrow inside modified lines", () => {
  const a = "before\nvalue = 1;\nafter\n", b = "before\nvalue = 2;\nafter\n";
  const changes = conflictDiff(a, b);
  assert.equal(changes.length, 1);
  assert.equal(a.slice(changes[0].fromA, changes[0].toA), "1");
  assert.equal(b.slice(changes[0].fromB, changes[0].toB), "2");
});

test("line tokens preserve empty text, final newlines, CRLF, BOM and Unicode boundaries", () => {
  const cases = [["", "new\n"], ["old\n", ""], ["a", "a\n"], ["a\n", "a"], ["same\n", "same\n"],
    ["\ufeff标题\r\n😀 原内容\r\n\r\n结尾", "\ufeff标题\r\n🧪 新内容\r\n\r\n结尾\r\n"]];
  const many = Array.from({ length: 3000 }, (_, n) => `unique ${n}\n`);
  cases.push([many.join(""), many.slice(0, 1024).join("") + "inserted 🧪\n" + many.slice(1024, 2048).join("") + many.slice(2049).join("")]);
  for (const count of [56000, 64000]) {
    const lines = Array.from({ length: count }, (_, n) => `unique ${n}\n`);
    cases.push(["start A\n" + lines.join("") + "end A\n", "start B\n" + lines.join("") + "end B\n"]);
  }
  for (const [a, b] of cases) {
    const changes = conflictDiff(a, b);
    let rebuilt = "", fromA = 0, fromB = 0;
    for (const change of changes) {
      assert(Number.isInteger(change.fromA) && Number.isInteger(change.toA) && Number.isInteger(change.fromB) && Number.isInteger(change.toB));
      assert(change.fromA >= fromA && change.fromB >= fromB);
      assert.equal(a.slice(fromA, change.fromA), b.slice(fromB, change.fromB));
      rebuilt += a.slice(fromA, change.fromA) + b.slice(change.fromB, change.toB);
      fromA = change.toA; fromB = change.toB;
    }
    assert.equal(a.slice(fromA), b.slice(fromB));
    assert.equal(rebuilt + a.slice(fromA), b);
  }
});
