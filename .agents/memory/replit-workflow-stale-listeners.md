---
name: Replit workflow stale listeners
description: Safely resolve port conflicts when an artifact backend workflow reports failed but an earlier process still owns its port.
---

When a backend workflow reports `EADDRINUSE`, its previous service process may still be alive even though the managed workflow is marked failed. Identify the listener by socket inode/PID, then confirm command line, working directory, cgroup, and the complete process group match only that app service. Send `SIGTERM` only to that confirmed dedicated process group, verify the port is released, and restart dependencies before their consumers. Keep the artifact's configured ports and proxy origins unless evidence shows a real mismatch.

**Why:** A failed restart can coexist with healthy listeners from an earlier workflow instance; blindly restarting repeats the conflict, while killing by port could stop an unrelated service.

**How to apply:** Before restarting a failed backend artifact workflow, inspect listeners and process ownership, distinguish stale app instances from active services, and use the exact managed workflow names for recovery.
