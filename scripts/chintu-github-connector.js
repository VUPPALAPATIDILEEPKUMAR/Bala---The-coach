#!/usr/bin/env node
'use strict';

const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const MAX_OUTPUT_CHARS = 4000;

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const part = argv[i];
    if (!part.startsWith('--')) {
      args._.push(part);
      continue;
    }
    const eq = part.indexOf('=');
    if (eq !== -1) {
      args[part.slice(2, eq)] = part.slice(eq + 1);
      continue;
    }
    const key = part.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    i++;
  }
  return args;
}

function redactText(value) {
  let text = String(value == null ? '' : value);
  text = text.replace(/\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, '[REDACTED_TOKEN]');
  text = text.replace(/\bgithub_pat_[A-Za-z0-9_]{20,}\b/g, '[REDACTED_TOKEN]');
  text = text.replace(/\b\d{6,}:[A-Za-z0-9_-]{20,}\b/g, '[REDACTED_TOKEN]');
  text = text.replace(/\b(GH_TOKEN|GITHUB_TOKEN)\s*[=:]\s*\S+/gi, '$1=[REDACTED]');
  return text;
}

function clampText(value) {
  const text = redactText(value);
  if (text.length <= MAX_OUTPUT_CHARS) return text;
  return text.slice(0, MAX_OUTPUT_CHARS) + '\n...[truncated ' + (text.length - MAX_OUTPUT_CHARS) + ' chars]';
}

function run(cmd, args, cwd) {
  try {
    const result = spawnSync(cmd, args, {
      cwd: cwd || repoRoot,
      encoding: 'utf8',
      shell: false,
      windowsHide: true,
      timeout: 30000,
      maxBuffer: 8 * 1024 * 1024,
    });
    return {
      ok: result.status === 0 && !result.error,
      exitCode: result.status == null ? -1 : result.status,
      stdout: clampText(result.stdout || ''),
      stderr: clampText(result.stderr || (result.error ? String(result.error.message || result.error) : '')),
    };
  } catch (error) {
    return {
      ok: false,
      exitCode: -1,
      stdout: '',
      stderr: clampText(error && error.message ? error.message : String(error)),
    };
  }
}

function runGit(args) {
  return run('git', args, repoRoot);
}

function runGh(args) {
  return run('gh', args, repoRoot);
}

