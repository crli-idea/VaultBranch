"use strict";

const { test } = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const moduleStub = { exports: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../src/views/history-table.js"), "utf8"), {
  module: moduleStub, require(name) {
    if (name === "obsidian") return { Notice: class {} };
    if (name === "../i18n.js") return require("../src/i18n.js");
    if (name === "./shared.js") return {};
    throw Error(name);
  },
});
const { historyDate, columnWidths, resizeColumn } = moduleStub.exports;

test("history dates use local calendar time with padded month, day and clock fields", () => {
  const date = new Date(2026, 0, 9, 4, 5, 6).toISOString();
  assert.equal(historyDate(date), "2026/01/09");
  assert.equal(historyDate(date, true), "2026/01/09 04:05:06");
  assert.equal(historyDate(new Date(2026, 10, 3, 12).toISOString()), "2026/11/03");
  assert.equal(historyDate("not a date"), "—");
});

test("saved column widths accept only bounded finite numeric values", () => {
  for (const value of [null, [], [1, 2, 3], [160, 100, 130, "80px"], [160, 100, 130, Infinity], [160, 100, 130, NaN]]) assert.equal(columnWidths(value), null);
  assert.deepEqual(Array.from(columnWidths([0, 120.5, -9, 9999])), [160, 121, 64, 640]);
});

test("resizing moves the neighboring boundary without shrinking either column below its limit", () => {
  const widths = [400, 140, 130, 100];
  const moved = resizeColumn(widths, 0, 50);
  assert.deepEqual(Array.from(moved), [444, 96, 130, 100]);
  assert.equal(moved.reduce((a, b) => a + b), widths.reduce((a, b) => a + b));
  assert.deepEqual(widths, [400, 140, 130, 100], "saved input is not mutated");
  assert.deepEqual(Array.from(resizeColumn(widths, 1, -10000)), [400, 96, 174, 100]);
  assert.deepEqual(Array.from(resizeColumn(widths, 3, 10000)), [400, 140, 130, 640]);
});
