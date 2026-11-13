import { type ExtensionAPI, FooterComponent } from "@earendil-works/pi-coding-agent";

// Show footer context usage as tokens ("119k/984k (auto)") instead of a percent ("12.1%/984k (auto)").
// Wraps the built-in footer's render rather than replacing the footer, so other footer patches
// (the cliproxyapi provider's fast/paused labels and reserve-adjusted window) keep working.

const PATCHED = Symbol.for("rustan/context-tokens-footer");

function formatTokens(count: number): string {
	if (count < 1000) return count.toString();
	if (count < 10000) return `${(count / 1000).toFixed(1)}k`;
	if (count < 1000000) return `${Math.round(count / 1000)}k`;
	if (count < 10000000) return `${(count / 1000000).toFixed(1)}M`;
	return `${Math.round(count / 1000000)}M`;
}

type Footer = { session?: { getContextUsage(): { tokens: number | null } | undefined } };
type Proto = { render(width: number): string[]; [PATCHED]?: true };

export default function (_pi: ExtensionAPI) {
	const proto = FooterComponent.prototype as unknown as Proto;
	if (proto[PATCHED]) return;
	proto[PATCHED] = true;
	const render = proto.render;
	proto.render = function (this: Footer, width: number): string[] {
		const lines = render.call(this, width);
		const tokens = this.session?.getContextUsage()?.tokens;
		const used = tokens == null ? "?" : formatTokens(tokens);
		// The token text is never wider than the percent text; pad after the window so the model name stays right-aligned.
		return lines.map((line) =>
			line.replace(/(?:\d+\.\d|\?)%\/(\S+(?: \(auto\))?)/, (match, window: string) => {
				const text = `${used}/${window}`;
				return text + " ".repeat(Math.max(0, match.length - text.length));
			}),
		);
	};
}
