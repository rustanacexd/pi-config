export const UNTRUSTED_CONTENT_BEGIN = "[BEGIN EXA CODE CONTEXT — UNTRUSTED EXTERNAL CONTENT]";
export const UNTRUSTED_CONTENT_END = "[END EXA CODE CONTEXT — UNTRUSTED EXTERNAL CONTENT]";

export interface FormattedContextResult {
  text: string;
  truncated: boolean;
  returnedLines: number;
  totalLines: number;
  returnedBytes: number;
  totalBytes: number;
  firstLineTruncated: boolean;
}

function utf8Length(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function safeUtf8Prefix(value: string, maxBytes: number): string {
  let bytes = 0;
  let end = 0;
  for (const character of value) {
    const characterBytes = utf8Length(character);
    if (bytes + characterBytes > maxBytes) break;
    bytes += characterBytes;
    end += character.length;
  }
  return value.slice(0, end);
}

function lineLimitedPrefix(value: string, maxLines: number): string {
  if (maxLines <= 0) return "";
  let seen = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== "\n") continue;
    seen += 1;
    if (seen >= maxLines) return value.slice(0, index);
  }
  return value;
}

function lineCount(value: string): number {
  if (!value) return 0;
  let count = 1;
  for (const character of value) {
    if (character === "\n") count += 1;
  }
  return count;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export function formatContextResult(
  response: string,
  limits: { maxBytes: number; maxLines: number },
): FormattedContextResult {
  const totalBytes = utf8Length(response);
  const totalLines = lineCount(response);
  const lineLimited = lineLimitedPrefix(response, limits.maxLines);
  const content = safeUtf8Prefix(lineLimited, limits.maxBytes);
  const returnedBytes = utf8Length(content);
  const returnedLines = lineCount(content);
  const truncated = content.length < response.length;
  const firstNewline = response.indexOf("\n");
  const firstLineLength = firstNewline === -1 ? response.length : firstNewline;
  const firstLineTruncated = truncated && content.length < firstLineLength;

  let notice = "";
  if (truncated) {
    notice = `\n\n[Output truncated safely: showing ${returnedLines} of ${totalLines} lines and ${formatBytes(returnedBytes)} of ${formatBytes(totalBytes)}.`;
    if (firstLineTruncated) notice += " The first line was returned as a bounded UTF-8 prefix.";
    notice += " Refine the query or request a smaller token budget for a complete result; full output was not persisted for privacy.]";
  }

  return {
    text: `${UNTRUSTED_CONTENT_BEGIN}\n${content}${notice}\n${UNTRUSTED_CONTENT_END}`,
    truncated,
    returnedLines,
    totalLines,
    returnedBytes,
    totalBytes,
    firstLineTruncated,
  };
}
