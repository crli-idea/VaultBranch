(async () => {
  if (app.vault.getName() !== "note_test") throw Error("Run only in note_test.");
  const p = app.plugins.plugins.vaultbranch;
  if (!p || [...p.editors.sessions.values()].some(s => s.dirty || s.saving) || p.conflictDrafts?.size) throw Error("Save drafts first.");
  const fs = require("node:fs/promises"), path = require("node:path"), os = require("node:os");
  const exec = require("node:util").promisify(require("node:child_process").execFile);
  const electron = require("electron").remote, web = electron.getCurrentWebContents();
  const attached = web.debugger.isAttached(); if (!attached) web.debugger.attach("1.3");
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "vb-conflict-ui-"));
  const saved = { git: p.git, status: p.status, ready: p.ready, scheduleRefresh: p.scheduleRefresh, lastAutoRefresh: p.lastAutoRefresh, settings: { ...p.settings }, error: p.error };
  const git = async (...args) => (await exec(saved.git.binary, args, { cwd: root, windowsHide: true })).stdout;
  const checks = [], samples = [], leaves = [], name = "deep/a/conflict.md", multiName = "deep/b/multiple.md";
  const lines = label => Array.from({ length: 10 }, (_, n) => `${label} ${n + 1}\n`).join("");
  const multiBase = [lines("base modify"), "", lines("base delete local"), lines("base delete other")];
  const multiLocal = [lines("local modify"), lines("local insert"), "", lines("local retained")];
  const multiOther = [lines("incoming modify"), lines("incoming insert"), lines("incoming retained"), ""];
  const multiText = chunks => "multiple conflicts\n\n" + chunks.map((text, n) => `## Case ${n + 1}\n\n${text}\n` + Array.from({ length: 8 }, (_, i) => `unchanged ${n}-${i}\n`).join("")).join("") + "end\n";
  const check = (ok, label) => { if (!ok) throw Error(label); checks.push({ name: label, ok: true }); };
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  const click = async node => {
    node.scrollIntoView({ block: "nearest" }); await pause(30);
    const rect = node.getBoundingClientRect(); let trusted;
    node.addEventListener("click", event => { trusted = event.isTrusted; }, { once: true });
    const data = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, button: "left", clickCount: 1 };
    await web.debugger.sendCommand("Input.dispatchMouseEvent", { type: "mousePressed", ...data });
    await web.debugger.sendCommand("Input.dispatchMouseEvent", { type: "mouseReleased", ...data });
    await pause(30); if (!trusted) throw Error("Expected a trusted mouse click");
  };
  const undo = async editor => {
    editor.focus();
    await web.debugger.sendCommand("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "z", code: "KeyZ", windowsVirtualKeyCode: 90, modifiers: 2 });
    await web.debugger.sendCommand("Input.dispatchKeyEvent", { type: "keyUp", key: "z", code: "KeyZ", windowsVirtualKeyCode: 90, modifiers: 2 });
    await pause(40);
  };
  let leaf, view, ui;
  const open = async filePath => { leaf = await p.openConflict(filePath); leaves.push(leaf); view = leaf.view; ui = view.editor; };
  const body = () => ui.result.state.doc.toString();
  try {
    await p.refreshTask; p.refreshSoon?.cancel(); p.scheduleRefresh = () => {}; p.lastAutoRefresh = Date.now() + 3600000;
    await git("init", "-b", "main"); await git("config", "user.name", "UI Test"); await git("config", "user.email", "ui@example.invalid"); await git("config", "core.autocrlf", "false");
    await git("config", "merge.conflictStyle", "diff3");
    const base = Array.from({ length: 50 }, (_, n) => `line ${n}\n`).join("");
    await fs.mkdir(path.dirname(path.join(root, name)), { recursive: true }); await fs.writeFile(path.join(root, name), base);
    await fs.mkdir(path.dirname(path.join(root, multiName)), { recursive: true }); await fs.writeFile(path.join(root, multiName), multiText(multiBase));
    await git("add", "."); await git("commit", "-m", "Base"); await git("branch", "incoming");
    const ours = base.replace("line 5\n", "local five\n").replace("line 35\n", "local thirty-five\n").replace("line 20\n", "automatic local change\n");
    await fs.writeFile(path.join(root, name), ours); await fs.writeFile(path.join(root, multiName), multiText(multiLocal));
    await git("commit", "-am", "Local"); await git("switch", "incoming");
    const theirs = base.replace("line 5\n", "incoming five\n").replace("line 35\n", "incoming thirty-five\n").replace("line 25\n", "automatic incoming change\n");
    await fs.writeFile(path.join(root, name), theirs); await fs.writeFile(path.join(root, multiName), multiText(multiOther));
    await git("commit", "-am", "Incoming"); await git("switch", "main");
    try { await git("merge", "incoming"); } catch { /* Isolated intentional conflict. */ }
    p.git = new saved.git.constructor(root, { binary: saved.git.binary }); await p.git.init(); p.ready = true; p.status = await p.git.status();
    p.settings.conflictLocalFirst = false;
    await p.updateSetting("language", "zh");
    const index = await git("ls-files", "--stage"), original = await fs.readFile(path.join(root, name), "utf8");
    await open(name);
    check(ui && view.contentEl.querySelectorAll(".cm-editor").length === 2 && !view.contentEl.querySelector(".vaultbranch-conflict-result"), "exactly two native MergeView panes, with no third result editor");
    check(!/[<=>]{7}/m.test(body()) && body().includes("local five") && ui.save.disabled, "local result starts without markers but both conflicts remain unresolved");
    check(body().includes("automatic local change") && body().includes("automatic incoming change"), "initial result preserves automatically merged changes from both sides");
    await click(ui.mark);
    check(ui.mark.textContent === ui.mark.title && ui.mark.title === ui.mark.getAttribute("aria-label") && ui.mark.textContent.includes("未解决"), "resolved mark text, native hint and accessible label agree");
    await click(ui.mark);
    check(!ui.block.handled && ui.mark.title === ui.mark.getAttribute("aria-label"), "unresolved mark restores its text and accessible label");
    check([ui.left, ui.right].every(button => button.title === button.getAttribute("aria-label")), "accept hints identify the actual displayed versions");
    check(ui.source.state.readOnly && !ui.result.state.readOnly && ui.source.state.doc.toString() === theirs, "incoming is the full read-only Git version; local result is editable");
    check(ui.rightLabel.textContent.includes("本地") && ui.counter.textContent.includes("1 / 2"), "local merge-result caption and first conflict are visible");
    await click(ui.next); check(ui.block.other === "incoming thirty-five\n", "next selects the second real conflict rather than an ordinary diff chunk");
    await click(ui.previous); check(ui.block.other === "incoming five\n", "previous returns to the first conflict");
    await click(ui.right); check(ui.block.handled && ui.save.disabled, "accepting the displayed local side marks only its conflict resolved");
    await undo(ui.result); check(!ui.block.handled && ui.counter.textContent.includes("1 / 2"), "native undo restores a state-only local acceptance");
    const editor = ui.result;
    await p.updateSetting("conflictLocalFirst", true);
    check(view.editor === ui && ui.result === editor && ui.merge.dom.querySelector(".cm-mergeViewEditor .cm-editor") === editor.dom, "changing pane order reuses both editors and the native merge view");
    await click(ui.left); check(ui.block.handled && body().includes("local five"), "accept left follows local after the order changes");
    await undo(ui.result);
    await p.updateSetting("conflictLocalFirst", false);
    const begun = performance.now(); await click(ui.both); samples.push({ operation: "trusted-accept-both", elapsedIncludingClickSetupMs: performance.now() - begun });
    check(body().includes("incoming five\nlocal five\n"), "both writes current left then current right into the local result");
    await click(ui.both); check(body().split("incoming five").length === 2, "repeating accept both does not duplicate already accepted text");
    await click(ui.next); await click(ui.left);
    check(!ui.save.disabled && body().includes("incoming thirty-five") && !body().includes("local thirty-five"), "accepting incoming resolves the second block and enables explicit completion");
    const resolved = body();
    check(await git("ls-files", "--stage") === index && await fs.readFile(path.join(root, name), "utf8") === original, "all choices remain in memory and change neither disk nor index");
    ui.result.dispatch({ selection: { anchor: 0 } }); ui.result.focus();
    let trustedInput; ui.result.contentDOM.addEventListener("beforeinput", event => { trustedInput = event.isTrusted; }, { once: true });
    await web.debugger.sendCommand("Input.insertText", { text: "x" }); await pause(30);
    check(trustedInput && body().startsWith("x"), "local result accepts trusted manual input");
    await undo(ui.result); check(body() === resolved, "native undo restores a manual text edit");
    await p.updateSetting("language", p.settings.language === "zh" ? "en" : "zh"); ui = view.editor;
    check(body() === resolved && !ui.save.disabled && ui.merge.chunks.length > 0, "language refresh preserves result, completion flags and native merge tracking");
    await undo(ui.result); check(ui.save.disabled && !ui.block.handled, "undo history and completion flags survive rebuilding the native merge view");
    await click(ui.left); check(body() === resolved && !ui.save.disabled, "post-refresh choice uses the new view listeners");
    const state = JSON.parse(JSON.stringify(view.getState()));
    check(state.resolutionDraft.text === resolved && state.resolutionDraft.blocks.every(block => block.handled), "workspace snapshot serializes both result text and resolution flags");
    await leaf.detach(); await open(name);
    check(body() === resolved && !ui.save.disabled, "closing and reopening retains the in-memory draft and handled flags");
    await leaf.detach(); p.conflictDrafts.delete(name);
    leaf = app.workspace.getLeaf("tab"); leaves.push(leaf);
    await leaf.setViewState({ type: "vaultbranch-conflict", state }); await app.workspace.revealLeaf(leaf); view = leaf.view; ui = view.editor;
    check(body() === resolved && !ui.save.disabled, "workspace-only restoration recreates the result and handled flags");
    await fs.appendFile(path.join(root, name), "external update\n");
    check(await view.saveResolution() === false, "external working-file changes block saving a stale resolution");
    check(await git("ls-files", "--stage") === index && body() === resolved && !ui.result.state.readOnly, "failed save preserves the draft, unmerged index and edit access");
    await fs.writeFile(path.join(root, name), original);
    const stages = await git("ls-files", "--unmerged");
    require("node:child_process").execFileSync(saved.git.binary, ["update-index", "--index-info"], { cwd: root, input: stages.replace("100644", "100755"), windowsHide: true });
    check(await view.saveResolution() === false && await fs.readFile(path.join(root, name), "utf8") === original, "changed conflict stages also block saving when working text is unchanged");
    require("node:child_process").execFileSync(saved.git.binary, ["update-index", "--index-info"], { cwd: root, input: stages, windowsHide: true });
    check(await view.saveResolution() === true, "explicit completion saves and stages through Git validation");
    check(await fs.readFile(path.join(root, name), "utf8") === resolved && !(await git("ls-files", "--unmerged", "--", name)).trim(), "saved and staged content exactly matches the resolved local result");
    check(ui.result.state.readOnly && ui.save.disabled && !p.conflictDrafts.has(name), "successful completion locks the result and clears its draft");
    await leaf.detach();
    const multiOriginal = await fs.readFile(path.join(root, multiName), "utf8"), multiIndex = await git("ls-files", "--stage", "--", multiName);
    await open(multiName);
    check(body() === multiText(multiLocal) && ui.counter.textContent.includes("1 / 4"), "real Git fixture has four separated ten-line modification, insertion and deletion conflicts");
    const expectedChunks = multiLocal.slice();
    for (const localFirst of [false, true]) {
      await p.updateSetting("conflictLocalFirst", localFirst);
      for (let id = 0; id < 4; id++) {
        while (ui.block.id !== id) await click(ui.next);
        const localButton = localFirst ? ui.left : ui.right, otherButton = localFirst ? ui.right : ui.left;
        const choices = [["other", otherButton], ["local", localButton], ["both", ui.both]];
        for (const [first, firstButton] of choices) for (const [second, secondButton] of choices) {
          for (const [choice, node] of [[first, firstButton], [second, secondButton]]) {
            const before = body(); await click(node);
            expectedChunks[id] = choice === "local" ? multiLocal[id] : choice === "other" ? multiOther[id]
              : localFirst ? multiLocal[id] + multiOther[id] : multiOther[id] + multiLocal[id];
            check(body() === multiText(expectedChunks) && ui.block.id === id && ui.block.handled,
              `trusted choices order=${localFirst} block=${id} ${first}->${second}: ${choice} preserves exact full document`);
            await undo(ui.result); check(body() === before, `native undo order=${localFirst} block=${id} ${first}->${second}: ${choice} restores exact prior document`);
            await click(node);
            check(body() === multiText(expectedChunks), `repeating choice after undo order=${localFirst} block=${id} ${choice} is exact`);
          }
        }
      }
    }
    check(await fs.readFile(path.join(root, multiName), "utf8") === multiOriginal && await git("ls-files", "--stage", "--", multiName) === multiIndex,
      "four-block GUI choice matrix leaves original file and unmerged index unchanged");
    const multiResolved = multiText(expectedChunks);
    check(await view.saveResolution() === true && await fs.readFile(path.join(root, multiName), "utf8") === multiResolved
      && await git("show", ":" + multiName) === multiResolved, "explicit completion writes and stages exact four-block GUI result");
    await leaf.detach(); await git("reset", "--hard", "HEAD");
    try { await git("rebase", "incoming"); } catch { /* Isolated rebase conflict. */ }
    p.status = await p.git.status(); await open(name);
    const rebase = await p.git.conflictVersions(name);
    check(rebase.operation === "rebase" && body().includes("local five") && ui.source.state.doc.toString() === rebase.ours && ui.otherLabel === rebase.oursLabel, "rebase edits replayed local content and labels the read-only side upstream");
    await leaf.detach(); p.conflictDrafts.delete(name);
    await p.updateSetting("conflictLocalFirst", false);
    const synthetic = "before\n<<<<<<< HEAD\n## 发布安排\n\n每周五发布。\n=======\n## 发布安排\n\n测试后发布。\n>>>>>>> side\nafter\n";
    const sample = result => ({ base: "ancestor", ours: "local", theirs: "incoming", result, oursLabel: "Local", theirsLabel: "Incoming", signature: "synthetic" });
    p.git.conflictVersions = async () => sample(synthetic);
    await open(name); await click(ui.both);
    check((body().match(/## 发布安排/g) || []).length === 1 && body().includes("测试后发布。\n每周五发布。"), "both keeps a shared Markdown heading once while retaining both conflicting sentences");
    ui.result.dispatch({ changes: { from: 0, to: ui.result.state.doc.length, insert: "<<<<<<< HEAD\nincomplete\n" } });
    check(ui.both.disabled && ui.save.disabled && !ui.message.hidden, "new incomplete markers block all choices and completion");
    await leaf.detach(); p.conflictDrafts.delete(name);
    const chineseRows = label => Array.from({ length: 10 }, (_, n) => `${label} · 第 ${n + 1} 行\n`).join("");
    const chineseHeads = ["双方修改同一段（各十行）", "双方在同一位置新增（各十行）", "本地删除段落，对方修改（十行）", "本地修改段落，对方删除（十行）"];
    const chineseLocal = [chineseRows("本地修改"), chineseRows("本地新增"), "", chineseRows("本地修改段落四")];
    const chineseOther = [chineseRows("对方修改"), chineseRows("对方新增"), chineseRows("对方修改段落三"), ""];
    const chineseText = chunks => "# 同一文件 · 四处真实冲突\n\n每处涉及十行；删除侧为空。文件留给你手动操作，不自动解决。\n\n"
      + chunks.map((text, n) => `## ${n + 1}. ${chineseHeads[n]}\n\n${text}\n公共分隔 ${n + 1}：以下内容保持不变。\n公共分隔 ${n + 1}：用来隔开相邻冲突。\n公共分隔 ${n + 1}：本地与对方完全相同。\n公共分隔 ${n + 1}：不会被采用按钮替换。\n公共分隔 ${n + 1}：可以继续向下查看。\n\n`).join("") + "文件结束。\n";
    const chineseMarkers = chineseText(chineseLocal.map((text, n) => `<<<<<<< HEAD\n${text}=======\n${chineseOther[n]}>>>>>>> incoming\n`));
    p.git.conflictVersions = async () => ({ ...sample(chineseMarkers), ours: chineseText(chineseLocal), theirs: chineseText(chineseOther) });
    await open(name);
    check(ui.merge.chunks.length === 4, "repeated Chinese paragraphs render as four native chunks instead of merging opposite deletions");
    const cleanHighlights = () => ui.merge.chunks.every(chunk => [[ui.source, chunk.fromA, chunk.endA], [ui.result, chunk.fromB, chunk.endB]]
      .every(([editor, from, to]) => !/公共分隔|## /u.test(editor.state.doc.sliceString(from, to))));
    check(cleanHighlights(), "unchanged Chinese separators and headings stay outside all native chunk highlights");
    while (ui.block.id !== 2) await click(ui.next);
    const separatorPosition = editor => editor.state.doc.toString().indexOf("公共分隔 3：");
    ui.merge.dom.scrollTop = Math.max(0, ui.result.lineBlockAt(separatorPosition(ui.result)).top - 180);
    await pause(150);
    const commonLines = [...ui.merge.dom.querySelectorAll(".cm-line")].filter(line => line.textContent.includes("公共分隔 3："));
    check(commonLines.length >= 10 && commonLines.every(line => !line.classList.contains("cm-changedLine") && !line.querySelector(".cm-changedText")),
      "both rendered copies of all five public separator lines use normal native styling");
    const positions = [ui.source, ui.result].map(editor => editor.coordsAtPos(separatorPosition(editor)));
    check(positions.every(Boolean) && Math.abs(positions[0].top - positions[1].top) < 1, "native spacers align the unchanged paragraph between conflicts three and four");
    const chineseExpected = chineseLocal.slice();
    for (const localFirst of [false, true]) {
      await p.updateSetting("conflictLocalFirst", localFirst);
      for (const id of [2, 3]) {
        while (ui.block.id !== id) await click(ui.next);
        for (const choice of ["other", "local", "both", "other", "local"]) {
          const node = choice === "both" ? ui.both : (choice === "local") === localFirst ? ui.left : ui.right;
          const before = body(); await click(node);
          chineseExpected[id] = choice === "local" ? chineseLocal[id] : choice === "other" ? chineseOther[id]
            : localFirst ? chineseLocal[id] + chineseOther[id] : chineseOther[id] + chineseLocal[id];
          check(body() === chineseText(chineseExpected) && cleanHighlights(), `Chinese ${id} ${choice} order=${localFirst} keeps exact text and separate native highlights`);
          await undo(ui.result); check(body() === before && cleanHighlights(), `Chinese ${id} ${choice} order=${localFirst} undo restores text and highlight boundaries`);
          await click(node);
        }
      }
    }
    await leaf.detach(); p.conflictDrafts.delete(name);
    p.git.conflictVersions = async () => ({ ...sample(synthetic), ours: null });
    await open(name); check(ui.both.disabled && ui.save.disabled && !ui.message.hidden, "deletion conflicts stay locked with an external-tool explanation");
    await leaf.detach(); p.conflictDrafts.delete(name);
    p.git.conflictVersions = async () => { throw Error("binary conflict fixture"); };
    await open(name); check(!view.editor && view.contentEl.textContent.includes("binary conflict fixture"), "unavailable conflict data displays an error without a partial editor");
    p.git.conflictVersions = async () => sample(synthetic);
    await click(view.contentEl.querySelector(".vaultbranch-diff-header button"));
    for (let n = 0; !view.editor && n < 200; n++) await pause(10);
    check(Boolean(view.editor), "error-page refresh recovers the same conflict view without reopening a tab");
    await open(name); check(Boolean(ui), "opening another conflict recovers after a read failure");
    let release, started; const begunRead = new Promise(resolve => { started = resolve; });
    p.git.conflictVersions = async () => { started(); await new Promise(resolve => { release = resolve; }); return sample(synthetic); };
    const oldEditor = ui.result, loading = view.render(); await begunRead;
    check(oldEditor.dom.isConnected && view.editor.result === oldEditor, "pending conflict reads retain the full existing two-pane page");
    await leaf.detach(); release(); await loading;
    check(!view.editor, "closing during a read does not resurrect a MergeView"); p.conflictDrafts.delete(name);
    const prefix = "ordinary text abcdefghijklmnopqrstuvwxyz\n".repeat(30000);
    const tail = "before\n<<<<<<< HEAD\na\n=======\nb\n>>>>>>> side\nafter\n";
    p.git.conflictVersions = async () => ({ ...sample(prefix + tail), ours: prefix + "before\na\nafter\n", theirs: prefix + "before\nb\nafter\n" });
    for (let n = 0; n < 6; n++) {
      const begun = performance.now(); await open(name);
      if (n) samples.push({ operation: "large-conflict-page-ready", ms: performance.now() - begun, bytes: Buffer.byteLength(prefix + tail), lines: (prefix + tail).split("\n").length });
      check(view.contentEl.querySelectorAll(".cm-editor").length === 2 && body().startsWith(prefix), `large fixture ${n} uses two editors and retains the full merged prefix`);
      const begunEdit = performance.now(); ui.result.dispatch({ changes: { from: 10, insert: "x" } });
      if (n) samples.push({ operation: "large-common-text-dispatch", ms: performance.now() - begunEdit });
      await leaf.detach(); p.conflictDrafts.delete(name);
    }
    check(!(window.__vaultbranchErrors || []).length, "no runtime errors during conflict checks");
    return { checks, samples, note: "Isolated Git merge/rebase; native trusted mouse, keyboard and beforeinput. Large-page samples include MergeView setup but exclude Git reads and physical paint. Dispatch samples are synchronous, not end-to-end key latency." };
  } finally {
    if (!attached) web.debugger.detach();
    for (const leaf of leaves.reverse()) await leaf.detach(); p.conflictDrafts?.delete(name); p.conflictDrafts?.delete(multiName);
    p.git = saved.git; p.status = saved.status; p.ready = saved.ready; p.error = saved.error; p.scheduleRefresh = saved.scheduleRefresh; p.lastAutoRefresh = saved.lastAutoRefresh; p.busy = false;
    Object.assign(p.settings, saved.settings); await p.saveData(p.settings); await p.applyLanguage(); await p.refresh();
    await fs.rm(root, { recursive: true, force: true });
  }
})()
