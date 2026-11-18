(async () => {
  if (app.vault.getName() !== "note_test") throw Error("Run only in note_test.");
  const p = app.plugins.plugins.vaultbranch;
  if (!p || [...p.editors.sessions.values()].some(s => s.dirty || s.saving)) throw Error("Save drafts first.");
  await p.refreshTask; p.refreshSoon?.cancel();
  const fs = require("node:fs/promises"), os = require("node:os"), path = require("node:path");
  const exec = require("node:util").promisify(require("node:child_process").execFile);
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "vb-source-actions-")), repo = path.join(root, "repo"), remote = path.join(root, "remote.git");
  const saved = { git: p.git, status: p.status, ready: p.ready, error: p.error, scheduleRefresh: p.scheduleRefresh, lastAutoRefresh: p.lastAutoRefresh };
  const source = (await p.openSidebar()).view, collapsed = source.collapsed, selected = source.selected;
  const web = require("electron").remote.getCurrentWebContents(), attached = web.debugger.isAttached();
  if (!attached) web.debugger.attach("1.3");
  const results = [], check = (ok, label) => { if (!ok) throw Error(label); results.push(label); };
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  const wait = async predicate => { const deadline = Date.now() + 15000; while (!predicate()) { if (Date.now() > deadline) throw Error("UI operation timed out"); await pause(20); } };
  const click = async node => {
    if (!node) throw Error("Expected action control is missing");
    node.scrollIntoView({ block: "nearest" }); await pause(30);
    const box = node.getBoundingClientRect(); let trusted;
    node.addEventListener("click", event => { trusted = event.isTrusted; }, { once: true });
    const data = { x: box.x + box.width / 2, y: box.y + box.height / 2, button: "left", clickCount: 1 };
    await web.debugger.sendCommand("Input.dispatchMouseEvent", { type: "mousePressed", ...data });
    await web.debugger.sendCommand("Input.dispatchMouseEvent", { type: "mouseReleased", ...data });
    await pause(30); check(trusted, "trusted native action click");
  };
  const git = async (...args) => (await exec(saved.git.binary, args, { cwd: repo, windowsHide: true })).stdout;
  const write = async (name, text) => { await fs.mkdir(path.dirname(path.join(repo, name)), { recursive: true }); await fs.writeFile(path.join(repo, name), text); };
  const folder = area => source.treeEl.querySelectorAll(".vaultbranch-group")[area === "staged" ? 0 : 1].querySelector('.vaultbranch-folder-node[data-path="Fig"]');
  let history;
  try {
    p.scheduleRefresh = () => {}; p.lastAutoRefresh = Date.now() + 3600000;
    await fs.mkdir(repo); await git("init", "-b", "main"); await git("config", "user.name", "UI Test"); await git("config", "user.email", "ui@example.invalid"); await git("config", "core.autocrlf", "false");
    await git("init", "--bare", remote);
    const fixtures = [
      ["Fig/note.md", "# Small note\nbase\n"],
      ["Fig/large/deep/data.json", JSON.stringify(Array.from({ length: 24000 }, (_, id) => ({ id, text: "base abcdefghijklmnopqrstuvwxyz" })), null, 2)],
      ["Fig/small/deep/data.json", '{"text":"base"}\n'],
      ["Fig/large/note.md", "base abcdefghijklmnopqrstuvwxyz\n".repeat(40000)],
      ["Fig-other/note.md", "base\n"],
    ];
    for (const [name, text] of fixtures) await write(name, text);
    await git("add", "."); await git("commit", "-m", "base");
    for (const [name, text] of fixtures) await write(name, text.replace("base", "changed"));
    p.git = new saved.git.constructor(repo, { binary: saved.git.binary }); await p.git.init(); p.ready = true;
    source.collapsed = new Set(["unstaged:Fig"]); await p.refresh();
    check(!source.pushButton.disabled, "Push is available without upstream");
    check(!source.treeEl.querySelector("button button"), "folder controls are sibling buttons");
    await click(folder("unstaged").querySelector(".vaultbranch-row-action"));
    await wait(() => !p.busy && p.status.files.filter(f => f.index === "M").length === 4);
    check(source.collapsed.has("unstaged:Fig"), "folder action does not expand collapsed folder");
    check((await git("diff", "--cached", "--name-only")).trim().split("\n").every(name => name.startsWith("Fig/")), "only selected folder descendants are staged");
    source.collapsed.add("staged:Fig"); source.render();
    await click(folder("staged").querySelector(".vaultbranch-row-action"));
    await wait(() => !p.busy && p.status.files.every(f => f.index === " "));
    check(!(await git("diff", "--cached", "--name-only")).trim(), "folder minus unstages all descendants");
    await git("remote", "add", "backup", remote); await git("remote", "add", "origin", remote);
    await click(source.pushButton);
    await wait(() => document.querySelector(".modal-container select"));
    const modal = document.querySelector(".modal-container .modal");
    check(modal.querySelector("select").value === "origin", "first Push defaults to origin among multiple remotes");
    const field = modal.querySelector("input[type=text]"); check(field.value === "main", "first Push defaults to current local branch");
    field.value = "notes/review"; field.dispatchEvent(new Event("input", { bubbles: true }));
    await click(modal.querySelector(".mod-cta"));
    await wait(() => !p.busy && p.status.upstream === "origin/notes/review");
    check(!modal.isConnected, "successful first Push closes dialog and sets upstream");
    check((await git("--git-dir=" + remote, "rev-parse", "refs/heads/notes/review")) === await git("rev-parse", "HEAD"), "Push publishes current commit to explicitly selected branch");
    check((await git("diff", "--name-only")).trim().split("\n").length === 5, "Push preserves working changes");
    await git("add", "."); await git("commit", "-m", "save fixture changes");
    await write("Fig/note.md", "older stash\n"); await p.git.stash();
    await write("Fig/note.md", "latest stash\n"); await p.git.stash();
    const [latest, older] = await p.git.stashHistory(100); await p.refresh();
    check(/Pop/.test(source.stashButton.title), "clean sidebar explicitly labels its latest-stash action Pop");
    history = await p.openHistory(); const view = history.view;
    await click(view.bodyEl.querySelector(`[data-commit="${latest.hash}"]`));
    await wait(() => view.selected === latest.hash && !view.detailsEl.inert && view.detailsEl.querySelector(".vaultbranch-history-actions"));
    const pop = [...view.detailsEl.querySelectorAll(".vaultbranch-history-actions button")].find(node => /Pop/.test(node.textContent));
    check(pop, "stash@{0} has a visible Pop action in selected graph details");
    await click(pop); await wait(() => !p.busy && p.status.files.some(f => f.path === "Fig/note.md"));
    check(await fs.readFile(path.join(repo, "Fig/note.md"), "utf8") === "latest stash\n", "Pop restores the selected stash content");
    const remaining = await p.git.stashHistory(100);
    check(remaining.length === 1 && remaining[0].hash === older.hash, "Pop removes only the selected stash and preserves older entries");
    return { results, fixtures: fixtures.map(([name, text]) => ({ name, bytes: Buffer.byteLength(text) })) };
  } finally {
    await wait(() => !p.busy); if (history) await history.detach();
    source.collapsed = collapsed; source.selected = selected; Object.assign(p, saved); await p.refresh();
    if (!attached && web.debugger.isAttached()) web.debugger.detach();
    await fs.rm(root, { recursive: true, force: true });
  }
})()
