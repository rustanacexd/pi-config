---
name: browse
description: Rules for opening, reading, clicking, or closing any browser page, web or local file. Use before any browser work, and before opening a visual explainer or other HTML output for the user.
---

Use the `browse` MCP server (`execute`, `tabs`, `status`) for every page. It drives the user's real Chrome and opens `file:` URLs too. Do not use AppleScript, `open <url>`, or another browser tool. `browse` cannot open Chrome's own `chrome://` pages.

- **A page for the user to look at:** open it once with `tabs` (`action: "new"`, `keepOpen: true`) and leave it open. After a change, reload that same tab. `browse` opens tabs in the background in its own tab group, so tell the user the page is there.
- **A tab for your own work**, such as a check or a lookup: close it when you finish.
- **Visual explainers:** render with `open: false` until the page passes its check, then open it once as above.
