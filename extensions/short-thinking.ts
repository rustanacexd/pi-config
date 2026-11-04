import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const KEEP_FRACTION = 0.25;

export function quarter(markdown: string): string {
	const sentences = markdown.trim().split(/(?<=[.!?])\s+/).filter(Boolean);
	const keep = Math.max(1, Math.ceil(sentences.length * KEEP_FRACTION));
	if (keep >= sentences.length) return markdown;
	return `${sentences.slice(0, keep).join(" ")} …`;
}

export default function (pi: ExtensionAPI) {
	pi.registerMarkdownTransformer((markdown, { messageType }) =>
		messageType === "assistant-thinking" ? quarter(markdown) : markdown,
	);
}
