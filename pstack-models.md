# pstack model configuration

Per-role model overrides for pstack skills. Each pstack SKILL.md names its defaults in a Models section; the values here override those defaults. Delete a line to fall back to the skill default. A value of `inherit-parent` or `auto` runs that role on the parent session's model (the `Agent` call omits `model`); an alias entry in a panel list still counts toward that panel's fan-out. A model may carry a reasoning effort, as in `opus @xhigh` (levels: low, medium, high, xhigh, max); the role's subagent then runs at that level, each entry of a panel list on its own. `default effort` sets the level for a value without one; `session` uses the runtime's platform mapping to start from the parent session's effort. `session hook: off` stops the supported runtime's pstack routing hook from injecting the poteto-mode mandate; any other value, or no line, leaves it on.

feature, refactoring: cliproxyapi/gemini-4-neon @high
bug-fix: cliproxyapi/gemini-4-neon @high
perf-issue: cliproxyapi/gemini-4-neon @high
hillclimb: cliproxyapi/gemini-4-neon @high
judgment and prose: cliproxyapi/gemini-4-neon @high
strongest judgment: fable @high
arena runners: opus @xhigh, fable @high, cliproxyapi/gemini-4-neon @high
arena cross-judge pool: cliproxyapi/gemini-4-neon @high, fable @high, opus @xhigh
swarm workers: opus @xhigh, cliproxyapi/gemini-4-neon @high
interrogate reviewers: opus @xhigh, fable @high, cliproxyapi/gemini-4-neon @high
thermos reviewers: opus @xhigh
no-comments reviewer: opus @xhigh

pi models: opus=cliproxyapi/claude-opus-5-5, fable=cliproxyapi/claude-fable-5-2
default effort: session
session hook: on
