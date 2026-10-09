---
name: Default microphone behavior
description: User-required unmuted-by-default microphone interaction for calls.
---

Each call must start with a green, unmuted microphone button. Clicking it turns it red and mutes voice input; clicking again enables it.

**Why:** The user explicitly changed the requirement to "keep the mic unmuted by default".

**How to apply:** Preserve this interaction for initial and restarted calls. Prepare audio input during the Start call click; browser microphone permission is still required.