function trimLines(text) {
  return String(text || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function detectGitHubEnv(env) {
  return {
    ghTokenPresent: Boolean(String(env.GH_TOKEN || '').trim()),
    githubTokenPresent: Boolean(String(env.GITHUB_TOKEN || '').trim()),
  };
}

function detectGhCli(deps) {
  const whereCmd = process.platform === 'win32' ? 'where' : 'which';
  const found = deps.run(whereCmd, ['gh'], repoRoot);
  if (!found.ok) {
    return {
      installed: false,
      pathHint: null,
      guidance: 'Install GitHub CLI from https://cli.github.com/ and confirm `gh --version` works locally.',
    };
  }
  const first = trimLines(found.stdout)[0] || null;
  return {
    installed: true,
    pathHint: first ? redactText(first) : null,
    guidance: null,
  };
}

function detectAuthStatus(env, deps, ghInfo) {
  const envState = detectGitHubEnv(env);
  if (!ghInfo.installed) {
    return {
      checked: false,
      cliInstalled: false,
      envState,
      summary: 'gh CLI not installed',
    };
  }
  const auth = deps.runGh(['auth', 'status'], repoRoot);
  const text = [auth.stdout, auth.stderr].filter(Boolean).join('\n');
  const lines = trimLines(text);
  const loggedIn = auth.ok && /logged in to github\.com/i.test(text);
  return {
    checked: true,
    cliInstalled: true,
    envState,
    exitCode: auth.exitCode,
    loggedIn,
    summary: loggedIn ? 'gh auth status reports a logged-in session.' : 'gh auth status did not confirm a logged-in session.',
    detailLines: lines.slice(0, 6),
  };
}

function detectRepoState(deps) {
  const branchRes = deps.runGit(['rev-parse', '--abbrev-ref', 'HEAD'], repoRoot);
  const headRes = deps.runGit(['rev-parse', '--short', 'HEAD'], repoRoot);
  const statusRes = deps.runGit(['status', '--short'], repoRoot);
  const remoteRes = deps.runGit(['remote', '-v'], repoRoot);
  const topRes = deps.runGit(['rev-parse', '--show-toplevel'], repoRoot);
  const upstreamRes = deps.runGit(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'], repoRoot);
  const logRes = deps.runGit(['log', '--oneline', '-5'], repoRoot);

  let ahead = null;
  let behind = null;
  const upstream = trimLines(upstreamRes.stdout)[0] || null;
  if (upstream) {
    const counts = deps.runGit(['rev-list', '--left-right', '--count', upstream + '...HEAD'], repoRoot);
    const match = counts.stdout.match(/(\d+)\s+(\d+)/);
    if (match) {
      behind = Number(match[1]);
      ahead = Number(match[2]);
    }
  }

  const remotes = trimLines(remoteRes.stdout).map((line) => {
    const parts = line.split(/\s+/);
    return {
      name: parts[0] || '',
      target: redactText(parts[1] || ''),
      kind: parts[2] || '',
    };
  });

  return {
    repoDetected: topRes.ok,
    repoRoot: trimLines(topRes.stdout)[0] || repoRoot,
    branch: trimLines(branchRes.stdout)[0] || '(unknown)',
    head: trimLines(headRes.stdout)[0] || '(unknown)',
    dirty: Boolean(trimLines(statusRes.stdout).length),
    statusShort: trimLines(statusRes.stdout),
    remotes,
    upstream,
    ahead,
    behind,
    recentCommits: trimLines(logRes.stdout),
  };
}

function buildSetupGuidance(ghInfo, auth) {
  const lines = [];
  if (!ghInfo.installed) {
    lines.push(ghInfo.guidance);
  } else if (!auth.loggedIn) {
    lines.push('Run `gh auth login` locally or provide GH_TOKEN / GITHUB_TOKEN in your shell if you want gh-authenticated summaries later.');
  } else {
    lines.push('gh CLI is available and appears authenticated for dry-run summaries.');
  }
  lines.push('This connector never creates issues, PRs, or pushes. Preview commands only.');
  return lines;
}

function makeStatus(env, deps) {
  const ghInfo = detectGhCli(deps);
  const auth = detectAuthStatus(env, deps, ghInfo);
  const repo = detectRepoState(deps);
  return {
    ok: true,
    mode: 'status',
    safety: 'dry-run only',
    gh: ghInfo,
    auth,
    repo,
    guidance: buildSetupGuidance(ghInfo, auth),
  };
}

function makeRepoSummary(env, deps) {
  const status = makeStatus(env, deps);
  const remote = status.repo.remotes.find((item) => item.name === 'origin' && item.kind === '(fetch)') || status.repo.remotes[0] || null;
  return {
    ok: true,
    mode: 'repo-summary',
    safety: 'dry-run only',
    branch: status.repo.branch,
    head: status.repo.head,
    dirty: status.repo.dirty,
    changedFiles: status.repo.statusShort,
    remote: remote,
    upstream: status.repo.upstream,
    ahead: status.repo.ahead,
    behind: status.repo.behind,
    recentCommits: status.repo.recentCommits,
    ghInstalled: status.gh.installed,
    ghAuthSummary: status.auth.summary,
    guidance: buildSetupGuidance(status.gh, status.auth),
  };
}

function makePreview(kind, title, body, env, deps) {
  const repo = detectRepoState(deps);
  const ghInfo = detectGhCli(deps);
  const auth = detectAuthStatus(env, deps, ghInfo);
  return {
    ok: true,
    mode: kind,
    safety: 'preview only - nothing created',
    preview: {
      title: redactText(title),
      body: redactText(body),
      titleLength: String(title || '').length,
      bodyLength: String(body || '').length,
    },
    repo: {
      branch: repo.branch,
      head: repo.head,
      dirty: repo.dirty,
      changedFiles: repo.statusShort,
      upstream: repo.upstream,
      ahead: repo.ahead,
      behind: repo.behind,
    },
    gh: {
      installed: ghInfo.installed,
      authSummary: auth.summary,
    },
    nextSafeStep: kind === 'issue-preview'
      ? 'Review the preview text locally. If you later want a real issue path, add a separate approval-gated stage.'
      : 'Review the preview text locally. If you later want a real PR path, add a separate approval-gated stage.',
  };
}

function printUsage() {
  console.log('Chintu GitHub connector');
  console.log('');
  console.log('Dry-run commands:');
  console.log('  node scripts/chintu-github-connector.js --status');
  console.log('  node scripts/chintu-github-connector.js --repo-summary');
  console.log('  node scripts/chintu-github-connector.js --issue-preview "title" "body"');
  console.log('  node scripts/chintu-github-connector.js --pr-preview "title" "body"');
  console.log('');
  console.log('This connector never creates issues, PRs, or pushes.');
}

function runWithArgs(argv, env, deps) {
  const args = parseArgs(argv);
  if (args.help || args.h || (Object.keys(args).length === 1 && args._.length === 0)) {
    return { ok: true, mode: 'help' };
  }
  if (args.status) {
    return makeStatus(env, deps);
  }
  if (args['repo-summary']) {
    return makeRepoSummary(env, deps);
  }
  if (args['issue-preview']) {
    const title = args['issue-preview'] === true ? args._[0] : args['issue-preview'];
    const body = args['issue-preview'] === true ? args._[1] : args._[0];
    if (!title || !body) {
      throw new Error('--issue-preview requires "title" and "body".');
    }
    return makePreview('issue-preview', title, body, env, deps);
  }
  if (args['pr-preview']) {
    const title = args['pr-preview'] === true ? args._[0] : args['pr-preview'];
    const body = args['pr-preview'] === true ? args._[1] : args._[0];
    if (!title || !body) {
      throw new Error('--pr-preview requires "title" and "body".');
    }
    return makePreview('pr-preview', title, body, env, deps);
  }
  throw new Error('Choose one command: --status, --repo-summary, --issue-preview, or --pr-preview.');
}

function main() {
  const deps = {
    run,
    runGit,
    runGh,
  };
  const result = runWithArgs(process.argv.slice(2), process.env, deps);
  if (result.mode === 'help') {
    printUsage();
    return;
  }
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error('FAIL: ' + redactText(error && error.message ? error.message : String(error)));
    process.exit(1);
  }
}

module.exports = {
  parseArgs,
  redactText,
  runWithArgs,
  detectGhCli,
  detectAuthStatus,
  detectRepoState,
};
