# Pi configuration

Personal [Pi](https://github.com/earendil-works/pi) setup. Git tracks the configuration, local extensions, and a few local skills. Pi manages the packages declared in [`settings.json`](settings.json), including every skill that comes from another repository.

Credentials, machine trust, sessions, caches, and downloaded packages stay local. See [`.gitignore`](.gitignore).

## Set up another machine

1. Install Node.js 22.19 or newer and Pi:

   ```sh
	npm install -g --ignore-scripts @earendil-works/pi-coding-agent
   ```

2. If `~/.pi/agent` already exists, move it aside as a backup before cloning. Keep its credential and session files private.

   ```sh
	git clone https://github.com/rustanacexd/pi-config.git ~/.pi/agent
   ```

3. Launch `pi`. On its first launch, Pi installs the packages declared in `settings.json`. Use `/login` for built-in model providers and `/mcp login notion` for Notion. Configure custom providers separately on each machine.

4. Run `pi list` to inspect the installed packages and `pi mcp list` to check enabled MCP connections. Use `pi --verbose` to inspect startup diagnostics despite the configured quiet startup.

The default model and thinking settings live in `settings.json`. [`pstack-models.md`](pstack-models.md) configures pstack's agent roles. Provider access is configured separately on each machine.

## Maintain the setup

- Run `pi update --extensions` to update every skill and extension. Package sources in `settings.json` are unpinned, so updates can change installed versions. Pull this repository on each machine to sync configuration.
- Add a skill from another repository as a package in `settings.json`. Use the package's `skills` filter to load only the skills you want, and set `extensions`, `prompts`, and `themes` to `[]` for skill-only sources.
- [`skills/`](skills) holds only skills with nothing upstream to update: the `rex` and Orca stubs, which load their guides from the installed CLI, and `show-me`, `big-pics-little-words`, and `worktrunk`, which carry local edits.
- `settings.json` excludes `~/.agents/skills` so Pi loads only this setup. Project `.agents/skills/` directories still load.
- Keep project-specific skills in that project's `.agents/skills/`, not in this global setup.
- Keep credentials in local environment variables, `auth.json`, and `mcp-auth.json`. Never commit them.

## Optional tools

Skill instructions do not install the tools they describe. Install and authenticate only the tools you use:

| Skills or extensions | Requirement |
| --- | --- |
| Orca skills and local Orca extensions | Orca and its CLI for the relevant platform. |
| `rex` and the local Rex extension | Rex and its CLI. |
| `agent-browser`, `agent-desktop` | The corresponding browser or desktop automation CLI. |
| `worktrunk` and the local Worktrunk extension | Worktrunk's `wt` CLI. |
| `gh`, `gh-stack` | GitHub CLI; `gh-stack` also needs Git 2.36+ and the `github/gh-stack` extension. |
| Google Cloud skills | Google Cloud CLI for cloud operations. |
| Plannotator extension | Interactive review needs a browser. |

Web search is supplied by `pi-web-access`. Exa search works without an API key. Set `EXA_API_KEY` for direct Exa API access if needed.

[`mcp.json`](mcp.json) enables Notion with local OAuth credentials. Wondering is disabled by default. To use it, supply `WONDERING_API_KEY` in Pi's environment and enable its server entry. Keep API keys out of Git.
