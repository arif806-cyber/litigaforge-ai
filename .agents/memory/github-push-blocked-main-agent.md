---
name: GitHub push blocked for main agent
description: The main agent cannot run local git writes; syncing to the GitHub origin must go through a background Project Task. Origin was found stale since 2026-05-24.
---

# Main agent is hard-blocked from local git writes; GitHub sync needs a background Project Task

**Rule:** As the main agent, local git WRITE operations are hard-blocked by the
platform. `git add` / `git commit` / `git push` / `reset` / etc. return:
`"Destructive git operations are not allowed in the main agent. Use the
project_tasks skill to propose a new background Project Task that will perform
this git operation instead."` Read-only git is fine
(`git --no-optional-locks status|log|rev-parse|merge-base|cat-file`,
`git fetch`).

**Why:** Platform safety. Only background Project Task agents (isolated envs)
may perform git write/push operations.

**Consequence found (2026-06-13):** `origin/feature/arifbase` on GitHub
(`arif806-cyber/litigaforge-ai`) was stale at `fcbb9da` (2026-05-24). Local was
strictly AHEAD — `fcbb9da` is an ancestor of local HEAD and equals the
merge-base, i.e. a clean **fast-forward** (~245 commits). Everything since late
May (about/contact pages, AdSense, blog pipeline, demand-letter MoR tool) was
NOT on GitHub because main-agent pushes are silently blocked. The deployed app
builds from the **Replit workspace, not GitHub**, so the live app was
unaffected.

**How to apply:**
- To honor the "save all work to GitHub" preference, do NOT attempt local git
  and do NOT hand-roll a full-tree GitHub REST API sync (the diff since May
  spans hundreds/thousands of objects incl. `dist/` binaries + deletions —
  impractical and risky to the repo tree).
- Instead, in **Plan mode** create a background Project Task whose job is
  `git push origin feature/arifbase` (clean fast-forward; **non-force**). The
  task agent can run git writes.
- Token: `GITHUB_PERSONAL_ACCESS_TOKEN_NOEXPIRE` is valid. For the REST API use
  `Authorization: Bearer <token>`. For git-over-HTTPS use **Basic** auth (token
  as password / `x-access-token:<token>`), NOT `Bearer` (Bearer returns
  "invalid credentials" for git).
- The `replit.md` note that says "use the PAT via bash to push" is stale — that
  path no longer works from the main agent.
