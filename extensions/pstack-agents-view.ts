// Shows /pstack-agents as a folded transcript card, like pstack-agent-fold does for completion
// notices: one row per agent, and a click or ctrl+o opens each agent's details. pstack's command
// prints a plain-text notify, and pi resolves a second /pstack-agents to /pstack-agents:1 and :2,
// so this wraps the shared ui.notify and swaps that one report for a custom entry. Any other
// notify, and a report this cannot match to pstack's session records, passes through unchanged.
import type { ExtensionAPI, ExtensionContext, Theme } from "@earendil-works/pi-coding-agent"
import { type Component, type TuiMouseEvent, truncateToWidth, visibleWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui"
import { type Static, Type } from "typebox"
import { Value } from "typebox/value"

// pstack persists each agent as a custom entry of this type; the last entry per agent id wins.
const RECORD_TYPE = "pstack-agents"
const VIEW_TYPE = "pstack-agents-view"
const WRAPPED = Symbol.for("pstack-agents-view:notify")

const statusSchema = Type.Union([
  Type.Literal("running"),
  Type.Literal("completed"),
  Type.Literal("failed"),
  Type.Literal("stopped"),
])
type Status = Static<typeof statusSchema>

// The fields of pstack's record this view reads. Value.Check ignores the rest.
const recordSchema = Type.Object({
  agent: Type.Object({
    id: Type.String(),
    description: Type.String(),
    subagentType: Type.String(),
    model: Type.Optional(Type.String()),
    thinking: Type.Optional(Type.String()),
    startedAt: Type.String(),
    worktree: Type.Optional(Type.Object({ path: Type.String(), branch: Type.String() })),
  }),
  status: statusSchema,
  endedAt: Type.Optional(Type.String()),
  finalText: Type.Optional(Type.String()),
  outputFile: Type.Optional(Type.String()),
})
type PstackRecord = Static<typeof recordSchema>

const agentViewSchema = Type.Object({
  id: Type.String(),
  description: Type.String(),
  status: statusSchema,
  subagentType: Type.String(),
  model: Type.String(),
  startedAt: Type.String(),
  endedAt: Type.Optional(Type.String()),
  tool: Type.Optional(Type.Object({ text: Type.String(), running: Type.Boolean() })),
  said: Type.Optional(Type.String()),
  reply: Type.Optional(Type.String()),
  worktree: Type.Optional(Type.String()),
  outputFile: Type.Optional(Type.String()),
  transcript: Type.Optional(Type.String()),
})
const snapshotSchema = Type.Object({
  at: Type.String(),
  agents: Type.Array(agentViewSchema),
  hidden: Type.Optional(Type.Number()),
})
type AgentView = Static<typeof agentViewSchema>
type Snapshot = Static<typeof snapshotSchema>

// pstack's report, agent-text.ts agentsReport: per agent a "<id> <status>: <description>" line,
// then optional "now:"/"last:", "said:", "transcript:" and "read it:" lines.
const HEADER = /^(\S+) (running|completed|failed|stopped): /
const NO_TRANSCRIPT = "not written yet"

type Activity = Pick<AgentView, "tool" | "said" | "transcript">

// Every info notify passes through here, so anything else is turned away on its first line.
function parseReport(text: string): Map<string, Activity> | undefined {
  if (!HEADER.test(text)) return undefined
  const activity = new Map<string, Activity>()
  let current: Activity | undefined
  for (const line of text.split("\n")) {
    const header = HEADER.exec(line)
    if (header) {
      current = {}
      activity.set(header[1], current)
      continue
    }
    if (!current) return undefined
    const colon = line.indexOf(": ")
    if (colon < 0) continue
    const key = line.slice(0, colon)
    const value = line.slice(colon + 2)
    if (key === "now" || key === "last") current.tool = { text: value, running: key === "now" }
    else if (key === "said") current.said = value
    else if (key === "transcript" && value !== NO_TRANSCRIPT) current.transcript = value
  }
  return activity.size ? activity : undefined
}

function latestRecords(ctx: ExtensionContext): Map<string, PstackRecord> {
  const latest = new Map<string, PstackRecord>()
  for (const entry of ctx.sessionManager.getEntries()) {
    if (entry.type !== "custom" || entry.customType !== RECORD_TYPE) continue
    if (Value.Check(recordSchema, entry.data)) latest.set(entry.data.agent.id, entry.data)
  }
  return latest
}

const shortModel = ({ model, thinking }: PstackRecord["agent"]) => {
  const name = model ? model.slice(model.lastIndexOf("/") + 1).replace(/^claude-/, "") : "default"
  return thinking ? `${name} @${thinking}` : name
}

const firstLine = (text: string) =>
  (text.split("\n").find((l) => l.trim()) ?? "").replace(/^\s*(#+|>|[-*+]|\d+\.)\s+/, "").replaceAll("**", "").trim()

// Matches pstack's report to its session records, so a lookalike notify is never swallowed.
function snapshotOf(report: string, ctx: ExtensionContext): Snapshot | undefined {
  const activity = parseReport(report)
  if (!activity) return undefined
  const records = latestRecords(ctx)
  const agents: AgentView[] = []
  for (const [id, live] of activity) {
    const record = records.get(id)
    if (!record) return undefined
    const { agent } = record
    agents.push({
      id,
      description: agent.description,
      status: record.status,
      subagentType: agent.subagentType,
      model: shortModel(agent),
      startedAt: agent.startedAt,
      endedAt: record.status === "running" ? undefined : record.endedAt,
      ...live,
      reply: record.status === "running" || !record.finalText ? undefined : firstLine(record.finalText),
      worktree: agent.worktree && `${agent.worktree.path} (${agent.worktree.branch})`,
      outputFile: record.outputFile,
    })
  }
  // Keep the MAX_AGENTS most recently started, plus any still running, in report order.
  const recent = new Set(
    [...agents].sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt)).slice(0, MAX_AGENTS),
  )
  const shown = agents.filter((a) => a.status === "running" || recent.has(a))
  const hidden = agents.length - shown.length
  return { at: new Date().toISOString(), agents: shown, ...(hidden ? { hidden } : {}) }
}

function elapsed(from: string, to: string): string {
  const seconds = Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 1000))
  if (Number.isNaN(seconds)) return ""
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })

