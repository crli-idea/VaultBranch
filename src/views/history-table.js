"use strict";

const { Notice } = require("obsidian");
const { t } = require("../i18n.js");
const { el } = require("./shared.js");

const MIN_WIDTHS = [160, 96, 64, 80];
const MAX_WIDTHS = [2400, 320, 640, 640];

function historyDate(value, withTime = false) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const pad = number => String(number).padStart(2, "0");
  const day = `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())}`;
  return withTime ? `${day} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` : day;
}

function columnWidths(value) {
  if (!Array.isArray(value) || value.length !== 4 || value.some(width => typeof width !== "number" || !Number.isFinite(width))) return null;
  return value.map((width, index) => Math.round(Math.max(MIN_WIDTHS[index], Math.min(MAX_WIDTHS[index], width))));
}

function resizeColumn(widths, index, delta) {
  const result = widths.slice();
  const min = Math.max(MIN_WIDTHS[index] - widths[index], index < 3 ? widths[index + 1] - MAX_WIDTHS[index + 1] : -Infinity);
  const max = Math.min(MAX_WIDTHS[index] - widths[index], index < 3 ? widths[index + 1] - MIN_WIDTHS[index + 1] : Infinity);
  const change = Math.round(Math.max(min, Math.min(max, delta)));
  result[index] += change;
  if (index < 3) result[index + 1] -= change;
  return result;
}

function applyColumnWidths(body, value) {
  const widths = columnWidths(value);
  if (!widths) {
    body.style.removeProperty("--vaultbranch-history-template");
    body.style.removeProperty("--vaultbranch-history-min-width");
    return;
  }
  body.style.setProperty("--vaultbranch-history-template", `var(--vaultbranch-graph-width, 70px) ${widths.map(width => `${width}px`).join(" ")}`);
  body.style.setProperty("--vaultbranch-history-min-width", `calc(var(--vaultbranch-graph-width, 70px) + ${widths.reduce((sum, width) => sum + width, 52)}px)`);
}

function addColumnResizers(body, headings, plugin) {
  const cells = [...headings.children].slice(1);
  const measure = () => columnWidths(cells.map(cell => cell.getBoundingClientRect().width));
  const save = async widths => {
    try { await plugin.updateSetting("historyColumnWidths", widths); }
    catch (error) { new Notice(error.message); }
    finally { applyColumnWidths(body, plugin.settings.historyColumnWidths); }
  };
  applyColumnWidths(body, plugin.settings.historyColumnWidths);
  cells.forEach((cell, index) => {
    const handle = el(cell, "span", "vaultbranch-column-resizer");
    handle.tabIndex = 0;
    handle.setAttribute("role", "separator");
    handle.setAttribute("aria-orientation", "vertical");
    handle.setAttribute("aria-label", t`调整${cell.textContent}列宽`);
    handle.setAttribute("aria-description", t("拖动或用方向键调整；双击恢复默认列宽。"));
    handle.setAttribute("aria-valuemin", String(MIN_WIDTHS[index]));
    handle.setAttribute("aria-valuemax", String(MAX_WIDTHS[index]));
    let drag;
    const apply = widths => { applyColumnWidths(body, widths); handle.setAttribute("aria-valuenow", String(widths[index])); };
    const cancel = () => { drag = null; body.classList.remove("is-resizing"); applyColumnWidths(body, plugin.settings.historyColumnWidths); };
    handle.addEventListener("pointerdown", event => {
      if (event.button !== 0 || plugin.busy) return;
      event.preventDefault(); event.stopPropagation();
      drag = { id: event.pointerId, x: event.clientX, widths: measure() };
      drag.next = drag.widths;
      handle.setPointerCapture(event.pointerId); body.classList.add("is-resizing");
    });
    handle.addEventListener("pointermove", event => {
      if (!drag || drag.id !== event.pointerId) return;
      drag.next = resizeColumn(drag.widths, index, event.clientX - drag.x); apply(drag.next);
    });
    handle.addEventListener("pointerup", event => {
      if (!drag || drag.id !== event.pointerId) return;
      const { widths, next } = drag;
      drag = null; body.classList.remove("is-resizing"); handle.releasePointerCapture(event.pointerId);
      if (next.some((width, i) => width !== widths[i])) void save(next);
    });
    handle.addEventListener("pointercancel", cancel);
    handle.addEventListener("lostpointercapture", () => { if (drag) cancel(); });
    handle.addEventListener("dblclick", event => { event.preventDefault(); if (!plugin.busy) void save(null); });
    handle.addEventListener("keydown", event => {
      if (plugin.busy || !["ArrowLeft", "ArrowRight", "Home"].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation();
      if (event.key === "Home") { void save(null); return; }
      const widths = resizeColumn(measure(), index, (event.key === "ArrowLeft" ? -1 : 1) * (event.shiftKey ? 20 : 5));
      apply(widths); void save(widths);
    });
  });
}

function addCommitCopy(row, commit) {
  const cell = el(row, "span", "vaultbranch-history-commit");
  cell.setAttribute("role", "gridcell");
  const control = el(cell, "button", "vaultbranch-history-hash", commit.short);
  control.type = "button";
  control.title = ""; // Suppress the parent row's native tooltip on this control.
  control.setAttribute("aria-label", t("复制完整提交哈希"));
  control.addEventListener("click", async event => {
    event.stopPropagation();
    try { await navigator.clipboard.writeText(commit.hash); new Notice(t("已复制完整提交哈希")); }
    catch (error) { new Notice(error.message); }
  });
}

module.exports = { historyDate, columnWidths, resizeColumn, applyColumnWidths, addColumnResizers, addCommitCopy };
