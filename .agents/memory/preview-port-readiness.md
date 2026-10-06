---
name: Preview port readiness
description: Workflow restart success can mask an older Vite server still serving the preview.
---

A successful dashboard workflow restart does not by itself prove that the intended preview port is served by the restarted process. An older pnpm/Vite process can remain alive, causing a new Vite instance to silently select the next port.

**Why:** After a restart, two dashboard instances were running: the older instance held the intended preview port, while the newer instance reported readiness on a different port.

**How to apply:** Keep strict port binding enabled and check the intended port and serving process when preview behavior differs from a fresh browser test. Do not treat a fallback-port readiness message as successful preview recovery.
