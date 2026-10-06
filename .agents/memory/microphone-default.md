---
name: Default microphone behavior
description: User-required muted-by-default microphone interaction for calls.
---

Each call must start with a red, muted microphone button. Clicking it turns it green and enables voice input; clicking again mutes it.

**Why:** The user explicitly requested this default, rather than automatic microphone activation.

**How to apply:** Preserve this interaction for initial and restarted calls. Do not enable microphone capture before the user unmutes it.
