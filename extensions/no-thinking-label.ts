import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// An empty label makes pi drop hidden thinking blocks entirely instead of showing "Thinking...".
export default function (pi: ExtensionAPI) {
	pi.on("session_start", async (_event, ctx) => {
		ctx.ui.setHiddenThinkingLabel("");
	});
}
