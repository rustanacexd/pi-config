# Pi configuration

Personal configuration for [Pi](https://github.com/earendil-works/pi/tree/main/packages/coding-agent), including packages, MCP servers, model defaults, `pstack` role mappings, and global agent instructions.

The repository tracks shareable configuration only. Credentials (`auth.json`, `mcp-auth.json`), machine trust (`trust.json`), session transcripts (`sessions/`, `pstack/`), and generated package installs (`git/`, `npm/`) are excluded through [`.gitignore`](.gitignore).

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
   - Launch `pi` and run `/login` to authenticate model providers and OAuth MCP servers (such as Notion).

## Configured packages

[`settings.json`](settings.json) is the source of truth for installed packages:

| Package | Source | Purpose |
| --- | --- | --- |
| [`pstack-claude`](https://github.com/michael-denyer/pstack-claude) | `git:github.com/michael-denyer/pstack-claude` | Workflows, principles, and multi-model subagent orchestration (`poteto-mode`, `architect`, `arena`, `interrogate`, `how`, `why`, etc.). |
| [`@plannotator/pi-extension`](https://github.com/backnotprop/plannotator/tree/main/apps/pi-extension) | `npm:@plannotator/pi-extension` | Interactive review and annotation for plans, code diffs, and pull requests. |
| [`visual-explainer`](https://github.com/nicobailon/visual-explainer) | `git:github.com/nicobailon/visual-explainer` | Self-contained HTML visual explanations, diagrams, diff/plan reviews, and slide decks. |
| [`@calesennett/pi-codex-fast`](https://pi.dev/packages/@calesennett/pi-codex-fast) | `npm:@calesennett/pi-codex-fast` | Fast (`priority`) and Ultrafast (`ultrafast`) service tiers for OpenAI and ChatGPT Codex models (`/codex-fast`, `/codex-ultrafast`, `--fast`, `--ultrafast`). |

## Tracked files

- [`AGENTS.md`](AGENTS.md) — Global instructions for skill routing, T3 Code delegation, Exa search routing, and `gcloud` usage.
- [`settings.json`](settings.json) — Default model/provider, compaction token overrides, and package declarations.
- [`pstack-models.md`](pstack-models.md) — Per-role model and reasoning effort overrides for `pstack`.
- [`models.json`](models.json) — Provider endpoint configuration and model token overrides.
- [`mcp.json`](mcp.json) — Global MCP servers (`exa` with shell-resolved `$EXA_API_KEY` and `notion` via OAuth).
- [`skills/`](skills/) — Split `visual-explainer-*` command skills that delegate to the installed `visual-explainer` package.
