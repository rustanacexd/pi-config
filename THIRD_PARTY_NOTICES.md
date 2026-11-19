# Third-party skill sources

## Local copies in `skills/`

| Directory | Source | Local changes |
| --- | --- | --- |
| `worktrunk` | [max-sixty/worktrunk](https://github.com/max-sixty/worktrunk), `skills/worktrunk` | Pi-specific guidance for commit generation and subagent worktrees. |

Keep attribution and supporting files when updating these copies.

## Package skills

All other skills come from unpinned packages in `settings.json` and update with `pi update --extensions`. `show-me` loads from the `humanlayer/skills` clone through the top-level `skills` setting, because that repo has no Pi manifest.
