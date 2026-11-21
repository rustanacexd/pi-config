// /rexid copies this pane's Rex session, tab, and pane ids to the clipboard. Like /retitle it is a
// command, not a tool, so it costs no context, and it needs no model call: the ids come from `rex whoami`.
import { spawn } from "node:child_process"
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"
import { rexCandidates, TERMINALS_INSIDE_REX } from "./rex-session-start"

const PARTS = { session: "session_id", tab: "window_id", pane: "block_id" } as const
type Part = keyof typeof PARTS
type Location = Record<(typeof PARTS)[Part], string>

function copy(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("pbcopy")
    child.on("error", reject)
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`pbcopy exited ${code}`))))
    child.stdin.end(text)
  })
}

export default function (pi: ExtensionAPI) {
  // Never start a Rex server just because of /rexid.
  async function run(rex: string, args: string[]): Promise<string | undefined> {
    try {
      const result = await pi.exec(rex, ["--autostart=false", ...args], { timeout: 5000 })
      return result.code === 0 ? result.stdout : undefined
    } catch {
      return undefined
    }
  }

  // Asked fresh each time: the env has no tab id, and a tab can move to another session.
  async function locate(): Promise<Location | string> {
    const { REX_SESSION, REX_BLOCK, TERM_PROGRAM } = process.env
    if (!REX_SESSION || !REX_BLOCK) return "Not running in a Rex pane"
    if (TERM_PROGRAM && !TERMINALS_INSIDE_REX.has(TERM_PROGRAM.toLowerCase())) {
      return "REX_* variables are inherited from another terminal, not this pane"
    }
    for (const rex of rexCandidates()) {
      const whoami = await run(rex, ["whoami", "--json"])
      if (whoami === undefined) continue
      const location = JSON.parse(whoami) as Location
      // whoami omits block_id when the server does not know REX_BLOCK, e.g. after the pane closed.
      if (location.block_id !== REX_BLOCK) return "Rex no longer knows this pane"
      return location
    }
    return "Rex server is not reachable"
  }

  pi.registerCommand("rexid", {
    description: "Copy this pane's Rex session, tab, and pane ids (or one: session, tab, pane)",
    getArgumentCompletions: (prefix) =>
      Object.keys(PARTS)
        .filter((part) => part.startsWith(prefix))
        .map((part) => ({ value: part, label: part })),
    handler: async (args, ctx) => {
      const part = args.trim() as Part | ""
      if (part && !(part in PARTS)) {
        ctx.ui.notify(`Unknown part "${part}": use session, tab, or pane`, "warning")
        return
      }
      const location = await locate()
      if (typeof location === "string") {
        ctx.ui.notify(location, "warning")
        return
      }
      const parts = part ? [part] : (Object.keys(PARTS) as Part[])
      const text = parts.map((p) => location[PARTS[p]]).join("\n")

      try {
        await copy(text)
        ctx.ui.notify(text, "info")
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        ctx.ui.notify(`Copy failed (${message}):\n${text}`, "warning")
      }
    },
  })
}
