// Keeps pstack subagents out of the Plannotator Inbox's Agents list.
// Plannotator reads PLANNOTATOR_INBOX_TOOL once, when its extension loads, and registers a polling session
// per Pi process. pstack sets PI_SUBAGENT_PARENT_SESSION only in subagents, so the main session is untouched.
// Set at module load so it lands before any extension factory runs.
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"

if (process.env.PI_SUBAGENT_PARENT_SESSION) process.env.PLANNOTATOR_INBOX_TOOL = "0"

export default function (_pi: ExtensionAPI) {}
