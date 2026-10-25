# pstack model configuration

Per-role model overrides for pstack skills. Each pstack SKILL.md names its defaults in a Models section; the values here override those defaults. Delete a line to fall back to the skill default. A value of `inherit-parent` or `auto` runs that role on the parent session's model (the `Agent` call omits `model`); an alias entry in a panel list still counts toward that panel's fan-out. A model may carry a reasoning effort, as in `opus @xhigh` (levels: low, medium, high, xhigh, max); the role's subagent then runs at that level, each entry of a panel list on its own. `default effort` sets the level for a value without one; `session` keeps the parent session's effort. `session hook: off` stops the Claude Code, Codex, or Muse SessionStart hook, or the pstack Pi extension, from injecting the poteto-mode mandate; any other value, or no line, leaves it on.

feature, refactoring: opus @medium
bug-fix: opus @medium
perf-issue: opus @medium
hillclimb: opus @medium
judgment and prose: opus @medium
strongest judgment: fable
how explorer: opus @medium
how explainer: opus @medium
why investigators: opus @medium
why synthesizer: opus @medium
reflect tooling: opus @medium
reflect judgment, divergent, synthesizer: opus @medium
arena runners: opus @medium, fable, sonnet
arena cross-judge pool: opus @medium, fable, sonnet
swarm workers: opus @medium
architect runners: opus @medium, fable, sonnet
interrogate reviewers: opus @medium, fable, sonnet

default effort: high
session hook: on
