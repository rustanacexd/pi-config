# Pi configuration

My personal [Pi](https://github.com/earendil-works/pi) setup. Git tracks the settings, local extensions, and a few local skills. Pi installs everything else from the packages listed in [`settings.json`](settings.json).

Credentials, project trust, sessions, caches, and downloaded packages stay on the machine. See [`.gitignore`](.gitignore).

## Local skills

`skills/` holds copies of skills that have local edits:

- `worktrunk` is a copy with local edits.

`show-me` comes from `humanlayer/skills`. That repo is a Claude plugin marketplace with no Pi manifest, so the package entry only installs and updates the clone, and the top-level `skills` setting loads `git/github.com/humanlayer/skills/plugins/show-me/skills/show-me` from it.

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
- Copy a skill into `skills/` only when you edit it.
- `settings.json` excludes `~/.agents/skills`, so only this setup loads globally. The exceptions are `rex` and `rexume`: `rex skill setup` and `rexume install` write and update their stubs there, and `settings.json` force-includes each one with a `+` path. A project's `.agents/skills/` still loads. Keep project-specific skills there.
- Keep credentials in environment variables, `auth.json`, and `mcp-auth.json`. Never commit them.
