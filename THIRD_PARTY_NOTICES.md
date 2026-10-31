# Standalone skill sources

The directories in `skills/` are snapshots of the installed skills, not new implementations. Keep their attribution, supporting files, and applicable license texts when updating them. The table records provenance; it is not a separate license grant.

| Directories under `skills/` | Source | License information |
| --- | --- | --- |
| `find-skills` | [vercel-labs/skills](https://github.com/vercel-labs/skills) | [MIT](licenses/vercel-labs-skills.txt). |
| `finding-google-skills`, `gcloud` | [google/skills](https://github.com/google/skills) | [Apache-2.0](licenses/google-skills.txt). Also retain `gcloud/references/attribution.md`. |
| `gh` | [cli/cli](https://github.com/cli/cli) | [MIT](licenses/cli-cli.txt). |
| `gh-stack` | [github/gh-stack](https://github.com/github/gh-stack) | [MIT](licenses/github-gh-stack.txt). |
| `crabbox` | [openclaw/crabbox](https://github.com/openclaw/crabbox) | [MIT](licenses/openclaw-crabbox.txt). |
| `plannotator`, `plannotator-annotate`, `plannotator-inbox`, `plannotator-last`, `plannotator-review` | [Plannotator core skills](https://github.com/backnotprop/plannotator/tree/main/apps/skills/core) | [Apache-2.0](licenses/backnotprop-plannotator.txt). |
| `clean-room`, `ladder`, `status` | [backnotprop/bro](https://github.com/backnotprop/bro) | No license was supplied with these installed skills or found at the repository root. Do not assume the licenses of other skills apply. |
| `computer-use`, `orca-cli`, `orchestration` | Guides installed by the local Orca CLI. They fetch their detailed instructions from that CLI. | No separate license was supplied with these installed guides. |
| `show-me` | [rustanacexd/claude-config](https://github.com/rustanacexd/claude-config), `skills/show-me` | Personal skill copied from the owner's configuration repository. |

The package-managed skills from pstack and effective-html are not vendored here. Their source revisions are pinned in `settings.json`.

## Local changes

- `show-me` is a real directory instead of an absolute symlink. Its file-opening instruction works without assuming macOS or a particular agent's tool syntax.
- `crabbox` links to the upstream Hyper-V guide instead of a document outside its skill directory.

The other standalone skill files are unchanged from the installed copies used for this snapshot. Updates are ordinary reviewed Git changes, not automatic skill-manager updates.
