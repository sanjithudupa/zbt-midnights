# AGENTS.md

This file defines required execution workflows for Codex in this repository.

## Quick Checklist

### New issue -> PR
1. `git fetch --all --prune`
2. `git checkout main`
3. `git pull --ff-only origin main`
4. `git checkout -b codex/issue-<number>-<slug>`
5. Implement issue
6. `npm run build`
7. Commit + push
8. Open PR to `main`
9. Comment on PR: summary + "awaiting review"
10. End PR comment with:
    - `- sanjith codex issue triage workflow`

### PR feedback -> updated PR
1. Identify PR + head branch
2. `git fetch --all --prune`
3. `git checkout <head-branch>`
4. `git pull --ff-only origin <head-branch>`
5. Apply requested fixes
6. `npm run build`
7. Commit + push
8. Comment on PR: fixes summary + "ready for review again"
9. End PR comment with:
   - `- sanjith codex issue triage workflow`

## Global Rules

1. Always start from the latest `main` before beginning a new issue workflow.
2. Use non-interactive git commands only.
3. Run project validation before opening or updating a PR:
   - `npm run build`
4. Never post PR comments as if they were authored directly by the user.
5. Every PR comment/reply posted by Codex must end with this exact suffix on its own line:
   - `- sanjith codex issue triage workflow`

## Workflow 1: Implement Issue and Open PR

Use this workflow when the user provides an issue number or issue URL and asks Codex to handle it end-to-end.

### Inputs
- Issue reference:
  - Number (example: `5`)
  - URL (example: `https://github.com/<owner>/<repo>/issues/5`)

### Required Steps
1. Parse the issue number from the provided number/link.
2. Ensure local repo is clean enough to proceed (do not discard unrelated user work).
3. Fetch latest refs and update local `main` to match remote:
   - `git fetch --all --prune`
   - `git checkout main`
   - `git pull --ff-only origin main`
4. Create a new branch from updated `main` with `codex/` prefix:
   - Suggested format: `codex/issue-<number>-<short-slug>`
5. Implement the issue completely.
6. Run validation (`npm run build`) and resolve failures.
7. Commit with a clear message.
8. Push the branch to origin and set upstream.
9. Create a PR targeting `main` and include:
   - Summary of changes
   - Validation performed
   - `Closes #<issue-number>` when appropriate
10. Post a PR comment stating work is complete and awaiting review, ending with:
   - `- sanjith codex issue triage workflow`
11. Report back to the user with PR link and status.

## Workflow 2: Address PR Review Comments and Re-Request Review

Use this workflow when the user asks Codex to address feedback on an existing PR (by context or PR number/link).

### Inputs
- PR reference from:
  - Current context, or
  - PR number, or
  - PR URL

### Required Steps
1. Identify the target PR and associated head branch.
2. If not currently on the PR branch, switch to it:
   - `git fetch --all --prune`
   - `git checkout <pr-head-branch>`
   - `git pull --ff-only origin <pr-head-branch>`
3. Retrieve review feedback/comments from the PR.
4. Implement all requested fixes.
5. Run validation (`npm run build`) and resolve failures.
6. Commit and push updates to the same PR branch.
7. Post a follow-up PR comment summarizing what was fixed and that it is ready for review again, ending with:
   - `- sanjith codex issue triage workflow`
8. Report back to the user with a concise update.

## PR Comment Templates

Use these as defaults and adapt as needed.

### Initial completion comment
Implemented the requested issue updates in this PR. Summary:
- <change 1>
- <change 2>
- Validation: `npm run build`

Ready for your review.

- sanjith codex issue triage workflow

### Follow-up after review feedback
Addressed the requested PR feedback. Summary:
- <fix 1>
- <fix 2>
- Validation: `npm run build`

Ready for review again.

- sanjith codex issue triage workflow
