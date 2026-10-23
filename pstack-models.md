# pstack model configuration

Per-role model overrides for pstack skills. Each pstack SKILL.md names its defaults in a Models section; the values here override those defaults. Delete a line to fall back to the skill default. A value of `inherit-parent` or `auto` runs that role on the parent session's model (the `Agent` call omits `model`); an alias entry in a panel list still counts toward that panel's fan-out. A model may carry a reasoning effort, as in `opus @xhigh` (levels: low, medium, high, xhigh, max); the role's subagent then runs at that level, each entry of a panel list on its own. `default effort` sets the level for a value without one; `session` keeps the parent session's effort. `session hook: off` stops the Claude Code, Codex, or Muse SessionStart hook, or the pstack Pi extension, from injecting the poteto-mode mandate; any other value, or no line, leaves it on.

feature, refactoring: google/gemini-4-argon @medium
bug-fix: google/gemini-4-argon @high
perf-issue: google/gemini-4-argon @high
hillclimb: google/gemini-4-argon @high
judgment and prose: google/gemini-4-argon @medium
strongest judgment: openai/gpt-6-astra @high
how explorer: google/gemini-4-argon @medium
how explainer: google/gemini-4-argon @medium
why investigators: google/gemini-4-argon @medium
why synthesizer: google/gemini-4-argon @medium
reflect tooling: google/gemini-4-argon @medium
reflect judgment, divergent, synthesizer: google/gemini-4-argon @high
arena runners: google/gemini-4-argon @high, openai/gpt-6.1-sol @high, openai/gpt-6-astra @high, anthropic/claude-opus-5-5 @high
arena cross-judge pool: google/gemini-4-argon @high, openai/gpt-6.1-sol @high, openai/gpt-6-astra @high, anthropic/claude-opus-5-5 @high
swarm workers: google/gemini-4-argon @medium
architect runners: google/gemini-4-argon @high, openai/gpt-6.1-sol @high, openai/gpt-6-astra @high, anthropic/claude-opus-5-5 @high
interrogate reviewers: google/gemini-4-argon @high, openai/gpt-6.1-sol @high, openai/gpt-6-astra @high, anthropic/claude-opus-5-5 @high

pi models: opus=google/gemini-4-argon, fable=openai/gpt-6-astra, sonnet=openai/gpt-6.1-sol, haiku=openai/gpt-6.1-sol
default effort: session
session hook: on
