// Adds blank lines under each user message, so the reply below it does not sit right against it.
// Pi has no setting for this gap, so this wraps UserMessageComponent.render. It chains with other
// patches on the same method (pi-tidy's rail wraps it too), and a /reload only updates the count.
import { UserMessageComponent } from "@earendil-works/pi-coding-agent"
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"

const BLANK_LINES_AFTER = 1

const PATCHED = Symbol.for("message-spacing:user-message")
const state = ((globalThis as Record<symbol, { blankLines: number }>)[PATCHED] ??= { blankLines: BLANK_LINES_AFTER })

export default function (_pi: ExtensionAPI) {
  state.blankLines = BLANK_LINES_AFTER
  const proto = UserMessageComponent.prototype as unknown as {
    render(width: number): string[]
    [PATCHED]?: boolean
  }
  if (proto[PATCHED]) return
  proto[PATCHED] = true

  const render = proto.render
  proto.render = function (this: unknown, width: number): string[] {
    const lines = render.call(this, width)
    if (lines.length === 0) return lines
    return [...lines, ...Array.from({ length: state.blankLines }, () => "")]
  }
}
