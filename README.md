# Pi configuration

Personal configuration for [Pi](https://github.com/earendil-works/pi/tree/main/packages/coding-agent), including packages, MCP servers, model defaults, `pstack` role mappings, and global agent instructions.

The repository tracks configuration and local extensions. The Wondering credential setup uses macOS Keychain. Credentials (`auth.json`, `mcp-auth.json`), machine trust (`trust.json`), session transcripts (`sessions/`, `pstack/`), and generated package installs (`git/`, `npm/`) are excluded through [`.gitignore`](.gitignore).

## Bootstrap on a new machine

1. Clone this repository into `~/.pi/agent`:
   ```bash
   git clone https://github.com/rustanacexd/pi-config.git ~/.pi/agent
   ```
2. Install and reconcile configured packages from `settings.json`:
   ```bash
   pi update --extensions
   ```
3. Configure credentials:
   - Export `EXA_API_KEY` in your shell profile (`~/.zshrc`) for the Exa MCP server.
   - Launch `pi` and run `/login` to authenticate model providers.
   - Authenticate Notion through its MCP OAuth flow.
   - For Wondering, add the bearer token to macOS Keychain as a generic password with the service name `wondering-mcp`.

## Configured packages

[`settings.json`](settings.json) is the source of truth for installed packages:

| Package | Source | Purpose |
| --- | --- | --- |
| [`pstack-claude`](https://github.com/michael-denyer/pstack-claude) | `git:github.com/michael-denyer/pstack-claude` | Workflows, principles, and multi-model subagent orchestration (`poteto-mode`, `architect`, `arena`, `interrogate`, `how`, `why`, etc.). |
| [`@plannotator/pi-extension`](https://github.com/backnotprop/plannotator/tree/main/apps/pi-extension) | `npm:@plannotator/pi-extension` | Interactive review and annotation for plans, code diffs, and pull requests. |
| [`effective-html`](https://github.com/plannotator/effective-html) | `git:github.com/plannotator/effective-html` | Skills for self-contained HTML artifacts, diagrams, plans, prototypes, and wireframes. |
| [`@calesennett/pi-codex-fast`](https://pi.dev/packages/@calesennett/pi-codex-fast) | `npm:@calesennett/pi-codex-fast` | Fast (`priority`) and Ultrafast (`ultrafast`) service tiers for OpenAI and ChatGPT Codex models (`/codex-fast`, `/codex-ultrafast`, `--fast`, `--ultrafast`). |

## Model defaults

[`settings.json`](settings.json) selects Anthropic `claude-opus-5-5` with medium thinking by default. The enabled model list includes Opus, Sonnet, Fable, and two OpenAI models. Per-model thinking levels and compaction reserves are configured in the same file. Codex Fast is enabled in `ultrafast` mode.

[`models.json`](models.json) keeps a 65,536-token output override for Google `gemini-4-argon`. It no longer redirects Anthropic requests to a local proxy.

## MCP servers

[`mcp.json`](mcp.json) configures these servers:

| Server | Connection and credentials |
| --- | --- |
| Exa | Remote MCP with a bearer token resolved from `$EXA_API_KEY` through a login shell. |
| Notion | Remote MCP with OAuth. |
| Wondering | Remote MCP for learning history, courses, and lessons. Reads its bearer token from the macOS Keychain service `wondering-mcp`. |
