"use strict";

const { Modal, Setting, Notice } = require("obsidian");
const { t } = require("./i18n.js");
const { el, button } = require("./views/shared.js");

async function choosePushTarget(plugin) {
  try {
    await plugin.ensureReady();
    const { branch: localBranch, remotes } = await plugin.git.pushTarget();
    const modal = new Modal(plugin.app);
    modal.titleEl.textContent = t("推送并设置上游");
    let remote = remotes.includes("origin") ? "origin" : remotes[0], branch = localBranch;
    el(modal.contentEl, "p", "", t`本地分支：${localBranch}`);
    new Setting(modal.contentEl).setName(t("远程仓库")).addDropdown(input => {
      for (const name of remotes) input.addOption(name, name);
      input.setValue(remote).onChange(value => { remote = value; });
    });
    new Setting(modal.contentEl).setName(t("远程分支")).addText(input => {
      input.setValue(branch).onChange(value => { branch = value.trim(); });
    });
    const actions = el(modal.contentEl, "div", "vaultbranch-confirm-actions");
    button(actions, null, t("取消"), () => modal.close(), t("取消"));
    const submit = button(actions, "arrow-up", t("推送并设置上游"), async () => {
      submit.disabled = true;
      const destination = { remote, branch, localBranch };
      try {
        if (await plugin.mutate("Push", () => plugin.git.push(destination))) modal.close();
      } finally { submit.disabled = false; }
    }, t("推送并设置上游"));
    submit.classList.add("mod-cta");
    modal.open();
  } catch (error) { new Notice(error.message); }
}

module.exports = { choosePushTarget };
