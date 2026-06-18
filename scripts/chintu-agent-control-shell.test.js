"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..");
const dashboardScript = path.join(repoRoot, "scripts", "chintu-agent-dashboard.ps1");
const claudeScript = path.join(repoRoot, "scripts", "chintu-claude-overnight-package.ps1");
const enddayScript = path.join(repoRoot, "scripts", "chintu-endday-operator.ps1");
const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "chintu-stage10-"));

function run(command, args, cwd = fixtureRoot) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed (${result.status})\n${result.stdout}\n${result.stderr}`
    );
  }
  return result.stdout;
}

function write(relativePath, content) {
  const target = path.join(fixtureRoot, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, "utf8");
}

try {
  run("git", ["init", "-q"]);
  run("git", ["config", "user.name", "Chintu Stage 10 Test"]);
  run("git", ["config", "user.email", "stage10-test@example.invalid"]);
  run("git", ["branch", "-M", "main"]);
  write("seed.txt", "stage 8 and 9\n");
  run("git", ["add", "seed.txt"]);
  run("git", ["commit", "-q", "-m", "seed operator state"]);
  run("git", ["update-ref", "refs/remotes/origin/main", "HEAD"]);
  write("stage10.txt", "local control shell\n");
  run("git", ["add", "stage10.txt"]);
  run("git", ["commit", "-q", "-m", "add local stage 10 fixture"]);

  write(
    "CHINTU_OPERATOR_STATUS.md",
    [
      "# Chintu Operator Status",
      "",
      "## 1. Repo state",
      "- Fixture state <script>alert('unsafe')</script>",
      "",
      "## 7. Next exact action",
      "- Review the generated local dashboard.",
    ].join("\n")
  );
  write(
    "CHINTU_TOMORROW_START.md",
    "# Chintu Tomorrow Start\n\n- Continue from the latest committed state.\n"
  );
  write(
    "CHINTU_CLAUDE_HANDOFF.md",
    "# Claude Handoff\n\n- Harden local scripts and documentation only.\n"
  );
  write(
    "chintu-bridge-command-center-report.md",
    "# Bridge Command Center\n\n- Shared bridge: ready for local review.\n"
  );
  write(
    path.join("CHINTU_MEMORY_VAULT", "PARKED_SYSTEMS.md"),
    [
      "# Parked Systems",
      "",
      "| System | Status | Reason |",
      "|---|---|---|",
      "| Telegram | parked | No external activation. |",
      "| Voice cloning | prohibited | Never. |",
    ].join("\n")
  );

  assert.ok(fs.existsSync(dashboardScript), "dashboard generator must exist");
  assert.ok(fs.existsSync(claudeScript), "Claude package generator must exist");

  run("powershell", [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    dashboardScript,
    "-RepoRoot",
    fixtureRoot,
  ]);

  const dashboardPath = path.join(fixtureRoot, "CHINTU_AGENT_DASHBOARD.html");
  assert.ok(fs.existsSync(dashboardPath), "dashboard must be generated");
  const dashboard = fs.readFileSync(dashboardPath, "utf8");
  for (const section of [
    "System state",
    "Latest commits",
    "Operator status",
    "Bridge state",
    "BALA safety status",
    "Parked systems",
    "Next exact action",
    "Claude overnight lane",
    "Codex lane",
    "Future Chintu Agent vision",
  ]) {
    assert.match(dashboard, new RegExp(section, "i"), `missing dashboard section: ${section}`);
  }
  assert.doesNotMatch(dashboard, /<script>alert\('unsafe'\)<\/script>/i);
  assert.match(dashboard, /&lt;script&gt;alert/i, "dynamic report text must be HTML-escaped");
  assert.doesNotMatch(dashboard, /https?:\/\//i, "dashboard must not reference remote URLs");
  assert.doesNotMatch(
    dashboard,
    /\b(fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon)\b/i,
    "dashboard must not contain network APIs"
  );
  assert.match(dashboard, /local-only/i);
  assert.match(
    dashboard,
    /does not diagnose, treat, predict, prevent, replace doctors, or provide emergency monitoring/i
  );
  assert.match(dashboard, /unpushed commits[^<]*1/i);

  run("powershell", [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    claudeScript,
    "-RepoRoot",
    fixtureRoot,
  ]);

  const promptPath = path.join(fixtureRoot, "CHINTU_CLAUDE_OVERNIGHT_PROMPT.md");
  assert.ok(fs.existsSync(promptPath), "Claude prompt must be generated");
  const prompt = fs.readFileSync(promptPath, "utf8");
  for (const required of [
    /Operator Mode/i,
    /Stage 8\/9\/10/i,
    /BALA Voice Coach enhancement plan only/i,
    /local-first and non-medical/i,
    /Do not activate external automation/i,
    /Validate and commit if safe/i,
    /Stop before push/i,
    /usage becomes low.*handoff/is,
  ]) {
    assert.match(prompt, required);
  }
  for (const protectedFile of [
    "app.js",
    "index.html",
    "styles.css",
    "sw.js",
    "coach.js",
    "manifest.webmanifest",
    "privacy.html",
    "functions/api/coach.js",
  ]) {
    assert.ok(prompt.includes(protectedFile), `Claude prompt must protect ${protectedFile}`);
  }

  for (const scriptPath of [dashboardScript, claudeScript]) {
    const source = fs.readFileSync(scriptPath, "utf8");
    assert.doesNotMatch(
      source,
      /Invoke-WebRequest|Invoke-RestMethod|Start-BitsTransfer|System\.Net|WebClient|https?:\/\//i,
      `${path.basename(scriptPath)} must remain local-only`
    );
  }

  write("scripts/chintu-validate.ps1", 'Write-Host "VERDICT: PASS"\nexit 0\n');
  write(
    "scripts/chintu-release-guard.ps1",
    'Write-Host "RECOMMENDATION: REVIEW LOCAL CHANGES"\nexit 0\n'
  );
  write(
    "scripts/chintu-bridge-command-center.ps1",
    'Write-Host "Bridge fixture: local only"\nexit 0\n'
  );
  write(
    "scripts/chintu-next-action.ps1",
    'Write-Host "NEXT ACTION: Review and commit the local control shell."\nexit 0\n'
  );
  run("powershell", [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    enddayScript,
    "-RepoRoot",
    fixtureRoot,
    "-SharedDir",
    path.join(fixtureRoot, "missing-bridge"),
  ]);
  const tomorrow = fs.readFileSync(
    path.join(fixtureRoot, "CHINTU_TOMORROW_START.md"),
    "utf8"
  );
  assert.match(tomorrow, /local Chintu OS changes.*awaiting review and commit/i);
  assert.doesNotMatch(tomorrow, /Stage 9A/i, "restart handoff must not hard-code an old stage");
  assert.match(tomorrow, /BALA app feature work without explicit founder instruction/i);
  assert.match(tomorrow, /functions\/api\/coach\.js/i);

  console.log("PASS: Chintu Agent Control Shell generators are local-only and satisfy Stage 10 contracts.");
} finally {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}
