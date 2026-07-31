import assert from "node:assert/strict";
import test from "node:test";

import {
  formatContextResult,
  UNTRUSTED_CONTENT_BEGIN,
  UNTRUSTED_CONTENT_END,
} from "../tool-result.ts";

test("wraps complete results in an explicit untrusted-content boundary", () => {
  const result = formatContextResult("source-linked answer", { maxBytes: 100, maxLines: 10 });
  assert.equal(result.truncated, false);
  assert.equal(result.firstLineTruncated, false);
  assert.equal(result.returnedBytes, 20);
  assert.ok(result.text.startsWith(UNTRUSTED_CONTENT_BEGIN));
  assert.ok(result.text.endsWith(UNTRUSTED_CONTENT_END));
  assert.match(result.text, /source-linked answer/);
});

test("returns a nonempty UTF-8-safe prefix when the first line exceeds the byte limit", () => {
  const result = formatContextResult("😀".repeat(100), { maxBytes: 10, maxLines: 10 });
  assert.equal(result.truncated, true);
  assert.equal(result.firstLineTruncated, true);
  assert.equal(result.returnedBytes, 8);
  assert.match(result.text, /😀😀/);
  assert.doesNotMatch(result.text, /�/);
  assert.match(result.text, /first line was returned as a bounded UTF-8 prefix/);
  assert.match(result.text, /full output was not persisted for privacy/);
});

test("enforces the line limit and gives a recovery action", () => {
  const result = formatContextResult("one\ntwo\nthree", { maxBytes: 100, maxLines: 2 });
  assert.equal(result.truncated, true);
  assert.equal(result.returnedLines, 2);
  assert.equal(result.totalLines, 3);
  assert.match(result.text, /one\ntwo/);
  assert.doesNotMatch(result.text, /three/);
  assert.match(result.text, /Refine the query or request a smaller token budget/);
});
