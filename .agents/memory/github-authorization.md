---
name: GitHub authorization boundaries
description: Distinguish Agent's GitHub connector authorization from Git tool authentication.
---

Agent's GitHub connector authorization does not necessarily authenticate Git CLI pushes.

**Why:** An authenticated Git push failed while writes through the authorized GitHub API connection succeeded.

**How to apply:** Use the connector for Agent API operations. For regular Git pushes, verify the Git tool's GitHub authorization separately; never ask for tokens in chat.
