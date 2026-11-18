// Names each pi session after its task, the way Claude Code titles its conversations. Pi puts the session
// name in the terminal title ("π - <name> - <folder>"), so Rex and other terminals show it on the tab.
// A name set with /name is kept. /retitle renames the session after where the conversation is now.
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent"

const TITLE_MODEL = { provider: "cliproxyapi", id: "claude-haiku-5-5" }
const MAX_PROMPT_CHARS = 2000
const MAX_TITLE_CHARS = 50
const RETITLE_USER_MESSAGES = 8
const MAX_RETITLE_MESSAGE_CHARS = 600

const STYLE = [
  'Use sentence case with no quotes or final period, for example "Fix login redirect".',
  "Reply with the title only.",
].join(" ")

const FIRST_PROMPT_INSTRUCTIONS = [
  "Write a title of two to five words for the task in the message below, like a short git commit subject.",
  STYLE,
  "If the message does not ask for any work (a greeting, a yes or no, thanks), reply NONE.",
].join(" ")

const RETITLE_INSTRUCTIONS = [
  "Write a title of two to five words for what the conversation below is working on now, like a short git commit subject.",
  "The conversation may have moved on from where it started: title the latest topic, not the first one.",
  STYLE,
].join(" ")

function cleanTitle(text: string): string | undefined {
  const lines = text.trim().split("\n")
  const title = lines[0].replace(/^["'`*#\s]+|["'`*.\s]+$/g, "")
  // Haiku sometimes thinks aloud instead ("Is the message asking for work? It asks…"). That is no
  // title, and leaving the session unnamed lets the next prompt try again.
  if (lines.length > 1 || title.length > MAX_TITLE_CHARS) return undefined
  if (!title || title.toUpperCase() === "NONE") return undefined
  return title
}

async function writeTitle(ctx: ExtensionContext, instructions: string, body: string): Promise<string | undefined> {
  const haiku = ctx.modelRegistry.find(TITLE_MODEL.provider, TITLE_MODEL.id)
  const model = haiku && ctx.modelRegistry.hasConfiguredAuth(haiku) ? haiku : ctx.model
  if (!model) return undefined
  const response = await ctx.modelRegistry.complete(
    model,
    { messages: [{ role: "user", content: [{ type: "text", text: `${instructions}\n\n${body}` }], timestamp: Date.now() }] },
    { maxTokens: 40, cacheRetention: "none" },
  )
  if (response.stopReason === "error" || response.stopReason === "aborted") {
    throw new Error(response.errorMessage ?? response.stopReason)
  }
  return cleanTitle(response.content.flatMap((part) => (part.type === "text" ? [part.text] : [])).join(""))
}

function textOf(content: unknown): string {
  if (typeof content === "string") return content
  if (!Array.isArray(content)) return ""
  return content.flatMap((part) => (part?.type === "text" && typeof part.text === "string" ? [part.text] : [])).join("\n")
}

// The last few user messages, each followed by the assistant's final reply to it.
function recentConversation(ctx: ExtensionContext): string {
  const turns: string[] = []
  let userMessages = 0
  const branch = ctx.sessionManager.getBranch()
  for (let i = branch.length - 1; i >= 0 && userMessages < RETITLE_USER_MESSAGES; i--) {
    const entry = branch[i]
    if (entry.type !== "message") continue
    const { role, content } = entry.message
    if (role !== "user" && role !== "assistant") continue
    const text = textOf(content).trim()
    if (!text) continue
    // Keep only the assistant's last text before each user message, not every step of the turn.
    if (role === "assistant" && turns[0]?.startsWith("<assistant>")) continue
    turns.unshift(`<${role}>\n${text.slice(0, MAX_RETITLE_MESSAGE_CHARS)}\n</${role}>`)
    if (role === "user") userMessages++
  }
  return turns.join("\n")
}

export default function (pi: ExtensionAPI) {
  // pstack sets this in every subagent, whose session name nothing shows, so titling it wastes a model call.
  if (process.env.PI_SUBAGENT_PARENT_SESSION) return
  let naming = false

  // `input` carries the raw text, so "/skill:x do y" is titled from "do y", not from the skill body.
  pi.on("input", (event, ctx) => {
    if (naming || event.source === "extension" || pi.getSessionName() || !event.text.trim()) return
    naming = true
    // Not awaited: the turn starts at once, and the tab title changes when the name arrives.
    writeTitle(ctx, FIRST_PROMPT_INSTRUCTIONS, `<message>\n${event.text.slice(0, MAX_PROMPT_CHARS)}\n</message>`)
      // The user may have run /name while the model was answering.
      .then((title) => {
        if (title && !pi.getSessionName()) pi.setSessionName(title)
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error)
        if (ctx.hasUI) ctx.ui.notify(`Session title failed: ${message}`, "warning")
      })
      .finally(() => {
        naming = false
      })
  })

  pi.registerCommand("retitle", {
    description: "Rename the session (and tab title) after what the conversation is about now",
    handler: async (_args, ctx) => {
      const conversation = recentConversation(ctx)
      if (!conversation) {
        ctx.ui.notify("Nothing to title yet", "info")
        return
      }
      try {
        const title = await writeTitle(ctx, RETITLE_INSTRUCTIONS, `<conversation>\n${conversation}\n</conversation>`)
        if (!title) {
          ctx.ui.notify("Could not come up with a title; try /name <title>", "warning")
          return
        }
        pi.setSessionName(title)
        ctx.ui.notify(`Session renamed: ${title}`, "info")
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        ctx.ui.notify(`Retitle failed: ${message}`, "warning")
      }
    },
  })
}
