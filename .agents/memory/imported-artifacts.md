---
name: Imported artifact registration
description: Registering artifact manifests brought in through Git.
---

After pulling an artifact from Git, check the runtime artifact inventory rather than assuming its on-disk manifest is registered.

**Why:** A valid imported web manifest did not appear in the artifact inventory or have a managed workflow until the manifest validation callback ran.

**How to apply:** Validate a temporary copy through the artifacts skill's replacement workflow, then use the newly registered managed workflow. Do not create a duplicate artifact or manually edit its manifest.

Check production service discovery as well as preview registration when importing manifests.

**Why:** A dashboard manifest with a production build and public directory but no explicit static serving mode worked in preview, yet publishing discovered zero static frontends and the root URL returned HTTP 500 while all API endpoints worked.

**How to apply:** When preview works but the published root fails, compare frontend serving configuration with the artifact template and inspect the deployment's static/runnable discovery counts before changing backend or database code.
