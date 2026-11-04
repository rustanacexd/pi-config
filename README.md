# Pi configuration

Personal [Pi](https://github.com/earendil-works/pi) setup. Git tracks the configuration, local extensions, and a link to shared skills. Pi manages the packages declared in [`settings.json`](settings.json).

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

3. Create `~/.agents/skills/` and install the standalone skills you use there:

   ```sh
	mkdir -p ~/.agents/skills
   ```

   [`skills`](skills) is a relative symlink to that directory. This repository does not include its contents. Pi installs package-owned skills separately.

4. Launch `pi`. On its first launch, Pi installs the packages declared in `settings.json`. Use `/login` for built-in model providers and `/mcp login notion` for Notion. Configure custom providers separately on each machine.

5. Run `pi list` to inspect the installed packages and `pi mcp list` to check enabled MCP connections. Use `pi --verbose` to inspect startup diagnostics despite the configured quiet startup.

The default model and thinking settings live in `settings.json`. [`pstack-models.md`](pstack-models.md) configures pstack's agent roles. Provider access is configured separately on each machine.

## Maintain the setup

- Pull this repository and run `pi update --extensions` on each machine. Package sources in `settings.json` are unpinned, so updates can change installed versions.
- Maintain standalone skills in `~/.agents/skills/`. Changes through the `skills` symlink are outside this repository and must be backed up separately.
- Let Pi supply package-owned skills such as pstack and effective-html. Do not also copy them into the shared skills directory.
- Keep project-specific skills in that project's `.agents/skills/`, not in this global setup.
- Keep credentials in local environment variables, `auth.json`, and `mcp-auth.json`. Never commit them.

## Optional tools

Skill instructions do not install the tools they describe. Install and authenticate only the tools you use:

| Skills or extensions | Requirement |
| --- | --- |
| Orca skills and local Orca extensions | Orca and its CLI for the relevant platform. |
| `rex` and the local Rex extension | Rex and its CLI. |
| `agent-browser`, `agent-desktop` | The corresponding browser or desktop automation CLI. |
| `devboxes` | Namespace `devbox` or `boxctl` CLI. |
| `worktrunk` and the local Worktrunk extension | Worktrunk's `wt` CLI. |
| `gh`, `gh-stack` | GitHub CLI; `gh-stack` also needs Git 2.36+ and the `github/gh-stack` extension. |
| Google Cloud skills | Google Cloud CLI for cloud operations. |
| Plannotator skills | Plannotator CLI or the relevant tool integration; interactive review needs a browser. |
| `find-skills` | Node.js and npm for the optional Skills CLI. |

Web search is supplied by `pi-web-access`. Exa search works without an API key. Set `EXA_API_KEY` for direct Exa API access if needed.

[`mcp.json`](mcp.json) enables Notion with local OAuth credentials. Wondering is disabled by default. To use it, supply `WONDERING_API_KEY` in Pi's environment and enable its server entry. Keep API keys out of Git.
