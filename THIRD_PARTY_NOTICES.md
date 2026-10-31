# Standalone skill sources

These skills are snapshots of the installed copies. Keep their attribution and supporting files when updating them.

| Directories under `skills/` | Source |
| --- | --- |
| `find-skills` | [vercel-labs/skills](https://github.com/vercel-labs/skills) |
| `finding-google-skills`, `gcloud` | [google/skills](https://github.com/google/skills) |
| `gh` | [cli/cli](https://github.com/cli/cli) |
| `gh-stack` | [github/gh-stack](https://github.com/github/gh-stack) |
| `plannotator`, `plannotator-annotate`, `plannotator-inbox`, `plannotator-last`, `plannotator-review` | [Plannotator core skills](https://github.com/backnotprop/plannotator/tree/main/apps/skills/core) |
| `clean-room`, `ladder`, `status` | [backnotprop/bro](https://github.com/backnotprop/bro) |
| `computer-use`, `orca-cli`, `orchestration` | Guides installed by the local Orca CLI. |
| `show-me` | [rustanacexd/claude-config](https://github.com/rustanacexd/claude-config), `skills/show-me` |

Package-managed skills from pstack and effective-html are not vendored here. Their source revisions are pinned in `settings.json`.

The `show-me` snapshot uses the platform's browser or file opener instead of assuming macOS. The other skill files are unchanged from the installed copies.
