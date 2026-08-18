import { existsSync, statSync, mkdirSync, cpSync, writeFileSync, readFileSync, appendFileSync } from "node:fs";
import { join, resolve, basename } from "node:path";

const env = process.env;
const cwd = resolve(env.HP_CWD && env.HP_CWD.trim() ? env.HP_CWD.trim() : ".");
const engineInput = (env.HP_ENGINE || "").trim();
const pathInput = (env.HP_PATH || "").trim();
const rootFile = (env.HP_ROOT_FILE || "").trim();
const stageRoot = env.HP_STAGE;

const registry = JSON.parse(readFileSync(new URL("./registry.json", import.meta.url), "utf8"));

const fail = (m) => { console.log(`::error::${m}`); process.exit(1); };
const note = (m) => console.log(`::notice::${m}`);
const warn = (m) => console.log(`::warning::${m}`);
const out = (obj) => {
  const lines = Object.entries(obj).map(([k, v]) => `${k}=${v}`).join("\n") + "\n";
  if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, lines);
  else process.stdout.write(lines);
};

const REDIRECT = (entry) =>
`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Redirecting…</title>
<meta http-equiv="refresh" content="0; url=./${entry}">
<link rel="canonical" href="./${entry}">
<script>location.replace("./${entry}")</script>
</head><body><a href="./${entry}">Open report →</a></body></html>
`;

function detect(engine) {
  const entry = engine.entry || "index.html";
  for (const cand of engine.candidates) {
    const dir = join(cwd, cand);
    try {
      if (statSync(dir).isDirectory() && existsSync(join(dir, entry))) return { dir, entry, cand };
    } catch {
      /* candidate absent */
    }
  }
  return null;
}

function ensureEntry(stageDir, entry) {
  if (entry !== "index.html" && !existsSync(join(stageDir, "index.html")))
    writeFileSync(join(stageDir, "index.html"), REDIRECT(entry));
}

