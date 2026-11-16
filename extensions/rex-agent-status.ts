// Pi reports its state to the terminal (OSC 7501) from its own runs only, so it says "done" once a run
// settles even while pstack background agents it launched keep working. This wraps the terminal's
// setProgramStatus so a resting report (done or idle) reads as working until those agents end. Each
// agent's completion notice starts a new run, whose settle reports done again once none are left.
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent"
import type { ProgramStatus, Terminal } from "@earendil-works/pi-tui"

// pstack persists each agent as a custom session entry of this type. The last entry per agent id wins.
const AGENT_ENTRY = "pstack-agents"

type AgentRecord = { agent?: { id?: string }; status?: string; parentPid?: number }

function runningAgents(ctx: ExtensionContext): number {
  const latest = new Map<string, AgentRecord>()
  for (const entry of ctx.sessionManager.getEntries()) {
    if (entry.type !== "custom" || entry.customType !== AGENT_ENTRY) continue
    const record = entry.data as AgentRecord | undefined
    if (record?.agent?.id) latest.set(record.agent.id, record)
  }
  // An agent restored from an earlier pi process does not run in this terminal.
  return [...latest.values()].filter((r) => r.status === "running" && r.parentPid === process.pid).length
}

function withAgents(status: ProgramStatus, running: number): ProgramStatus {
  if (running === 0 || (status.state !== "done" && status.state !== "idle")) return status
  const agents = `${running} background agent${running === 1 ? "" : "s"} running`
  return { state: "working", app: status.app, message: status.message ? `${status.message} · ${agents}` : agents }
}

// Extensions get no handle on the terminal, but a widget factory receives the TUI and runs at once.
function captureTerminal(ctx: ExtensionContext): Terminal | undefined {
  let terminal: Terminal | undefined
  ctx.ui.setWidget("rex-agent-status", (tui) => {
    terminal = tui.terminal
    return { render: () => [], invalidate() {} }
  })
  ctx.ui.setWidget("rex-agent-status", undefined)
  return terminal
}

export default function (pi: ExtensionAPI) {
  let unwrap: (() => void) | undefined

  pi.on("session_start", (_event, ctx) => {
    if (ctx.mode !== "tui") return
    const terminal = captureTerminal(ctx)
    if (!terminal) return
    const original = terminal.setProgramStatus
    let reported: ProgramStatus | undefined
    terminal.setProgramStatus = (status) => {
      reported = status
      original.call(terminal, withAgents(status, runningAgents(ctx)))
    }
    unwrap = () => {
      terminal.setProgramStatus = original
      if (reported) original.call(terminal, reported)
    }
  })

  pi.on("session_shutdown", () => {
    unwrap?.()
    unwrap = undefined
  })
}
