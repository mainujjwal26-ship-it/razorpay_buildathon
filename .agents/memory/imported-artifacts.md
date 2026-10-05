---
name: Imported artifact registration
description: Registering artifact manifests brought in through Git.
---

After pulling an artifact from Git, check the runtime artifact inventory rather than assuming its on-disk manifest is registered.

**Why:** A valid imported web manifest did not appear in the artifact inventory or have a managed workflow until the manifest validation callback ran.

**How to apply:** Validate a temporary copy through the artifacts skill's replacement workflow, then use the newly registered managed workflow. Do not create a duplicate artifact or manually edit its manifest.
