# Pi configuration

Personal [Pi](https://github.com/earendil-works/pi) setup. Git tracks the configuration, standalone skills, and local extensions. Pi manages the packages declared in [`settings.json`](settings.json).

Credentials, machine trust, sessions, caches, and downloaded packages stay local. See [`.gitignore`](.gitignore).

## Set up another machine

1. Install Node.js 22.19 or newer and the tested Pi version:

   ```sh
   npm install -g --ignore-scripts @earendil-works/pi-coding-agent@1.4.0
   ```

2. If `~/.pi/agent` already exists, move it aside as a backup before cloning. Keep its credential and session files private.

   ```sh
   git clone https://github.com/rustanacexd/pi-config.git ~/.pi/agent
   ```

3. Supply `EXA_API_KEY` and `WONDERING_API_KEY` in the environment that launches Pi. Store the values in your local shell configuration or password manager, not this repository. On a Mac with the existing Wondering Keychain entry, you can export it without copying the token:

   ```sh
   export WONDERING_API_KEY="$(security find-generic-password -s wondering-mcp -w)"
   ```

4. Launch `pi`. On its first launch, Pi installs the packages declared in `settings.json`. Use `/login` for model providers and `/mcp login notion` for Notion. Run `pi mcp list` to check the server connections.

5. Run `pi list` to inspect the installed packages. In Pi, check `/skill:show-me` and the startup diagnostics for missing skills or name collisions.

The default model and thinking settings live in `settings.json`. [`pstack-models.md`](pstack-models.md) configures pstack's agent roles. Provider access is configured separately on each machine.

## Maintain the setup

- Pull this repository and run `pi update --extensions` on each machine. Package versions and Git commits are pinned in `settings.json`; change those pins deliberately when upgrading.
- Keep standalone skills in [`skills/`](skills/). Copy complete directories when updating them, including references and metadata. Review and commit the changes. [Third-party notices](THIRD_PARTY_NOTICES.md) record their sources.
- Let Pi supply package-owned skills such as pstack and effective-html. Do not also copy them into `skills/`.
- Keep project-specific skills in that project's `.agents/skills/`, not in this global setup.
- Do not maintain duplicate copies of these skills in `~/.agents/skills/`. If other agents use that directory, link each skill to this repository's copy instead. Recreate those links on each machine; they are not part of the portable setup.
- Keep credentials in local environment variables, `auth.json`, and `mcp-auth.json`. Never commit them.

## Optional tools

Skill instructions do not install the tools they describe. Install and authenticate only the tools you use:

| Skills or extensions | Requirement |
| --- | --- |
| Orca skills and local Orca extensions | Orca and its CLI for the relevant platform. |
| `gh`, `gh-stack` | GitHub CLI; `gh-stack` also needs Git 2.36+ and the `github/gh-stack` extension. |
| Google Cloud skills | Google Cloud CLI for cloud operations. |
| Plannotator skills | Plannotator CLI or the relevant tool integration; interactive review needs a browser. |
| `find-skills` | Node.js and npm for the optional Skills CLI. |

Exa and Wondering use bearer tokens from environment variables. Notion uses local OAuth credentials. The shared MCP configuration does not require macOS Keychain or a particular shell.
