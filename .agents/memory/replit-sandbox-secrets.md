---
name: Replit secrets not in code_execution sandbox
description: Where Replit secrets are (and aren't) readable across the agent's execution surfaces.
---

# Reading Replit secret VALUES at runtime

Replit secrets are **NOT** injected into the `code_execution` (JS notebook) sandbox: `globalThis.process.env` is `undefined` there, and `node:process`'s `env` exists but does **not** contain the secrets. `viewEnvVars({type:"secret"})` only confirms a secret EXISTS (boolean), never its value.

**Where the value IS readable:** the **bash tool** environment. A secret like `GITHUB_PERSONAL_ACCESS_TOKEN1` is present in bash as `$VAR` / Python `os.environ[...]`. So to *use* a secret value programmatically, run the script through the **bash tool** (e.g. a `python3`/`curl` script that reads the env var), not through `code_execution`.

**Never print the value.** Reference it only by env-var name inside the script; print only safe derived info (length, HTTP status, API login/scopes, commit URLs).

**Why:** burned ~2 attempts doing `process.env.X` in `code_execution` (undefined); the bash route worked first try.
**How to apply:** read-only API calls to public resources → either surface; anything needing a secret credential → bash tool.
