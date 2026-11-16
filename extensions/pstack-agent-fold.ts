// Folds pstack's background-agent completion notices ("pstack-agent" custom messages) to a
// summary row plus one line of the reply. A click or ctrl+o opens the full report. pstack
// registers no renderer for the type, so pi's default would show the whole report. pi-tidy
// draws its one-row notices only for pi-subagents' "subagent…" types and frames this one as
// an ordinary custom message.
import { CustomMessageComponent, getMarkdownTheme, type ExtensionAPI, type Theme } from "@earendil-works/pi-coding-agent"
import { type Component, Markdown, type TuiMouseEvent, truncateToWidth } from "@earendil-works/pi-tui"

const NOTICE_TYPE = "pstack-agent"

type Fold = { open: boolean; globalExpanded: boolean }
// A click overrides the global ctrl+o state for one notice until ctrl+o is pressed again.
const folds = new WeakMap<object, Fold>()

type Notice = { fields: Map<string, string>; report: string; lineCount: number; preview: string }

function parse(content: unknown): Notice {
  const text = typeof content === "string"
    ? content
    : Array.isArray(content)
      ? content.flatMap((c) => (c?.type === "text" && typeof c.text === "string" ? [c.text] : [])).join("\n")
      : ""
  const split = text.indexOf("\n\n")
  const head = split < 0 ? text : text.slice(0, split)
  const fields = new Map<string, string>()
  for (const line of head.split("\n").slice(1)) {
    const colon = line.indexOf(": ")
    if (colon > 0) fields.set(line.slice(0, colon), line.slice(colon + 2))
  }
  const report = split < 0 ? "" : text.slice(split + 2).trim()
  const lines = report ? report.split("\n") : []
  return { fields, report, lineCount: lines.length, preview: previewLine(lines) }
}

const STATUS = {
  completed: { icon: "✓", tone: "success" },
  failed: { icon: "✗", tone: "error" },
  stopped: { icon: "■", tone: "warning" },
} as const

function previewLine(lines: string[]): string {
  const line = lines.find((l) => l.trim()) ?? ""
  return line.replace(/^\s*(#+|>|[-*+]|\d+\.)\s+/, "").replaceAll("**", "").trim()
}

class AgentNotice implements Component {
  private body?: Markdown
  private cache?: { width: number; open: boolean; lines: string[] }
  private readonly notice: Notice

  constructor(
    private readonly message: object & { content: unknown; details?: unknown },
    private readonly globalExpanded: boolean,
    private readonly pad: number,
    private readonly theme: Theme,
  ) {
    this.notice = parse(message.content)
  }

  private get open(): boolean {
    const fold = folds.get(this.message)
    return fold && fold.globalExpanded === this.globalExpanded ? fold.open : this.globalExpanded
  }

  // pi redraws the whole transcript every frame, scrolling included, so an unchanged notice
  // must cost a lookup, not a rebuild.
  render(width: number): string[] {
    const open = this.open
    if (this.cache?.width === width && this.cache.open === open) return this.cache.lines
    const lines = this.build(width, open)
    this.cache = { width, open, lines }
    return lines
  }

  private build(width: number, open: boolean): string[] {
    const { theme, pad } = this
    const { fields, report, lineCount, preview } = this.notice
    const details = (this.message.details ?? {}) as { status?: string; agentId?: string }
    const status = details.status ?? fields.get("status") ?? "finished"
    const look = STATUS[status as keyof typeof STATUS] ?? { icon: "•", tone: "muted" as const }
    const indent = " ".repeat(pad)
    const inner = Math.max(1, width - pad)
    const header = [
      theme.fg("accent", open ? "▾" : "▸"),
      theme.fg(look.tone, look.icon),
      theme.bold(fields.get("description") ?? "pstack agent"),
      theme.fg(look.tone, status),
      theme.fg("dim", `· ${lineCount} line${lineCount === 1 ? "" : "s"}`),
    ].join(" ")
    const out = [truncateToWidth(indent + header, width)]

    if (!open) {
      if (preview) out.push(truncateToWidth(`${indent}  ${theme.fg("customMessageText", preview)}`, width, theme.fg("dim", "…")))
      return out
    }

    const meta = ["agentId", "worktree", "transcript", "full output"]
      .flatMap((key) => (fields.has(key) ? [`${key}: ${fields.get(key)}`] : []))
    for (const line of meta) out.push(truncateToWidth(`${indent}  ${theme.fg("dim", line)}`, width))
    if (report) {
      this.body ??= new Markdown(report, 0, 0, getMarkdownTheme(), { color: (t: string) => theme.fg("customMessageText", t) })
      out.push("", ...this.body.render(Math.max(1, inner - 2)).map((line) => `${indent}  ${line}`))
    }
    return out
  }

  handleMouse(event: TuiMouseEvent) {
    if (event.type !== "click" || event.button !== "left") return undefined
    folds.set(this.message, { open: !this.open, globalExpanded: this.globalExpanded })
    return { handled: true, render: true }
  }

  invalidate(): void {
    this.cache = undefined
    this.body?.invalidate()
  }
}

// pi-tidy marks the prototype it frames, and its frame already insets the rows by one cell.
const tidyFramed = () => (CustomMessageComponent.prototype as { __toolboxFramed?: boolean }).__toolboxFramed === true

export default function (pi: ExtensionAPI) {
  pi.registerMessageRenderer(NOTICE_TYPE, (message, { expanded, outputPad }, theme) =>
    new AgentNotice(message, expanded, tidyFramed() ? 0 : outputPad, theme))
}
