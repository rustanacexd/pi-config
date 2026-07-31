# Pi configuration

Personal configuration for [Pi](https://github.com/earendil-works/pi/tree/main/packages/coding-agent), including extensions, MCP servers, model defaults, and agent instructions.

The repository tracks shareable configuration only. Credentials, runtime state, generated package installs, and local skill links are excluded through [`.gitignore`](.gitignore).

## Pi packages

[`settings.json`](settings.json) is the source of truth for installed packages.

| Package | Purpose | npm |
| --- | --- | --- |
| [`pi-web-access`](https://github.com/nicobailon/pi-web-access) | Web search, content extraction, repository access, and video analysis. | [npm](https://www.npmjs.com/package/pi-web-access) |
| [`@plannotator/pi-extension`](https://github.com/backnotprop/plannotator/tree/main/apps/pi-extension) | Interactive review and annotation for plans, code, and pull requests. | [npm](https://www.npmjs.com/package/%40plannotator%2Fpi-extension) |
| [`pi-subagents`](https://github.com/nicobailon/pi-subagents) | Delegated agents, parallel workflows, chains, and background execution. | [npm](https://www.npmjs.com/package/pi-subagents) |
| [`pi-mcp-adapter`](https://github.com/nicobailon/pi-mcp-adapter) | On-demand access to Model Context Protocol servers. | [npm](https://www.npmjs.com/package/pi-mcp-adapter) |
| [`@diegopetrucci/pi-openai-fast`](https://github.com/diegopetrucci/pi-extensions/tree/main/extensions/openai-fast) | OpenAI Codex Fast mode through the priority service tier. | [npm](https://www.npmjs.com/package/%40diegopetrucci%2Fpi-openai-fast) |
| [`pi-tool-display`](https://github.com/MasuRii/pi-tool-display) | Compact tool rendering, diff visualization, and output truncation. | [npm](https://www.npmjs.com/package/pi-tool-display) |
| [`@juicesharp/rpiv-ask-user-question`](https://github.com/juicesharp/rpiv-mono/tree/main/packages/rpiv-ask-user-question) | Structured questionnaires for user decisions and clarification. | [npm](https://www.npmjs.com/package/%40juicesharp%2Frpiv-ask-user-question) |
| [`@juicesharp/rpiv-todo`](https://github.com/juicesharp/rpiv-mono/tree/main/packages/rpiv-todo) | Persistent model-managed task lists with a live overlay. | [npm](https://www.npmjs.com/package/%40juicesharp%2Frpiv-todo) |
| [`pi-btw`](https://github.com/dbachelder/pi-btw) | Parallel `/btw` side conversations backed by Pi sessions. | [npm](https://www.npmjs.com/package/pi-btw) |
| [`@injaneity/pi-computer-use`](https://github.com/injaneity/pi-computer-use) | Desktop observation and control on macOS, Windows, and Linux. | [npm](https://www.npmjs.com/package/%40injaneity%2Fpi-computer-use) |

## MCP package

[`mcp.json`](mcp.json) runs [`@playwright/mcp`](https://github.com/microsoft/playwright-mcp) for browser automation ([npm](https://www.npmjs.com/package/%40playwright%2Fmcp)). It also configures the hosted Exa Agent MCP server.

## Local extensions

- `extensions/cmux-session.ts` — bridges Pi session events and telemetry into cmux.
- `extensions/exa-code-context/` — exposes focused Exa Code Context retrieval.
- `extensions/openai-fast.json` — configures OpenAI Fast mode.
- `extensions/pi-tool-display/config.json` — configures tool rendering and output display.
