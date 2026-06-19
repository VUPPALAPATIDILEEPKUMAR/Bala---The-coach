# Chintu GitHub Connector Dry Run - Stage 31

This is the first GitHub connector lane for Chintu. It is dry-run only.

## Commands

```bash
node scripts/chintu-github-connector.js --status
node scripts/chintu-github-connector.js --repo-summary
node scripts/chintu-github-connector.js --issue-preview "title" "body"
node scripts/chintu-github-connector.js --pr-preview "title" "body"
```

## What it does

- Detects whether `gh` CLI is installed.
- Detects local repo state from `git`.
- Detects auth status with `gh auth status` only if `gh` exists.
- Detects whether `GH_TOKEN` or `GITHUB_TOKEN` is present without printing it.
- Redacts token-shaped strings from output.
- Prepares issue/PR previews without creating anything.

## What it never does in Stage 31

- No GitHub issue creation
- No GitHub PR creation
- No git push
- No secret printing
- No paid API usage

## Safe guidance

If `gh` is unavailable, install GitHub CLI locally and confirm:

```bash
gh --version
```

If `gh` is available but not authenticated, use one of:

- `gh auth login`
- local shell env with `GH_TOKEN`
- local shell env with `GITHUB_TOKEN`

The connector only detects whether those env vars exist. It never prints token
values.