const LOOK = {
  running: { icon: "●", tone: "accent" },
  completed: { icon: "✓", tone: "success" },
  failed: { icon: "✗", tone: "error" },
  stopped: { icon: "■", tone: "warning" },
} as const satisfies Record<Status, { icon: string; tone: string }>

const ORDER: Status[] = ["running", "completed", "failed", "stopped"]
const MAX_AGENTS = 20
const MAX_NAME = 36
const PAD = 1
const LABEL_WIDTH = 11

type Fold = { open: boolean; globalExpanded: boolean }
// A click overrides the global ctrl+o state for one card until ctrl+o is pressed again.
const folds = new WeakMap<object, Fold>()

class AgentsCard implements Component {
  private cache?: { width: number; open: boolean; lines: string[] }

  constructor(
    private readonly entry: object,
    private readonly snapshot: Snapshot,
    private readonly globalExpanded: boolean,
    private readonly theme: Theme,
  ) {}

  private get open(): boolean {
    const fold = folds.get(this.entry)
    return fold && fold.globalExpanded === this.globalExpanded ? fold.open : this.globalExpanded
  }

  render(width: number): string[] {
    const open = this.open
    if (this.cache?.width === width && this.cache.open === open) return this.cache.lines
    const lines = this.build(width, open)
    this.cache = { width, open, lines }
    return lines
  }

