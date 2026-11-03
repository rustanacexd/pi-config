# pstack model configuration

Per-role model overrides for pstack skills. Each pstack SKILL.md names its defaults in a Models section; the values here override those defaults. Delete a line to fall back to the skill default. A value of `inherit-parent` or `auto` runs that role on the parent session's model (the `Agent` call omits `model`); an alias entry in a panel list still counts toward that panel's fan-out. A model may carry a reasoning effort, as in `opus @xhigh` (levels: low, medium, high, xhigh, max); the role's subagent then runs at that level, each entry of a panel list on its own. `default effort` sets the level for a value without one; `session` keeps the parent session's effort. `session hook: off` stops the Claude Code, Codex, or Muse SessionStart hook, or the pstack Pi extension, from injecting the poteto-mode mandate; any other value, or no line, leaves it on.

feature, refactoring: inherit-parent
bug-fix: inherit-parent
perf-issue: inherit-parent
hillclimb: inherit-parent
judgment and prose: inherit-parent
strongest judgment: opus @xhigh
how explorer: inherit-parent
how explainer: inherit-parent
why investigators: inherit-parent
why synthesizer: inherit-parent
reflect tooling: inherit-parent
reflect judgment, divergent, synthesizer: inherit-parent
arena runners: google/gemini-4-argon @high, opus @xhigh, openai/gpt-6.1-sol @high
arena cross-judge pool: fable @xhigh, google/gemini-4-argon @high, openai/gpt-6.1-sol @high
swarm workers: inherit-parent
architect runners: google/gemini-4-argon @high, opus @xhigh, openai/gpt-6.1-sol @high
interrogate reviewers: google/gemini-4-argon @high, opus @xhigh, openai/gpt-6.1-sol @high

pi models: opus=cliproxyapi/claude-opus-5-5, sonnet=cliproxyapi/claude-sonnet-5-5, fable=cliproxyapi/claude-fable-5-1
default effort: session
session hook: on
