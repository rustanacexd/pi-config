# Global Instructions

## Communication

- Be concise. Lead with the result; report only meaningful changes, verification, and remaining risks.

## Search and Retrieval

- The parent owns orchestration, synthesis, and final decisions.
- Use judgment for local repository and file search. The parent may inspect directly when the scope is small or known; delegate broad, exploratory, or parallelizable discovery to a local-context/code subagent.
- Always delegate external retrieval to a research subagent. Classify it by data source, not tool wrapper; shell commands, SDKs, connectors, MCP, browsers, user-provided URLs, small tasks, and provider failures are not exceptions.
- Split mixed work as appropriate between parent or local-context inspection and external-research subagents.
- Keep external retries, provider changes, and fallbacks inside the assigned subagent. If none is capable, report the limitation or ask before configuring one; never retrieve externally from the parent. If delegation is forbidden, perform no external retrieval.

## External Routing

- Focused coding or API research: `exa_code_context`.
- Broad technical or release research: Exa-backed `web_search`; general web research: OpenAI-backed `web_search`.
- URLs or difficult extraction: `fetch_content`; claim verification: `source_check`.
- Long-running structured research: an MCP-capable subagent using `mcp` → `exa_agent_agent_run`.
