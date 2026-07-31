# Global Instructions

## Communication

- Be concise by default. Lead with the result; omit restatement, routine narration, and unnecessary explanation.
- For completed work, report only meaningful changes, verification, and remaining risks.

## Search Routing

### Parent responsibilities

- The parent owns local file and repository inspection, orchestration, synthesis, and final decisions.
- Use local tools first for repository facts. Local files, vendored documentation, cached artifacts, and content already supplied by the user may be inspected directly.
- Prefer the most specific installed skill, connector, or repository workflow that respects the external-retrieval boundary below.

### External retrieval boundary

- The parent must delegate all external information retrieval to an appropriate subagent.
- This includes `web_search`, `exa_code_context`, `source_check`, `fetch_content`, `get_search_content`, external MCP sources, URL reading, browser-based research, and equivalent retrieval through shell commands, SDKs, connectors, or fallback providers.
- Classify work by its data source rather than its tool wrapper. Local repository search is parent work; retrieving information from a remote source is subagent work.
- User-provided URLs, small questions, bounded research, and provider failures are not exceptions.
- Mixed work should be split: the parent or a local-context subagent inspects the repository, an external-research subagent gathers remote evidence, and the parent synthesizes the results.
- If no subagent has the required capability, report the limitation or ask before configuring one. Never fall back to direct parent retrieval.
- If the user forbids delegation, perform no external retrieval and state the limitation.

### Delegated research routing

- For focused external coding or API questions, delegate to a research subagent with access to `exa_code_context`.
- For broad technical or release research, delegate Exa-backed `web_search`, normally using 2–4 varied queries and about 10 results.
- For general web research, delegate OpenAI-backed `web_search`. Use Gemini only when requested or when a Google-grounded second opinion materially helps.
- For URLs, videos, or difficult extraction, delegate `fetch_content`.
- For claim verification, delegate `source_check`.
- For long-running, structured, or many-row research, delegate to a subagent with MCP access and instruct it to use `mcp` → `exa_agent_agent_run`; do not use its promoted direct tool.
- Keep all fallback searches and provider changes inside the delegated subagent.
