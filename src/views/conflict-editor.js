"use strict";

const { EditorState, StateField, Compartment } = require("@codemirror/state");
const { EditorView, keymap, lineNumbers, drawSelection } = require("@codemirror/view");
const { history, historyField, historyKeymap, defaultKeymap, indentWithTab, isolateHistory } = require("@codemirror/commands");
const { MergeView } = require("@codemirror/merge");
const { conflictBlocks, updateConflictBlocks } = require("../conflict-blocks.js");
const { resolution, resolutionEffect, resolutionHistory, prepareResolution, chooseResolution, resolutionDirty, validResolutionBlocks } = require("../conflict-document.js");
const { conflictDiffConfig } = require("../conflict-diff.js");
const { t } = require("../i18n.js");
const { el, button } = require("./shared.js");

const markers = StateField.define({ create: state => conflictBlocks(state.doc), update: updateConflictBlocks });
const access = new Compartment(), listener = new Compartment(), appearance = new Compartment();

class ConflictEditor {
  constructor(view, body, header, currentVersions, draft) {
    this.view = view; this.versions = draft?.versions || currentVersions;
    const versions = this.versions;
    this.expected = draft?.expected ?? versions.result;
    this.expectedIndex = draft?.expectedIndex ?? versions.signature;
    this.index = 0; this.localFirst = view.plugin.settings.conflictLocalFirst === true;
    const toolbar = el(body, "div", "vaultbranch-conflict-toolbar");
    this.previous = button(toolbar, "arrow-up", t("上一处冲突"), () => this.navigate(-1));
    this.counter = el(toolbar, "span", "vaultbranch-conflict-counter"); this.counter.setAttribute("role", "status");
    this.next = button(toolbar, "arrow-down", t("下一处冲突"), () => this.navigate(1));
    this.left = button(toolbar, null, t("采用左侧"), () => this.choose(this.localFirst ? "local" : "other"), t("采用左侧"));
    this.right = button(toolbar, null, t("采用右侧"), () => this.choose(this.localFirst ? "other" : "local"), t("采用右侧"));
    this.both = button(toolbar, null, t("采用双方"), () => this.choose("both"), t("采用双方"));
    this.mark = button(toolbar, "check", t("标记已解决"), () => this.markResolved(), t("标记已解决"));
    this.reload = button(toolbar, "rotate-ccw", t("放弃草稿并重新载入"), () => view.reloadResolution());
    this.save = button(toolbar, "check-check", t("完成合并"), () => view.saveResolution(), t("完成合并"));
    this.save.classList.add("mod-cta"); this.save.dataset.action = "save-resolution";
    const heads = el(body, "div", "vaultbranch-conflict-heads");
    this.leftLabel = el(heads, "div", "vaultbranch-conflict-label");
    this.rightLabel = el(heads, "div", "vaultbranch-conflict-label");
    const parent = el(body, "div", "vaultbranch-conflict-merge");
    this.message = el(body, "div", "vaultbranch-conflict-message");
    const prepared = prepareResolution(versions), restored = draft?.serialized;
    const doc = draft?.state?.doc || (restored ? EditorState.create({ doc: restored.text }).doc : prepared.doc);
    const restoredBlocks = (draft?.state?.field(resolution) || (restored && validResolutionBlocks(restored.blocks, doc.length) ? restored.blocks : prepared.doc.eq(doc) ? prepared.blocks : []))
      .map(block => ({ ...block, local: block.local ?? block.bothBase ?? (["other", "both"].includes(block.choice)
        ? prepared.blocks.find(original => original.id === block.id)?.local : undefined) ?? doc.sliceString(block.from, block.to) }));
    const otherKey = versions.operation === "rebase" ? "ours" : "theirs";
    this.otherLabel = versions[otherKey + "Label"];
    const theme = () => appearance.of(EditorView.darkTheme.of(body.ownerDocument.body.classList.contains("theme-dark")));
    this.merge = new MergeView({ parent, root: body.ownerDocument,
      a: { doc: versions[otherKey] || "", extensions: [lineNumbers(), theme(), EditorState.readOnly.of(true), EditorView.editable.of(false)] },
      b: { doc, selection: draft?.state?.selection, extensions: [lineNumbers(), drawSelection(), history(),
        draft?.state ? historyField.init(() => draft.state.field(historyField)) : [],
        resolution.init(() => restoredBlocks), resolutionHistory, markers, theme(),
        EditorState.lineSeparator.of(versions.result.includes("\r\n") ? "\r\n" : "\n"), access.of([]), listener.of([]),
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab])],
      }, orientation: this.localFirst ? "b-a" : "a-b", highlightChanges: true, gutter: true, diffConfig: conflictDiffConfig,
    });
    this.result = this.merge.b; this.source = this.merge.a;
    this.result.dispatch({ effects: listener.reconfigure([
      keymap.of([{ key: "Mod-s", run: () => { void view.saveResolution(); return true; } }]),
      EditorView.updateListener.of(update => {
        if (update.docChanged || update.selectionSet || update.transactions.some(tr => tr.effects.some(effect => effect.is(resolutionEffect)))) this.update();
      }),
    ]) });
    this.result.contentDOM.setAttribute("aria-label", t("本地 · 合并结果"));
    this.source.contentDOM.setAttribute("aria-label", this.otherLabel);
    this.initialDoc = draft?.initialDoc || prepared.doc;
    this.themeEvent = view.app.workspace.on("css-change", () => this.updateTheme());
    this.update(); if (!draft) this.focusConflict();
  }

  update() {
    const blocks = this.result.state.field(resolution), cursor = this.result.state.selection.main.head;
    const at = blocks.findIndex(block => block.from <= cursor && cursor <= block.to);
    if (at >= 0) this.index = at;
    this.index = Math.min(this.index, Math.max(0, blocks.length - 1)); this.block = blocks[this.index];
    const markerState = this.result.state.field(markers), pending = blocks.filter(block => !block.handled).length;
    const blocked = this.locked || this.view.plugin.busy || this.view.plugin.mutationPending;
    const unavailableFile = this.versions.ours === null || this.versions.theirs === null;
    const unavailable = blocked || !this.block || markerState.markers.length || unavailableFile;
    this.counter.textContent = blocks.length ? t`冲突 ${this.index + 1} / ${blocks.length}` + (this.block.handled ? " · " + t("已解决") : "") : t("没有待处理的冲突块");
    this.previous.disabled = this.next.disabled = Boolean(blocked || blocks.length < 2);
    this.left.disabled = Boolean(unavailable || !this.localFirst && this.block.crossed);
    this.right.disabled = Boolean(unavailable || this.localFirst && this.block.crossed);
    this.both.disabled = Boolean(unavailable || this.block.crossed);
    this.mark.disabled = Boolean(unavailable);
    this.mark.lastElementChild.textContent = this.block?.handled ? t("标记未解决") : t("标记已解决");
    this.mark.title = this.block?.handled ? t("标记未解决") : t("标记已解决");
    this.left.title = t`采用${this.localFirst ? t("本地 · 合并结果") : this.otherLabel}`;
    this.right.title = t`采用${this.localFirst ? this.otherLabel : t("本地 · 合并结果")}`;
    this.left.setAttribute("aria-pressed", String(Boolean(this.block?.handled && this.block.choice === (this.localFirst ? "local" : "other"))));
    this.right.setAttribute("aria-pressed", String(Boolean(this.block?.handled && this.block.choice === (this.localFirst ? "other" : "local"))));
    this.both.setAttribute("aria-pressed", String(Boolean(this.block?.handled && this.block.choice === "both")));
    this.leftLabel.textContent = this.localFirst ? t("本地 · 合并结果") : this.otherLabel;
    this.rightLabel.textContent = this.localFirst ? this.otherLabel : t("本地 · 合并结果");
    this.resultLabel = this.localFirst ? this.leftLabel : this.rightLabel;
    this.message.textContent = unavailableFile ? t("此冲突涉及删除，请在外部 Git 工具中处理。")
      : markerState.markers.length ? t("冲突标记不完整，请在最终结果中修正后继续。")
        : this.block?.crossed ? t("已跨越冲突边界编辑，请确认本地结果后标记已解决。") : "";
    this.message.hidden = !this.message.textContent;
    this.save.disabled = Boolean(blocked || pending || markerState.markers.length || unavailableFile);
    this.reload.disabled = Boolean(blocked);
    this.view.app.workspace.requestSaveLayout();
  }

  updateOrder() {
    this.localFirst = this.view.plugin.settings.conflictLocalFirst === true;
    this.merge.reconfigure({ orientation: this.localFirst ? "b-a" : "a-b" }); this.update();
  }
  updateTheme() {
    const dark = this.result.dom.ownerDocument.body.classList.contains("theme-dark");
    for (const editor of [this.result, this.source]) if (editor.state.facet(EditorView.darkTheme) !== dark) {
      editor.dispatch({ effects: appearance.reconfigure(EditorView.darkTheme.of(dark)) });
    }
  }
  focusConflict() {
    if (this.block) this.result.dispatch({ selection: { anchor: this.block.from }, effects: EditorView.scrollIntoView(this.block.from, { y: "center" }) });
  }
  navigate(direction) {
    const blocks = this.result.state.field(resolution);
    if (!blocks.length) return;
    this.index = (this.index + direction + blocks.length) % blocks.length; this.block = blocks[this.index]; this.focusConflict();
  }
  choose(choice) {
    if (this.mark.disabled || choice !== "local" && this.block.crossed) return;
    const transaction = chooseResolution(this.result.state, this.block.id, choice, this.localFirst);
    if (transaction) this.result.dispatch({ ...transaction, annotations: isolateHistory.of("full"), userEvent: "input.merge" });
  }
  markResolved() {
    if (this.mark.disabled) return;
    const blocks = this.result.state.field(resolution).map(block => block.id === this.block.id ? { ...block, handled: !block.handled } : block);
    this.result.dispatch({ effects: resolutionEffect.of(blocks), annotations: isolateHistory.of("full"), userEvent: "input.merge" });
  }
  lock(value) {
    this.locked = value;
    this.result.dispatch({ effects: access.reconfigure([EditorState.readOnly.of(value), EditorView.editable.of(!value)]) }); this.update();
  }
  dirty() { return resolutionDirty(this.result.state, this.initialDoc); }
  snapshot() { return { state: this.result.state.update({ effects: listener.reconfigure([]) }).state, expected: this.expected,
    expectedIndex: this.expectedIndex, initialDoc: this.initialDoc, versions: this.versions }; }
  serialize() { return { text: this.result.state.sliceDoc(), expected: this.expected, expectedIndex: this.expectedIndex,
    blocks: this.result.state.field(resolution), versions: this.versions }; }
  destroy() { this.view.app.workspace.offref(this.themeEvent); this.merge.destroy(); }
}

module.exports = { ConflictEditor };
