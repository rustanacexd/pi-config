---
description: Swarm-audit this repo's own docs against the code and ship one PR
argument-hint: "[scope or focus]"
---
Audit the docs this repository owns: AGENTS.md, READMEs, project skills, and docs/. Focus: ${@:-all of them}.

Goal: every doc says only what is true now, agrees with the other docs and the code, has references that resolve, and carries nothing an agent does not need.

- Touch only files we own. Leave vendored docs, such as skills pinned by a lock file, and generated blocks unchanged.
- Delete finished one-time notes (plans, specs, decision logs) and every reference to them.
- Check every claim against the code: commands, flags, paths, config, env names, routes, and behavior. Where a doc contradicts the code, the code wins. Fix the doc and back each change with evidence.
- Find contradictions between docs, and stale or dead references to files, scripts, commands, and tools that no longer exist.
- Trim hard. Delete sections an agent does not need, facts repeated within or across files, narrated history, and explanations of the obvious. Keep each rule in one place.
- Use the swarm, technical-writing, and unslop skills.
- Edit directly and deliver one PR. Merge only when I ask.
- Anything outside the docs that needs fixing gets its own follow-up PR, with proof that it changes nothing.
