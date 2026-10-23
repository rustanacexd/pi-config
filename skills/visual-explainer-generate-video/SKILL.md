---
name: visual-explainer-generate-video
description: "Generate a narrated MP4 explainer, or record a walkthrough of a live web app using the visual-explainer workflow."
---

Locate the installed `visual-explainer/SKILL.md` under `~/.pi/agent/git/github.com/nicobailon/visual-explainer/plugins/visual-explainer`, `~/.pi/agent/skills/visual-explainer`, or `~/.agents/skills/visual-explainer`. Read and follow it, then read `commands/generate-video.md` inside that same skill directory. If the upstream skill is missing, install it with `pi install git:github.com/nicobailon/visual-explainer` before continuing.

Interpret the workflow's `$@` placeholder as the user's arguments or request accompanying this invocation. Resolve its relative references, templates, and scripts from the upstream skill directory. Preserve the workflow's defaults and input requirements.
