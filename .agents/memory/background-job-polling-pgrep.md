---
name: Background-job polling self-match gotcha
description: Why pgrep/pkill -f over a background script can give false "running" and kill your own shell
---

When you launch a detached background job (e.g. `nohup python my_script.py &`) and
then poll it with `pgrep -f my_script.py` (or stop it with `pkill -f my_script.py`),
the `-f` pattern matches **the full command line of your own poll/kill shell**,
because that command line literally contains the pattern string.

Symptoms seen in practice:
- `pgrep -f <name>` always reports a match → endless false "STILL RUNNING", even
  after the real job has exited/hung. Each poll returns a *different* PID (your new
  poll shell), which is the tell.
- `pkill -f <name>` exits **143** (128+SIGTERM): it SIGTERMs every match including
  its own shell, so the command dies before later steps (DB query, `rm`) run.
- The classic `grep '[x]name'` bracket trick still fails if the **same command** also
  references the filename elsewhere (e.g. a later `ls my_script.py`), since that
  second literal reintroduces the matchable substring.

**Why:** `-f` matches against `/proc/<pid>/cmdline`, and your interactive `bash -c`
runs with the whole script (pattern included) as its argv.

**How to apply:**
- Capture the PID at launch: `nohup python my_script.py & echo $!`, then poll/kill by
  PID (`kill <pid>`, `kill -0 <pid>` to test liveness) — never by `-f` name.
- Or match a string that is NOT present anywhere else in the poll command, and keep
  every other reference (ls/tail/rm) in a *separate* command.
- Treat a *changing* PID across polls as proof you're matching your own shell, not the job.
