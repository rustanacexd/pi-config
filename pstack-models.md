# pstack model configuration

Per-role model overrides for pstack skills. Each pstack SKILL.md names its defaults in a Models section; the values here override those defaults. Delete a line to fall back to the skill default. A value of `inherit-parent` or `auto` runs that role on the parent session's model (the `Agent` call omits `model`); an alias entry in a panel list still counts toward that panel's fan-out. A model may carry a reasoning effort, as in `opus @xhigh` (levels: low, medium, high, xhigh, max); the role's subagent then runs at that level, each entry of a panel list on its own. `default effort` sets the level for a value without one; `session` uses the runtime's platform mapping to start from the parent session's effort. `session hook: off` stops the supported runtime's pstack routing hook from injecting the poteto-mode mandate; any other value, or no line, leaves it on.

feature, refactoring: opus @xhigh
bug-fix: opus @xhigh
perf-issue: opus @xhigh
hillclimb: opus @xhigh
judgment and prose: opus @xhigh
strongest judgment: fable @max
how explorer: opus
how explainer: opus
why investigators: opus
why synthesizer: opus
reflect tooling: opus @high
reflect judgment, divergent, synthesizer: opus @xhigh
arena runners: opus @high, fable @high
arena cross-judge pool: opus @high, fable @high
swarm workers: opus @high
architect runners: opus @high, fable @high
interrogate reviewers: opus @high, fable @high
thermos reviewers: opus
no-comments reviewer: opus

pi models: opus=cliproxyapi/claude-opus-5-5, sonnet=cliproxyapi/claude-sonnet-5-5, fable=cliproxyapi/claude-fable-5-2
default effort: session
session hook: on
