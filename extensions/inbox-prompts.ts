// Runs Pi custom prompts from the Plannotator Inbox.
//
// The Plannotator extension delivers the person's Inbox replies with
// pi.sendUserMessage(text) and no expandPromptTemplates, so a "/command" typed
// in the Inbox reaches the model as plain text. This extension watches those
// wake messages (input event, source "extension") and:
//
//  - "/prompts" (or "/inbox-prompts"): posts the list of custom prompt
//    templates back into the thread via `plannotator inbox call`, without a
//    model round-trip beyond a one-line acknowledgement.
//  - "/<template> [args]": expands the prompt template itself (frontmatter
//    stripped, $1/$@/${1:-def} substituted) and hands the expansion to the
//    model, plus a context note naming the Inbox reply id so the session
//    reports back to the same thread.
//  - "/<skill>" or "/skill:<name>": tells the model to invoke that skill.
//
// The wake message itself is transformed, never swallowed: Plannotator's
// delivery watchdog sees a user message appear and counts the reply delivered.
import type { ExtensionAPI, SlashCommandInfo } from "@earendil-works/pi-coding-agent"
import { spawn } from "node:child_process"
import { readFileSync } from "node:fs"

const WAKE_HEAD = "Plannotator Inbox: "
const LIST_NAMES = new Set(["prompts", "inbox-prompts"])
const PLANNOTATOR = process.env.PLANNOTATOR_BIN ?? "plannotator"

/** The reply id from a wake message's first line, or null when not a wake. */
export function wakeReplyId(text: string): string | null {
	const first = text.split("\n", 1)[0] ?? ""
	if (!first.startsWith(WAKE_HEAD)) return null
	const m = first.match(/\(([^()\s]+)\)\s*$/)
	return m ? m[1] : null
}

/** The first line of the person's words that is a slash invocation. */
export function findSlashLine(text: string): { name: string; args: string } | null {
	for (const raw of text.split("\n").slice(1)) {
		const m = raw.trim().match(/^\/([A-Za-z0-9:_.-]+)(?:\s+(.*))?$/)
		if (m) return { name: m[1], args: (m[2] ?? "").trim() }
	}
	return null
}

export function resolveCommand(name: string, commands: SlashCommandInfo[]): SlashCommandInfo | null {
	const lower = name.toLowerCase()
	return (
		commands.find((c) => c.name.toLowerCase() === lower) ??
		commands.find((c) => c.source === "skill" && c.name.toLowerCase() === `skill:${lower}`) ??
		null
	)
}

export function splitArgs(s: string): string[] {
	const out: string[] = []
	for (const m of s.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)) out.push(m[1] ?? m[2] ?? m[3] ?? "")
	return out
}

export function stripFrontmatter(src: string): string {
	const m = src.match(/^---\n[\s\S]*?\n---\n?/)
	return m ? src.slice(m[0].length) : src
}

/** Pi prompt-template substitution, the common subset. */
export function expandTemplate(src: string, argsStr: string): string {
	const args = splitArgs(argsStr)
	const all = argsStr.trim()
	return stripFrontmatter(src)
		.replace(/\$\{(\d+):-([^}]*)\}/g, (_, n, def) => args[Number(n) - 1] ?? def)
		.replace(/\$\{@:-([^}]*)\}/g, (_, def) => all || def)
		.replace(/\$\{@:(\d+)(?::(\d+))?\}/g, (_, n, l) =>
			args.slice(Number(n) - 1, l ? Number(n) - 1 + Number(l) : undefined).join(" "),
		)
		.replace(/\$ARGUMENTS|\$@/g, all)
		.replace(/\$(\d)/g, (_, n) => args[Number(n) - 1] ?? "")
}

export function promptListBody(commands: SlashCommandInfo[]): string {
	const prompts = commands.filter((c) => c.source === "prompt")
	const lines = prompts.map((c) => `- \`/${c.name}\`${c.description ? ` — ${c.description}` : ""}`)
	const skills = commands.filter((c) => c.source === "skill").length
	return [
		"## Pi custom prompts",
		"Reply with the command on its own line to run it in this session, e.g. `/" +
			(prompts[0]?.name ?? "name") +
			" [args]`.",
		"",
		...(lines.length ? lines : ["(no prompt templates found)"]),
		"",
		`Skills work too (${skills} available): reply \`/skill:<name>\` or \`/<name>\`.`,
	].join("\n")
}

function postToInbox(sessionId: string | undefined, payload: Record<string, unknown>): void {
	const args = ["inbox", "call", ...(sessionId ? ["--session", sessionId] : []), "send_message", "-"]
	const child = spawn(PLANNOTATOR, args, { stdio: ["pipe", "ignore", "ignore"] })
	child.on("error", () => {})
	child.stdin.end(JSON.stringify(payload))
}

export default function (pi: ExtensionAPI) {
	if (process.env.PI_SUBAGENT_PARENT_SESSION) return

	pi.on("input", async (event, ctx) => {
		if (event.source !== "extension" || event.streamingBehavior) return
		const replyId = wakeReplyId(event.text)
		if (!replyId) return
		const hit = findSlashLine(event.text)
		if (!hit) return

		if (LIST_NAMES.has(hit.name.toLowerCase())) {
			postToInbox(ctx.sessionManager.getSessionId(), {
				body: promptListBody(pi.getCommands()),
				reply_to: replyId,
			})
			return {
				action: "transform",
				text:
					`[inbox-prompts extension] The person asked for the prompt list from the Plannotator Inbox (reply ${replyId}); ` +
					"the extension already posted it to that thread. Acknowledge in one short sentence; do not post the list again.",
			}
		}

		const command = resolveCommand(hit.name, pi.getCommands())
		if (!command || (command.source !== "prompt" && command.source !== "skill")) return

		pi.sendMessage(
			{
				customType: "inbox-prompts-context",
				content:
					`The person ran /${hit.name} from the Plannotator Inbox (reply id ${replyId}). ` +
					`When the work is done, report the result there: plannotator_inbox send_message with reply_to "${replyId}". ` +
					`Their full message:\n\n${event.text}`,
				display: true,
			},
			{ triggerTurn: false },
		)

		if (command.source === "skill") {
			return {
				action: "transform",
				text:
					`Invoke the "${command.name.replace(/^skill:/, "")}" skill: read its SKILL.md at ${command.sourceInfo.path} ` +
					`and follow it${hit.args ? ` with arguments: ${hit.args}` : ""}.`,
			}
		}

		let template: string
		try {
			template = readFileSync(command.sourceInfo.path, "utf8")
		} catch {
			return {
				action: "transform",
				text: `The person ran /${hit.name} from the Inbox, but its template at ${command.sourceInfo.path} could not be read. Tell them in the thread (reply_to "${replyId}").`,
			}
		}
		return { action: "transform", text: expandTemplate(template, hit.args) }
	})
}