  private build(width: number, open: boolean): string[] {
    const { theme } = this
    const { at, agents, hidden } = this.snapshot
    const indent = " ".repeat(PAD)
    const fit = (line: string) => truncateToWidth(line, width, theme.fg("dim", "…"))

    const counts = ORDER.flatMap((status) => {
      const n = agents.filter((a) => a.status === status).length
      return n ? [theme.fg(LOOK[status].tone, `${n} ${status}`)] : []
    })
    const header = [
      theme.fg("accent", open ? "▾" : "▸"),
      theme.bold("pstack agents"),
      counts.join(theme.fg("dim", " · ")),
      ...(hidden ? [theme.fg("dim", `· ${hidden} older hidden`)] : []),
      theme.fg("dim", `· ${clock(at)}`),
    ].join(" ")
    const out = [fit(indent + header)]

    const nameWidth = Math.min(MAX_NAME, Math.max(...agents.map((a) => visibleWidth(a.description))))
    agents.forEach((agent, i) => {
      const look = LOOK[agent.status]
      const name = truncateToWidth(agent.description, nameWidth, "…")
      const meta = [agent.status, agent.model, elapsed(agent.startedAt, agent.endedAt ?? at)].filter(Boolean).join(" · ")
      const doing = agent.status === "running" && agent.tool ? theme.fg("muted", `  ${agent.tool.running ? "▹" : "·"} ${agent.tool.text}`) : ""
      if (open && i > 0) out.push("")
      out.push(fit(`${indent}  ${theme.fg(look.tone, look.icon)} ${theme.bold(name)}${" ".repeat(nameWidth - visibleWidth(name))}  ${theme.fg("dim", meta)}${doing}`))
      if (!open) return
      // Paths are what a reader copies, so details wrap instead of truncating.
      const gutter = `${indent}    `
      const hang = " ".repeat(LABEL_WIDTH)
      for (const [label, value] of details(agent)) {
        const wrapped = wrapTextWithAnsi(value, Math.max(10, width - gutter.length - LABEL_WIDTH))
        wrapped.forEach((part, j) => {
          const lead = j === 0 ? theme.fg("dim", label.padEnd(LABEL_WIDTH)) : hang
          out.push(fit(`${gutter}${lead}${theme.fg("customMessageText", part)}`))
        })
      }
    })
    return out
  }

  handleMouse(event: TuiMouseEvent) {
    if (event.type !== "click" || event.button !== "left") return undefined
    folds.set(this.entry, { open: !this.open, globalExpanded: this.globalExpanded })
    return { handled: true, render: true }
  }

  invalidate(): void {
    this.cache = undefined
  }
}

const shellPath = (path: string) => (/^[A-Za-z0-9_./-]+$/.test(path) ? path : `'${path.replaceAll("'", "'\\''")}'`)

function details(agent: AgentView): [string, string][] {
  const rows: [string, string][] = [["id", `${agent.id} · ${agent.subagentType}`]]
  if (agent.tool) rows.push([agent.tool.running ? "now" : "last", agent.tool.text])
  if (agent.said) rows.push(["said", agent.said])
  if (agent.reply) rows.push(["reply", agent.reply])
  if (agent.worktree) rows.push(["worktree", agent.worktree])
  if (agent.outputFile) rows.push(["output", agent.outputFile])
  rows.push(["transcript", agent.transcript ? shellPath(agent.transcript) : NO_TRANSCRIPT])
  return rows
}

export default function (pi: ExtensionAPI) {
  pi.registerEntryRenderer(VIEW_TYPE, (entry, { expanded }, theme) =>
    Value.Check(snapshotSchema, entry.data) ? new AgentsCard(entry, entry.data, expanded, theme) : undefined)

  // ui.notify belongs to the ui object every extension shares. A /reload or session switch fires
  // session_start again, so the wrapper is rebuilt from the original around this pi.
  pi.on("session_start", (_event, ctx) => {
    if (ctx.mode !== "tui") return
    const ui = ctx.ui
    const current = ui.notify as typeof ui.notify & { [WRAPPED]?: typeof ui.notify }
    const original = current[WRAPPED] ?? current
    const wrapped = (message: string, type?: "info" | "warning" | "error") => {
      let snapshot: Snapshot | undefined
      try {
        snapshot = type === "info" ? snapshotOf(message, ctx) : undefined
        if (snapshot) pi.appendEntry(VIEW_TYPE, snapshot)
      } catch {
        // A context left stale by a reload: show pstack's own text.
        snapshot = undefined
      }
      if (!snapshot) original.call(ui, message, type)
    }
    ui.notify = Object.assign(wrapped, { [WRAPPED]: original })
  })
}
