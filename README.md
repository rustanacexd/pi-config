# Pi configuration

My personal [Pi](https://github.com/earendil-works/pi) setup. Git tracks the settings, local extensions, and a few local skills. Pi installs everything else from the packages listed in [`settings.json`](settings.json).

Credentials, project trust, sessions, caches, and downloaded packages stay on the machine. See [`.gitignore`](.gitignore).

## What's tracked

| Path | Purpose |
| --- | --- |
| [`settings.json`](settings.json) | Default model and thinking level, enabled models, packages, compaction, and pi-tidy display settings. |
| [`pstack-models.md`](pstack-models.md) | The model and effort for each pstack role. |
| [`AGENTS.md`](AGENTS.md) | Global instructions for every session. |
| [`cliproxyapi.json`](cliproxyapi.json) | CLIProxyAPI provider settings. |
| [`web-search.json`](web-search.json) | pi-web-access settings. The Exa key comes from `EXA_API_KEY`. |
| [`mcp-adapter.json`](mcp-adapter.json) | MCP servers for pi-mcp-adapter. Only Notion is configured. |
| [`models.json`](models.json) | Custom providers. Empty. |
| [`extensions/`](extensions) | Local extensions. See [Local extensions](#local-extensions). |
| [`skills/`](skills) | Local skills. See [Local skills](#local-skills). |
| [`scripts/skill-sync`](scripts/skill-sync) | Adds skills installed with `npx skills` to `settings.json`. See [Maintain the setup](#maintain-the-setup). |
| `install/` | Metadata for Pi's managed install, which is on 1.5.2. |

## Models

Every model call goes through [CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI), which runs locally at `http://127.0.0.1:8317`. The `@router-for-me/pi-cliproxyapi-provider` package registers the `cliproxyapi` provider. Its `tps.ts` extension is excluded.

- The default model is `cliproxyapi/claude-opus-5-5` with `high` thinking.
- The model picker cycles between Opus 5.5 and Fable 5.2.
- Compaction reserves 500k tokens for both models.
- pstack runs its roles on Opus and Fable, as set in `pstack-models.md`.
- `session-title.ts` names sessions with `claude-haiku-5-5`. If Haiku is unavailable, it uses the current model.

## Packages

| Package | Provides |
| --- | --- |
| `michael-denyer/pstack-claude` | pstack skills, subagents, and the `/poteto-mode` workflow. |
| `@router-for-me/pi-cliproxyapi-provider` | The `cliproxyapi` model provider. |
| `pi-web-access` | Web search, source checks, and page, PDF, repository, and video fetching. |
| `pi-mcp-adapter` | MCP client. It reads `mcp-adapter.json`. Pi's built-in MCP is turned off with `-builtin:mcp`. |
| `@plannotator/pi-extension` | Plan mode and browser review of plans, files, and diffs. |
| `pi-btw` | `/btw` side conversations while the main agent works. |
| `pi-rewind-hook` | Automatic git checkpoints, with file and conversation restore. |
| `pi-tidy` | Folds each reply's tool calls into one line. User message and final reply frames are off. |

The other `packages` entries in `settings.json` provide skills only. Their `skills` filter lists the skills Pi loads, and their extensions, prompts, and themes are turned off.

## Local extensions

| File | What it does |
| --- | --- |
| `session-title.ts` | Names each session after its first task. The terminal tab shows the name. A name set with `/name` is kept. |
| `message-spacing.ts` | Adds a blank line under each user message. |
| `rex-session-start.ts` | Adds Rex's session-start instructions to the system prompt. Rex has no Pi hook, so this extension runs the same command. |
| `rexume.ts` | Reports each session to rexume and delivers messages from its inbox. `rexume install` writes this file and the rexume daemon keeps it current. |
| `worktrunk.ts` | Shows agent activity markers in `wt list`. `wt config plugins pi install` writes this file. |

## Local skills

`skills/` holds only skills that have no upstream package to update from:

- `rex` is a stub from `rex skill setup`. It loads its guide from the installed Rex CLI.
- `show-me`, `big-pics-little-words`, and `worktrunk` are copies with local edits.

[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) lists the source and edits of each copy.

## Set up another machine

1. Install Pi. It needs Node.js 22.19 or newer.

   ```sh
   curl -fsSL https://pi.dev/install.sh | sh
   ```

2. If `~/.pi/agent` exists, move it aside first. Keep its credential and session files private.

   ```sh
   git clone https://github.com/rustanacexd/pi-config.git ~/.pi/agent
   ```

3. Run CLIProxyAPI on port 8317. Make sure its API key matches `apiKey` in `cliproxyapi.json`.

4. Set `EXA_API_KEY` in the shell that launches Pi.

5. Launch `pi`. On first launch, Pi installs the packages in `settings.json`.

6. Sign in to Notion with `/mcp-auth notion`.

7. Run `pi list` to check the installed packages.

## Maintain the setup

- Run `pi update --extensions` to update every package. Package sources are unpinned, so an update can change versions. Pull this repository on each machine to sync the settings.
- Install skills with `npx skills add owner/repo`, then run `scripts/skill-sync`. It prints what Pi is missing. `scripts/skill-sync --apply` adds each skill to its repository's `skills` filter in `settings.json` and clones what Pi needs. Commit `settings.json`, then run `/reload` in open Pi sessions.
- After `npx skills remove`, run `scripts/skill-sync --apply --prune` on the same machine to drop the removed names. The command never removes anything without `--prune`, because `settings.json` is shared and the npx skills lock file is per machine.
- `scripts/skill-sync` also reports `drift` when a copy in `skills/` differs from its twin in `~/.agents/skills`, for example after `npx skills update`. Compare the two with the printed `diff` command and merge by hand.
- To add a skill by hand, add a package to `settings.json` with a `skills` filter. Set `extensions`, `prompts`, and `themes` to `[]` for a skill-only package.
- Copy a skill into `skills/` only when you edit it, and record the copy in `THIRD_PARTY_NOTICES.md`.
- `settings.json` excludes `~/.agents/skills`, so only this setup loads globally. A project's `.agents/skills/` still loads. Keep project-specific skills there.
- Keep credentials in environment variables, `auth.json`, and `mcp-auth.json`. Never commit them.

## Optional tools

Skills do not install the tools they describe. Install and sign in to the ones you use.

| Skills or extensions | Needs |
| --- | --- |
| `rex`, `rex-session-start.ts` | Rex and its CLI. |
| `rexume.ts` | The `rexume` CLI and daemon. |
| `worktrunk`, `worktrunk.ts` | Worktrunk's `wt` CLI. |
| `agent-browser`, `agent-desktop` | The matching automation CLI. |
| `gh`, `gh-stack` | GitHub CLI. `gh-stack` also needs Git 2.36 or newer and the `github/gh-stack` extension. |
| `gcloud` | Google Cloud CLI. |
| Plannotator, effective-html | A browser. |
