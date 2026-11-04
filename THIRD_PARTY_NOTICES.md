# Third-party skill sources

## Local copies in `skills/`

| Directory | Source | Local changes |
| --- | --- | --- |
| `rex` | Written by `rex skill setup`. Loads its guide from the installed Rex CLI. | None |
| `computer-use`, `orca-cli`, `orchestration` | Installed by the Orca CLI. Load their guides from the installed Orca CLI. | None |
| `show-me` | [rustanacexd/claude-config](https://github.com/rustanacexd/claude-config), `skills/show-me` | Uses the platform's browser or file opener instead of assuming macOS. |
| `big-pics-little-words` | [backnotprop/bro](https://github.com/backnotprop/bro) | Adds "but dont use weird metaphors." |
| `worktrunk` | [max-sixty/worktrunk](https://github.com/max-sixty/worktrunk), `skills/worktrunk` | Pi-specific guidance for commit generation and subagent worktrees. |

Keep attribution and supporting files when updating these copies.

## Package skills

All other skills come from unpinned packages in `settings.json` and update with `pi update --extensions`. The effective-html package's `big-pics-little-words` is excluded so the local copy loads.
