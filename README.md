# Pi configuration

My personal [Pi](https://github.com/earendil-works/pi) setup. Git tracks the settings, local extensions, and local skills. Pi installs everything else from the packages listed in [`settings.json`](settings.json), which is the source of truth for what this setup uses.

Credentials, project trust, sessions, caches, and downloaded packages stay on the machine. See [`.gitignore`](.gitignore).

## Layout

- `settings.json`: packages, skill filters, models, and defaults.
- `extensions/`: local extensions.
- `skills/`: local skills, and copies of installed skills that have local edits.
- `prompts/`: prompt templates.
- `scripts/`: maintenance scripts.

## Set up another machine

1. Install Pi.

   ```sh
   curl -fsSL https://pi.dev/install.sh | sh
   ```

2. If `~/.pi/agent` exists, move it aside first. Keep its credential and session files private.

   ```sh
   git clone https://github.com/rustanacexd/pi-config.git ~/.pi/agent
   ```

3. Provide the credentials that the configured providers and MCP servers need.

4. Launch `pi`. On first launch, Pi installs the packages in `settings.json`.

5. Run `pi list` to check the installed packages.

## Maintain the setup

- Run `pi update --extensions` to update every package. Package sources are unpinned, so an update can change versions. Pull this repository on each machine to sync the settings.
- Install skills with `npx skills add owner/repo`, then run `scripts/skill-sync`. It prints what Pi is missing. `scripts/skill-sync --apply` adds each skill to its repository's `skills` filter in `settings.json` and clones what Pi needs. Commit `settings.json`, then run `/reload` in open Pi sessions.
- To remove a skill, uninstall it with npx first, then prune:

  ```sh
  npx skills remove -g <name>
  scripts/skill-sync --apply --prune
  ```

  `--prune` drops the removed names from `settings.json`. The command never removes anything without `--prune`, because `settings.json` is shared and the npx skills lock file is per machine.
- Don't remove a skill by deleting it from `settings.json` alone. `scripts/skill-sync` adds every skill that npx has installed on this machine, so the next `--apply` puts it back.
- `scripts/skill-sync` also reports `drift` when a copy in `skills/` differs from its twin in `~/.agents/skills`, for example after `npx skills update`. Compare the two with the printed `diff` command and merge by hand.
- To add a skill by hand, add a package to `settings.json` with a `skills` filter. Set `extensions`, `prompts`, and `themes` to `[]` for a skill-only package.
- Copy a skill into `skills/` only when you edit it.
- `settings.json` excludes `~/.agents/skills`, so only this setup loads globally. To load one skill from there anyway, force-include it with a `+` path. A project's `.agents/skills/` still loads. Keep project-specific skills there.
- Keep credentials in environment variables, `auth.json`, and `mcp-auth.json`. Never commit them.
