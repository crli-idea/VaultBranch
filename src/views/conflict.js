"use strict";

const { Notice, Modal } = require("obsidian");
const { t } = require("../i18n.js");
const { CONFLICT_VIEW, el, button, GitView } = require("./shared.js");
const { ConflictEditor } = require("./conflict-editor.js");
const { resolution, resolutionDirty } = require("../conflict-document.js");

class ConflictView extends GitView {
  constructor(leaf, plugin) { super(leaf, plugin); this.filePath = ""; plugin.conflictDrafts ||= new Map(); }
  getViewType() { return CONFLICT_VIEW; }
  getDisplayText() { return this.filePath ? t`冲突 · ${this.filePath.split("/").at(-1)}` : t("VaultBranch · 解决冲突"); }
  getIcon() { return "git-merge"; }
  getState() {
    if (this.saved) return { filePath: this.filePath };
    const draft = (this.loadedPath === this.filePath ? this.editor?.snapshot() : null) || this.plugin.conflictDrafts.get(this.filePath);
    return { filePath: this.filePath, resolutionDraft: draft && resolutionDirty(draft.state, draft.initialDoc)
      ? { text: draft.state.sliceDoc(), blocks: draft.state.field(resolution), expected: draft.expected, expectedIndex: draft.expectedIndex, versions: draft.versions } : undefined };
  }
  async setState(state, result) {
    if (this.saving) return;
    this.retainDraft();
    this.filePath = state.filePath || "";
    this.restoredDraft = typeof state.resolutionDraft?.text === "string" && typeof state.resolutionDraft.expected === "string" ? state.resolutionDraft : null;
    await this.render(); await super.setState(state, result);
  }
  retainDraft() {
    if (!this.editor || this.saved) return;
    const draft = this.editor.snapshot();
    if (!this.editor.dirty()) this.plugin.conflictDrafts.delete(this.loadedPath);
    else this.plugin.conflictDrafts.set(this.loadedPath, draft);
  }
  destroyEditor() { this.editor?.destroy(); this.editor = null; }
  async onClose() { this.retainDraft(); this.destroyEditor(); await super.onClose(); }

  async render({ discardDraft = false } = {}) {
    if (this.saving) return;
    const request = ++this.request, filePath = this.filePath;
    this.contentEl.inert = true;
    this.contentEl.setAttribute("aria-busy", "true");
    const page = this.contentEl.ownerDocument.createElement("div");
    const header = el(page, "div", "vaultbranch-diff-header");
    el(header, "div", "vaultbranch-diff-path", filePath).title = filePath;
    const body = el(page, "div", "vaultbranch-conflict-body");
    let editor;
    try {
      if (!filePath) return;
      await this.plugin.ensureReady();
      const versions = await this.plugin.git.conflictVersions(filePath);
      if (request !== this.request) return;
      // Capture after the read: typing during an awaited refresh must survive.
      if (discardDraft) this.plugin.conflictDrafts.delete(filePath);
      else this.retainDraft();
      let draft = this.plugin.conflictDrafts.get(filePath);
      if (!draft && !discardDraft && this.restoredDraft) {
        draft = { serialized: this.restoredDraft, expected: this.restoredDraft.expected, expectedIndex: this.restoredDraft.expectedIndex, versions: this.restoredDraft.versions };
      }
      editor = new ConflictEditor(this, body, header, versions, draft);
      this.restoredDraft = null;
    } catch (error) {
      editor?.destroy(); editor = null;
      if (request === this.request) {
        el(body, "div", "vaultbranch-empty is-error", error.message);
        button(header, "refresh-cw", t("刷新冲突"), () => this.render());
      }
    } finally {
      if (request === this.request) {
        if (!discardDraft) this.retainDraft();
        this.destroyEditor();
        this.editor = editor; this.loadedPath = filePath; this.saved = false;
        this.contentEl.replaceChildren(...(filePath ? page.childNodes : []));
        this.contentEl.inert = false;
        this.contentEl.removeAttribute("aria-busy");
      } else editor?.destroy();
    }
  }

  reloadResolution() {
    if (this.saving) return;
    const editor = this.editor;
    if (!editor?.dirty()) return this.render({ discardDraft: true });
    const modal = new Modal(this.app);
    modal.titleEl.textContent = t("放弃草稿并重新载入？");
    el(modal.contentEl, "p", "", this.filePath);
    const actions = el(modal.contentEl, "div", "vaultbranch-confirm-actions");
    button(actions, null, t("取消"), () => modal.close(), t("取消"));
    button(actions, null, t("放弃草稿"), async () => {
      modal.close(); if (this.editor === editor && !this.saving) await this.render({ discardDraft: true });
    }, t("放弃草稿")).classList.add("mod-warning");
    modal.open();
  }

  async saveResolution() {
    const editor = this.editor, filePath = this.loadedPath;
    if (!editor || editor.save.disabled || this.saving || this.plugin.busy || this.plugin.mutationPending) return false;
    this.saving = true; editor.lock(true);
    try {
      const content = editor.result.state.sliceDoc();
      const saved = await this.plugin.mutate(t("解决冲突"), () => this.plugin.git.resolveConflict(filePath, content, editor.expected, editor.expectedIndex));
      if (saved) {
        this.plugin.conflictDrafts.delete(filePath); this.saved = true;
        if (this.editor === editor) editor.resultLabel.textContent = t("已保存并暂存 · 在侧栏点击继续");
      }
      return saved;
    } catch (error) { new Notice(error.message); return false; }
    finally {
      this.saving = false;
      if (this.editor === editor && !this.saved) editor.lock(false);
    }
  }
}

module.exports = { ConflictView };