function shell(reports) {
  const data = JSON.stringify(reports);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ship.page · reports</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='26' height='26' x='3' y='3' rx='7' fill='%2306b6d4' transform='rotate(12 16 16)'/%3E%3C/svg%3E">
<style>
  :root{--bg:#fbfafb;--fg:#1e1924;--muted:#7c7482;--border:#e8e5ea;--nav:#fff;--brand:#06b6d4}
  @media (prefers-color-scheme:dark){:root{--bg:#141019;--fg:#f5f3f6;--muted:#a8a1ad;--border:#302a36;--nav:#1e1924;--brand:#f37e69}}
  *{box-sizing:border-box}
  html,body{margin:0;height:100%}
  body{display:flex;flex-direction:column;font-family:Inter,ui-sans-serif,system-ui,sans-serif;background:var(--bg);color:var(--fg)}
  nav{display:flex;align-items:center;gap:14px;height:52px;padding:0 14px;background:var(--nav);border-bottom:1px solid var(--border);flex:0 0 auto}
  .brand{display:flex;align-items:center;gap:8px;text-decoration:none;color:inherit;font-weight:700;font-size:15px}
  .brand b{color:var(--brand)}
  .switch{margin-left:8px;display:flex;align-items:center;gap:8px}
  label.lbl{font-size:12px;color:var(--muted);font-weight:500}
  select{font:inherit;font-size:13px;padding:6px 30px 6px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--fg);cursor:pointer;-webkit-appearance:none;appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2 4l4 4 4-4' stroke='%237c7482' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 10px center}
  .spacer{flex:1}
  .full{font-size:13px;color:var(--muted);text-decoration:none;padding:6px 10px;border:1px solid var(--border);border-radius:8px}
  .full:hover{color:var(--fg);border-color:var(--muted)}
  .frame{flex:1;border:0;width:100%;background:var(--bg)}
</style>
</head>
<body>
<nav>
  <a class="brand" href="https://ship.page" target="_blank" rel="noopener">
    <svg width="22" height="22" viewBox="0 0 32 32"><rect width="26" height="26" x="3" y="3" rx="7" fill="var(--brand)" transform="rotate(12 16 16)"/></svg>
    <span>ship<b>.page</b></span>
  </a>
  <div class="switch"><label class="lbl" for="sel">report</label><select id="sel"></select></div>
  <div class="spacer"></div>
  <a class="full" id="full" href="#" target="_blank" rel="noopener">open in full ↗</a>
</nav>
<iframe class="frame" id="frame" title="report"></iframe>
<script>
  const reports = ${data};
  const sel = document.getElementById("sel");
  const frame = document.getElementById("frame");
  const full = document.getElementById("full");
  reports.forEach((r, i) => {
    const o = document.createElement("option");
    o.value = String(i);
    o.textContent = (r.emoji ? r.emoji + " " : "") + r.label;
    sel.appendChild(o);
  });
  const srcFor = (i) => "./" + reports[i].id + "/";
  function show(i) {
    const u = srcFor(i);
    frame.src = u;
    full.href = u;
    sel.value = String(i);
    if (history.replaceState) history.replaceState(null, "", "#" + reports[i].id);
  }
  const initial = () => {
    const h = decodeURIComponent(location.hash.slice(1));
    const i = reports.findIndex((r) => r.id === h);
    return i >= 0 ? i : 0;
  };
  sel.addEventListener("change", () => show(Number(sel.value)));
  window.addEventListener("hashchange", () => {
    const i = initial();
    if (String(i) !== sel.value) show(i);
  });
  show(initial());
</script>
</body>
</html>
`;
}

let resolved = [];
let mode;

if (pathInput) {
  const src = join(cwd, pathInput);
  if (!existsSync(src)) fail(`path '${pathInput}' does not exist (working-directory: ${cwd})`);
  const isDir = statSync(src).isDirectory();
  resolved = [{ id: "report", label: "report", emoji: "📄", dir: isDir ? src : null, file: isDir ? null : src, entry: rootFile || "index.html" }];
  mode = "single";
} else {
  let candidates;
  if (engineInput === "" || engineInput === "auto") {
    candidates = registry.engines;
  } else {
    const ids = engineInput.split(",").map((s) => s.trim()).filter(Boolean);
    candidates = [];
    for (const id of ids) {
      const e = registry.engines.find((x) => x.id === id);
      if (!e) { warn(`unknown engine '${id}' — known: ${registry.engines.map((x) => x.id).join(", ")}`); continue; }
      candidates.push(e);
    }
    if (candidates.length === 0) fail(`no known engines in 'engine: ${engineInput}'`);
  }
  for (const e of candidates) {
    const hit = detect(e);
    if (hit) resolved.push({ id: e.id, label: e.label, emoji: e.emoji, dir: hit.dir, entry: hit.entry, cand: hit.cand });
  }
  if (resolved.length === 0) {
    const probed = candidates.map((e) => `${e.id}: ${e.candidates.join(" | ")}`).join("\n  ");
    fail(`no reports found under '${cwd}'. Probed:\n  ${probed}`);
  }
  mode = resolved.length === 1 ? "single" : "multi";
}

mkdirSync(stageRoot, { recursive: true });

if (mode === "single") {
  const r = resolved[0];
  if (rootFile) r.entry = rootFile;
  if (r.dir) {
    cpSync(r.dir, stageRoot, { recursive: true });
    ensureEntry(stageRoot, r.entry);
  } else {
    const name = basename(r.file);
    cpSync(r.file, join(stageRoot, name));
    if (name !== "index.html") writeFileSync(join(stageRoot, "index.html"), REDIRECT(rootFile || name));
  }
  note(`ship.page: deploying ${r.emoji || ""} ${r.label}${r.cand ? ` (${r.cand})` : ""}`);
  out({ deploy_src: stageRoot, mode, label: `${r.emoji || ""} ${r.label}`.trim(), engines: r.id });
} else {
  const reports = [];
  for (const r of resolved) {
    const dest = join(stageRoot, r.id);
    mkdirSync(dest, { recursive: true });
    cpSync(r.dir, dest, { recursive: true });
    ensureEntry(dest, r.entry);
    reports.push({ id: r.id, label: r.label, emoji: r.emoji || "" });
  }
  writeFileSync(join(stageRoot, "index.html"), shell(reports));
  const names = resolved.map((r) => r.label).join(", ");
  note(`ship.page: multi-report drop (${resolved.length}) → ${names}`);
  out({ deploy_src: stageRoot, mode, label: `${resolved.length} reports: ${names}`, engines: resolved.map((r) => r.id).join(",") });
}
