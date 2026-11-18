(async () => {
  if (app.vault.getName() !== "note_test") throw Error("Run only in note_test.");
  const p = app.plugins.plugins.vaultbranch;
  if (!p || p.busy || [...p.editors.sessions.values()].some(s => s.dirty || s.saving)) throw Error("Finish operations and save drafts first.");
  await p.refreshTask; p.refreshSoon?.cancel();
  const fs = require("node:fs/promises"), path = require("node:path"), os = require("node:os"), exec = require("node:util").promisify(require("node:child_process").execFile);
  const saved = { settings: { ...p.settings }, git: p.git, ready: p.ready, status: p.status, error: p.error, saveData: p.saveData, updateSetting: p.updateSetting, scheduleRefresh: p.scheduleRefresh, lastAutoRefresh: p.lastAutoRefresh, active: app.workspace.activeLeaf };
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "vb-ui-consistency-")), leaves = [], results = [], requests = [];
  const initialNotices = new Set(document.querySelectorAll(".notice"));
  const check = (ok, label) => { if (!ok) throw Error(label); results.push(label); };
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  const wait = async predicate => { const end = Date.now() + 10000; while (!predicate()) { if (Date.now() > end) throw Error("UI operation timed out"); await pause(15); } };
  const git = async (...args) => (await exec(saved.git.binary, args, { cwd: root, windowsHide: true })).stdout;
  const click = async node => {
    node.scrollIntoView({ block: "center" }); await pause(50);
    const remote = node.ownerDocument.defaultView.require("electron").remote, web = remote.getCurrentWebContents(); remote.getCurrentWindow().show(); remote.getCurrentWindow().focus(); web.focus(); await pause(100);
    const box = node.getBoundingClientRect(), point = { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2), button: "left", clickCount: 1 };
    let trusted; node.addEventListener("click", event => { trusted = event.isTrusted; }, { once: true });
    web.sendInputEvent({ type: "mouseDown", ...point }); web.sendInputEvent({ type: "mouseUp", ...point }); await pause(50);
    check(trusted, "trusted native click: " + node.textContent.slice(0, 40) + " / " + (node.ownerDocument.elementFromPoint(point.x, point.y)?.outerHTML.slice(0, 160) || JSON.stringify(point)));
  };
  const key = async (node, keyCode, modifiers = []) => {
    node.focus(); const web = node.ownerDocument.defaultView.require("electron").remote.getCurrentWebContents();
    web.sendInputEvent({ type: "keyDown", keyCode, modifiers }); web.sendInputEvent({ type: "keyUp", keyCode, modifiers }); await pause(30);
  };
  const type = async (node, text) => {
    await click(node); await key(node, "A", ["control"]);
    let trusted; node.addEventListener("input", event => { trusted = event.isTrusted; }, { once: true });
    await node.ownerDocument.defaultView.require("electron").remote.getCurrentWebContents().insertText(text); await pause(30);
    check(trusted && node.value === text, "trusted native text input");
  };
  let tab, previousTab, settingsNotices;
  const clearNotices = () => {
    for (const notice of tab?.containerEl.ownerDocument.querySelectorAll(".notice") || []) if (!settingsNotices?.has(notice)) notice.click();
  };
  try {
    p.scheduleRefresh = () => {}; p.lastAutoRefresh = Date.now() + 3600000;
    // Exercise the real settings callbacks/effects without persisting test preferences.
    p.saveData = async () => {};
    p.updateSetting = function (key, value) { requests.push({ key, value }); return saved.updateSetting.call(this, key, value); };
    await app.setting.open(); app.setting.openTabById("vaultbranch"); await pause(300); tab = app.setting.activeTab; previousTab = tab.activeTab;
    settingsNotices = new Set(tab.containerEl.ownerDocument.querySelectorAll(".notice"));
    const select = async name => click(tab.containerEl.querySelector(`[data-tab="${name}"]`));
    const row = name => [...tab.containerEl.querySelectorAll(".setting-item")].find(item => name.test(item.querySelector(".setting-item-name")?.textContent));
    await select("general"); p.busy = true;
    const toggle = row(/启动时打开侧栏|Open sidebar on startup/).querySelector(".checkbox-container"); await click(toggle);
    check(toggle.classList.contains("is-enabled") === p.settings.openOnStartup, "rejected toggle restores the actual setting");
    const language = row(/界面语言|Interface language/).querySelector("select"); language.value = p.settings.language === "zh" ? "en" : "zh"; language.dispatchEvent(new Event("change", { bubbles: true })); await pause(30);
    check(language.value === p.settings.language, "rejected dropdown restores the actual setting"); p.busy = false; clearNotices(); await pause(250);
    const interval = row(/刷新间隔|Refresh interval/).querySelector("input"), start = requests.length;
    await type(interval, "0"); check(requests.length === start, "refresh input does not save on each digit");
    await key(interval, "Enter"); await wait(() => interval.value === "1" && p.settings.refreshSeconds === 1); check(true, "Enter commits and displays the normalized refresh interval");
    await select("git"); const history = row(/历史加载条数|History page size/).querySelector("input");
    await type(history, "1"); await click(row(/拉取方式|Pull method/).querySelector(".setting-item-name")); await wait(() => history.value === "10" && p.settings.historyLimit === 10);
    check(true, "blur commits and displays the normalized history page size");
    const executable = row(/Git 路径|Git path/).querySelector("input"), before = requests.filter(item => item.key === "gitPath").length;
    await click(executable);
    for (const text of ["C", "C:", "C:/", saved.git.binary]) {
      await key(executable, "A", ["control"]); await executable.ownerDocument.defaultView.require("electron").remote.getCurrentWebContents().insertText(text); await pause(20);
    }
    check(requests.filter(item => item.key === "gitPath").length === before, "partial Git executable paths perform zero settings updates");
    await key(executable, "Enter"); await wait(() => p.settings.gitPath === saved.git.binary); await p.refreshTask;
    check(requests.filter(item => item.key === "gitPath").length === before + 1, "one completed Git path performs exactly one settings update");
    await select("other"); check(!tab.containerEl.textContent.includes("collapseUnchanged") && !!row(/差异自动保存|Diff autosave/), "settings use translated names and behavior descriptions");
    p.busy = true;
    for (const control of tab.containerEl.querySelectorAll(".checkbox-container")) {
      const enabled = control.classList.contains("is-enabled"); control.click(); await pause(0); check(control.classList.contains("is-enabled") === enabled, "each Other toggle restores its value when rejected");
    }
    const order = row(/冲突版本顺序|Conflict pane order/).querySelector("select"), originalOrder = order.value;
    order.value = originalOrder === "local" ? "other" : "local"; order.dispatchEvent(new Event("change", { bubbles: true })); await pause(0);
    check(order.value === originalOrder, "conflict order dropdown restores its encoded value when rejected"); p.busy = false; clearNotices(); await pause(250);
    const limit = row(/调优记录保留条数|Timing record limit/).querySelector("input");
    await type(limit, "250"); await key(limit, "Enter"); await wait(() => p.settings.performanceLogLimit === 250);
    await type(limit, "0"); await key(limit, "Enter"); await wait(() => p.settings.performanceLogLimit === 0);
    await type(limit, "-1"); await key(limit, "Enter"); await wait(() => limit.value === "0"); check(p.settings.performanceLogLimit === 0, "unlimited retention works and invalid input restores the saved value");
    check(p.commandDefinitions().find(([id]) => id === "pull-rebase")[1] === "Pull", "Pull command name does not force rebase wording"); app.setting.close();
    await p.refreshTask; p.git = saved.git; p.ready = saved.ready; Object.assign(p.settings, saved.settings); p.timingLog?.setLimit(saved.settings.performanceLogLimit);
    await git("init", "-b", "main"); await git("config", "user.name", "UI Test"); await git("config", "user.email", "ui@example.invalid");
    await fs.mkdir(path.join(root, "deep/nested/folder"), { recursive: true });
    for (const file of ["deep/nested/folder/note.md", "second.md"]) await fs.writeFile(path.join(root, file), "base\n");
    await git("add", "."); await git("commit", "-m", "First UI consistency commit"); await fs.appendFile(path.join(root, "second.md"), "committed\n"); await git("commit", "-am", "Second UI consistency commit");
    await fs.appendFile(path.join(root, "deep/nested/folder/note.md"), "working\n");
    await fs.appendFile(path.join(root, "second.md"), "working root\n");
    p.git = new saved.git.constructor(root, { binary: saved.git.binary }); await p.git.init(); p.ready = true; p.status = await p.git.status();
    const index = await fs.readFile(path.join(root, ".git/index"));
    const graphLeaf = await p.openView("vaultbranch-history", {}, app.workspace.getLeaf("tab")); leaves.push(graphLeaf); const graph = graphLeaf.view, search = graph.contentEl.querySelector('input[type="search"]');
    await type(search, "no-such-commit-123"); const status = graph.contentEl.querySelector(".vaultbranch-history-search-status");
    check(!status.hidden && !!status.textContent && graph.contentEl.querySelectorAll(".vaultbranch-history-row").length === 2, "zero-match search announces the result while preserving graph lines");
    await type(search, "First"); check(status.hidden, "matching search clears the zero-result notice");
    const rows = [...graph.bodyEl.querySelectorAll(".vaultbranch-history-row")];
    await key(rows[0], "Down"); check(document.activeElement === rows[1], "graph ArrowDown moves focus");
    await key(rows[1], "Home"); check(document.activeElement === rows[0], "graph Home returns to the first row");
    await key(rows[0], "End"); check(document.activeElement === rows[1], "graph End moves to the last row");
    await key(rows[1], "Enter"); await wait(() => graph.selected === rows[1].dataset.commit && !graph.detailsEl.inert); check(true, "graph Enter loads the focused commit");
    p.busy = true; await graph.render(); check([...graph.contentEl.querySelectorAll(".vaultbranch-history-toolbar button")].every(button => button.disabled), "graph toolbar disables Git/refresh controls while busy");
    p.busy = false; p.status = { ...p.status, operation: "merge" }; await graph.render(); const buttons = [...graph.contentEl.querySelectorAll(".vaultbranch-history-toolbar button")];
    check(buttons[0].disabled && buttons[1].disabled && buttons[3].disabled && buttons[4].disabled && !buttons[2].disabled, "merge blocks branch/Push/Stash actions while Fetch stays available"); p.status = await p.git.status();
    const sourceLeaf = await p.openView("vaultbranch-source-control", {}, app.workspace.getLeaf("tab")); leaves.push(sourceLeaf); const source = sourceLeaf.view;
    let folder = source.treeEl.querySelector(".vaultbranch-folder"); await key(folder, "Left"); folder = source.treeEl.querySelector(".vaultbranch-folder");
    check(folder.getAttribute("aria-expanded") === "false" && document.activeElement === folder, "sidebar ArrowLeft collapses and restores folder focus");
    await key(folder, "Right"); folder = source.treeEl.querySelector(".vaultbranch-folder"); check(folder.getAttribute("aria-expanded") === "true" && document.activeElement === folder, "sidebar ArrowRight expands and restores focus");
    await key(folder, "Right"); check(document.activeElement === source.treeEl.querySelectorAll(".vaultbranch-folder")[1], "sidebar ArrowRight enters the expanded folder");
    await key(document.activeElement, "Left"); await key(document.activeElement, "Left"); check(document.activeElement === source.treeEl.querySelector(".vaultbranch-folder"), "sidebar ArrowLeft from a collapsed child returns to the parent");
    await key(document.activeElement, "End"); check(document.activeElement.classList.contains("vaultbranch-file-open"), "sidebar End focuses the last visible file");
    check(index.equals(await fs.readFile(path.join(root, ".git/index"))), "search/navigation/unavailable controls preserve index bytes");
    return { results, gitPathUpdates: { whileTyping: 0, afterCommit: 1 }, note: "Native trusted mouse/text/keyboard input. Real settings effects with test persistence intercepted; views use an isolated temporary Git repository." };
  } finally {
    p.busy = false; clearNotices(); app.setting.close(); if (tab && previousTab) tab.activeTab = previousTab;
    for (const leaf of leaves.reverse()) await leaf.detach(); await p.refreshTask;
    p.git = saved.git; p.ready = saved.ready; p.status = saved.status; p.error = saved.error; p.saveData = saved.saveData; p.updateSetting = saved.updateSetting;
    Object.assign(p.settings, saved.settings); p.timingLog?.setLimit(saved.settings.performanceLogLimit); p.scheduleRefresh = saved.scheduleRefresh; p.lastAutoRefresh = saved.lastAutoRefresh;
    for (const notice of document.querySelectorAll(".notice")) if (!initialNotices.has(notice)) notice.click();
    await p.refresh(); if (saved.active) await app.workspace.revealLeaf(saved.active); await fs.rm(root, { recursive: true, force: true });
  }
})()
