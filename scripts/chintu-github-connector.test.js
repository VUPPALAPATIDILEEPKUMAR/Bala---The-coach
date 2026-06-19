#!/usr/bin/env node
'use strict';

const assert = require('assert');

const github = require('./chintu-github-connector.js');

function makeDeps(overrides) {
  const state = Object.assign({
    whereGh: { ok: true, exitCode: 0, stdout: 'C:\\Program Files\\GitHub CLI\\gh.exe\n', stderr: '' },
    ghAuth: { ok: true, exitCode: 0, stdout: 'github.com\n  Logged in to github.com as founder\n', stderr: '' },
    branch: { ok: true, exitCode: 0, stdout: 'main\n', stderr: '' },
    head: { ok: true, exitCode: 0, stdout: 'abc1234\n', stderr: '' },
    status: { ok: true, exitCode: 0, stdout: ' M app.js\n?? scripts/chintu-github-connector.js\n', stderr: '' },
    remote: { ok: true, exitCode: 0, stdout: 'origin\thttps://github.com/example/repo.git (fetch)\norigin\thttps://github.com/example/repo.git (push)\n', stderr: '' },
    top: { ok: true, exitCode: 0, stdout: 'C:\\Users\\Chintu\\Desktop\\test\n', stderr: '' },
    upstream: { ok: true, exitCode: 0, stdout: 'origin/main\n', stderr: '' },
    counts: { ok: true, exitCode: 0, stdout: '2\t1\n', stderr: '' },
    log: { ok: true, exitCode: 0, stdout: 'abc1234 feat: stage 31\nfff0001 feat: stage 30\n', stderr: '' },
  }, overrides || {});

  function run(cmd, args) {
    if ((cmd === 'where' || cmd === 'which') && args[0] === 'gh') return state.whereGh;
    throw new Error('unexpected run command: ' + cmd + ' ' + args.join(' '));
  }

  function runGh(args) {
    if (args.join(' ') === 'auth status') return state.ghAuth;
    throw new Error('unexpected gh command: ' + args.join(' '));
  }

  function runGit(args) {
    const key = args.join(' ');
    if (key === 'rev-parse --abbrev-ref HEAD') return state.branch;
    if (key === 'rev-parse --short HEAD') return state.head;
    if (key === 'status --short') return state.status;
    if (key === 'remote -v') return state.remote;
    if (key === 'rev-parse --show-toplevel') return state.top;
    if (key === 'rev-parse --abbrev-ref --symbolic-full-name @{upstream}') return state.upstream;
    if (key === 'rev-list --left-right --count origin/main...HEAD') return state.counts;
    if (key === 'log --oneline -5') return state.log;
    throw new Error('unexpected git command: ' + key);
  }

  return { run, runGh, runGit };
}

const env = {
  GH_TOKEN: '',
  GITHUB_TOKEN: '',
};

const status = github.runWithArgs(['--status'], env, makeDeps());
assert.equal(status.mode, 'status');
assert.equal(status.gh.installed, true);
assert.equal(status.auth.loggedIn, true);
assert.equal(status.repo.branch, 'main');
assert.equal(status.repo.dirty, true);

const noGh = github.runWithArgs(['--status'], env, makeDeps({
  whereGh: { ok: false, exitCode: 1, stdout: '', stderr: 'INFO: Could not find files' },
}));
assert.equal(noGh.gh.installed, false);
assert.match(noGh.guidance.join('\n'), /Install GitHub CLI/i);

const repoSummary = github.runWithArgs(['--repo-summary'], { GH_TOKEN: 'ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ01234' }, makeDeps());
assert.equal(repoSummary.mode, 'repo-summary');
assert.equal(repoSummary.branch, 'main');
assert.equal(repoSummary.ahead, 1);
assert.equal(repoSummary.behind, 2);
assert.doesNotMatch(JSON.stringify(repoSummary), /ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ/i);

const issuePreview = github.runWithArgs(['--issue-preview', 'Need fix', 'Body with GH_TOKEN=secret and ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ01234'], env, makeDeps());
assert.equal(issuePreview.mode, 'issue-preview');
assert.equal(issuePreview.preview.title, 'Need fix');
assert.match(issuePreview.preview.body, /\[REDACTED_TOKEN\]|\[REDACTED\]/);

const prPreview = github.runWithArgs(['--pr-preview', 'Ship stage 31', 'Summary body'], env, makeDeps());
assert.equal(prPreview.mode, 'pr-preview');
assert.equal(prPreview.repo.branch, 'main');
assert.match(prPreview.nextSafeStep, /real PR path/i);

assert.throws(
  () => github.runWithArgs(['--issue-preview', 'only-title'], env, makeDeps()),
  /requires "title" and "body"/i
);

const redacted = github.redactText('token ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ01234 GH_TOKEN=abc github_pat_abcdefghijklmnopqrstuvwxyz_1234567890');
assert.doesNotMatch(redacted, /ABCDEFGHIJKLMNOPQRSTUVWXYZ/);
assert.doesNotMatch(redacted, /GH_TOKEN=abc/);

console.log('PASS chintu-github-connector.test.js');
