// Names each pi session after its task, the way Claude Code titles its conversations. Pi puts the session
// name in the terminal title ("π - <name> - <folder>"), so Rex and other terminals show it on the tab.
// A name set with /name is kept.
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent"

const TITLE_MODEL = { provider: "cliproxyapi", id: "claude-haiku-5-5" }
const MAX_PROMPT_CHARS = 2000
const MAX_TITLE_CHARS = 50

const INSTRUCTIONS = [
  "Write a title of two to five words for the task in the message below, like a short git commit subject.",
  'Use sentence case with no quotes or final period, for example "Fix login redirect".',
  "Reply with the title only. If the message does not ask for any work (a greeting, a yes or no, thanks), reply NONE.",
].join(" ")

function cleanTitle(text: string): string | undefined {
  const title = text.trim().split("\n")[0].replace(/^["'`*#\s]+|["'`*.\s]+$/g, "")
  if (!title || title.toUpperCase() === "NONE") return undefined
  return title.length > MAX_TITLE_CHARS ? `${title.slice(0, MAX_TITLE_CHARS - 1).trimEnd()}…` : title
}

export default function (pi: ExtensionAPI) {
  let naming = false

  async function nameSession(prompt: string, ctx: ExtensionContext): Promise<void> {
    const haiku = ctx.modelRegistry.find(TITLE_MODEL.provider, TITLE_MODEL.id)
    const model = haiku && ctx.modelRegistry.hasConfiguredAuth(haiku) ? haiku : ctx.model
    if (!model) return
    const text = `${INSTRUCTIONS}\n\n<message>\n${prompt.slice(0, MAX_PROMPT_CHARS)}\n</message>`
    const response = await ctx.modelRegistry.complete(
      model,
      { messages: [{ role: "user", content: [{ type: "text", text }], timestamp: Date.now() }] },
      { maxTokens: 40, cacheRetention: "none" },
    )
    if (response.stopReason === "error" || response.stopReason === "aborted") {
      throw new Error(response.errorMessage ?? response.stopReason)
    }
    const reply = response.content.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("")
    const title = cleanTitle(reply)
    // The user may have run /name while the model was answering.
    if (title && !pi.getSessionName()) pi.setSessionName(title)
  }

  // `input` carries the raw text, so "/skill:x do y" is titled from "do y", not from the skill body.
  pi.on("input", (event, ctx) => {
    if (naming || event.source === "extension" || pi.getSessionName() || !event.text.trim()) return
    naming = true
    // Not awaited: the turn starts at once, and the tab title changes when the name arrives.
    nameSession(event.text, ctx)
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error)
        if (ctx.hasUI) ctx.ui.notify(`Session title failed: ${message}`, "warning")
      })
      .finally(() => {
        naming = false
      })
  })
}
