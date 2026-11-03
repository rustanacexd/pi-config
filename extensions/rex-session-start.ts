// Pi counterpart of the SessionStart hook that `rex skill setup` installs into Claude Code and Codex.
// Rex reports pi's hook as "unsupported", so this extension runs the same command and adds its output
// to the system prompt. The text comes from the installed rex CLI, so Rex upgrades update it.
import { readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"

// `rex skill setup [--session-naming]` records the choice by writing this flag into the skill stub it
// installs for pi, so the stub is the switch. Without the flag, Rex's default (naming on) applies.
function sessionNamingArgs(): string[] {
  try {
    const stub = readFileSync(join(homedir(), ".pi/agent/skills/rex/SKILL.md"), "utf8")
    return stub.includes("--feature-session-naming=false") ? ["--feature-session-naming=false"] : []
  } catch {
    return []
  }
}

// Rex sets TERM_PROGRAM=rex. A multiplexer inside a Rex pane replaces it; any other terminal means the
// REX_* variables were inherited from a Rex shell that launched this terminal, and name the wrong pane.
const TERMINALS_INSIDE_REX = new Set(["rex", "tmux"])

function rexCandidates(): string[] {
  const own = process.env.REX_BIN_DIR ? [join(process.env.REX_BIN_DIR, "rex")] : []
  return [
    ...own,
    "rex",
    "/Applications/Rex.app/Contents/Helpers/Rex Server.rex/Contents/MacOS/rex",
    "/Applications/Rex Beta.app/Contents/Helpers/Rex Server.rex/Contents/MacOS/rex",
  ]
}

export default function (pi: ExtensionAPI) {
  let context: Promise<string | undefined> = Promise.resolve(undefined)

  // Never start a Rex server just because pi started.
  async function run(rex: string, args: string[]): Promise<string | undefined> {
    try {
      const result = await pi.exec(rex, ["--autostart=false", ...args], { timeout: 5000 })
      return result.code === 0 ? result.stdout : undefined
    } catch {
      return undefined
    }
  }

  async function readContext(): Promise<string | undefined> {
    const { REX_SESSION, REX_BLOCK, TERM_PROGRAM } = process.env
    if (!REX_SESSION || !REX_BLOCK) return undefined
    if (TERM_PROGRAM && !TERMINALS_INSIDE_REX.has(TERM_PROGRAM.toLowerCase())) return undefined

    for (const rex of rexCandidates()) {
      const whoami = await run(rex, ["whoami", "--json"])
      if (whoami === undefined) continue
      // whoami omits block_id when the server does not know REX_BLOCK, e.g. after the pane closed.
      if (JSON.parse(whoami).block_id !== REX_BLOCK) return undefined
      const args = ["__internal", "session-start", "--agent", "pi", ...sessionNamingArgs()]
      return (await run(rex, args))?.trim() || undefined
    }
    return undefined
  }

  pi.on("session_start", () => {
    context = readContext().catch(() => undefined)
  })

  pi.on("before_agent_start", async (event) => {
    const text = await context
    if (text) event.systemPromptOptions.sections["rex-session-start"] = text
  })
}
