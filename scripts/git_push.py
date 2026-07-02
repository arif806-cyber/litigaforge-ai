#!/usr/bin/env python3
"""Push current main branch to origin/feature/arifbase."""
import os
import subprocess

def run(cmd: list, cwd: str = "/home/runner/workspace") -> tuple[int, str, str]:
    """Run a command without a shell to prevent shell injection."""
    result = subprocess.run(
        cmd,
        shell=False,  # Never use shell=True with dynamic values
        cwd=cwd,
        capture_output=True,
        text=True,
        env={**os.environ, "GIT_TERMINAL_PROMPT": "0"},
    )
    return result.returncode, result.stdout, result.stderr

# Remove stale locks
for lock in [".git/config.lock", ".git/index.lock"]:
    try:
        os.remove(f"/home/runner/workspace/{lock}")
        print(f"Removed {lock}")
    except FileNotFoundError:
        pass

# Set remote URL with token (token from env var only, never interpolated via shell)
token = os.environ.get("GITHUB_TOKEN", "")
if not token:
    print("ERROR: GITHUB_TOKEN not set — cannot push to remote")
    raise SystemExit(1)

remote_url = f"https://{token}@github.com/arif806-cyber/litigaforge-ai.git"
rc, out, err = run(["git", "remote", "set-url", "origin", remote_url])
print(f"Set remote: rc={rc}")
if err:
    print("stderr:", err)

# Push
rc, out, err = run(["git", "push", "origin", "main:feature/arifbase", "--force-with-lease"])
print(f"Push rc={rc}")
print("stdout:", out)
if err:
    print("stderr:", err)

# Verify
rc, out, err = run(["git", "log", "origin/feature/arifbase", "--oneline", "-1"])
print(f"Verify rc={rc}")
print("Remote HEAD:", out.strip())
