import assert from "node:assert/strict";
import test from "node:test";

import {
  ExaContextError,
  requestExaCodeContext,
  validateContextRequest,
} from "../client.ts";

const successPayload = {
  requestId: "req-123",
  query: "axum routes",
  response: "Use /{id}. https://docs.rs/axum",
  resultsCount: 4,
  costDollars: { total: 0.007, search: { neural: 0.007 } },
  searchTime: 123,
  outputTokens: 42,
};

function jsonResponse(body: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

test("validates the documented request bounds", () => {
  assert.deepEqual(validateContextRequest({ query: "  axum routes  " }), {
    query: "axum routes",
    tokensNum: "dynamic",
  });
  assert.deepEqual(validateContextRequest({ query: "q", tokensNum: 50 }), {
    query: "q",
    tokensNum: 50,
  });
  assert.deepEqual(validateContextRequest({ query: "q", tokensNum: 100_000 }), {
    query: "q",
    tokensNum: 100_000,
  });
  assert.throws(() => validateContextRequest({ query: "   " }), /query must contain/);
  assert.throws(() => validateContextRequest({ query: "x".repeat(2001) }), /at most 2000/);
  assert.throws(() => validateContextRequest({ query: "q", tokensNum: 49 }), /50 and 100000/);
  assert.throws(() => validateContextRequest({ query: "q", tokensNum: 100_001 }), /50 and 100000/);
});

test("calls /context with header authentication and projects the documented response", async () => {
  let observedUrl = "";
  let observedInit: RequestInit | undefined;
  const result = await requestExaCodeContext(
    { query: " axum routes ", tokensNum: 1_000 },
    {
      apiKey: "test-secret",
      fetchImpl: async (input, init) => {
        observedUrl = String(input);
        observedInit = init;
        return jsonResponse(successPayload);
      },
    },
  );

  assert.equal(observedUrl, "https://api.exa.ai/context");
  assert.equal(observedInit?.method, "POST");
  const headers = new Headers(observedInit?.headers);
  assert.equal(headers.get("authorization"), "Bearer test-secret");
  assert.equal(headers.get("content-type"), "application/json");
  assert.deepEqual(JSON.parse(String(observedInit?.body)), {
    query: "axum routes",
    tokensNum: 1_000,
  });
  assert.deepEqual(result, successPayload);
});

test("uses EXA_API_KEY and dynamic tokens by default", async () => {
  let observedBody: unknown;
  let observedAuth: string | null = null;
  await requestExaCodeContext(
    { query: "serde examples" },
    {
      env: { EXA_API_KEY: "env-secret" },
      fetchImpl: async (_input, init) => {
        observedBody = JSON.parse(String(init?.body));
        observedAuth = new Headers(init?.headers).get("authorization");
        return jsonResponse(successPayload);
      },
    },
  );
  assert.deepEqual(observedBody, { query: "serde examples", tokensNum: "dynamic" });
  assert.equal(observedAuth, "Bearer env-secret");
});

test("fails before network access when EXA_API_KEY is absent", async () => {
  let calls = 0;
  await assert.rejects(
    requestExaCodeContext(
      { query: "serde" },
      {
        env: {},
        fetchImpl: async () => {
          calls += 1;
          return jsonResponse(successPayload);
        },
      },
    ),
    /EXA_CONTEXT_API_KEY or EXA_API_KEY is not configured/,
  );
  assert.equal(calls, 0);
});

test("honors Retry-After for 429 and then succeeds", async () => {
  let calls = 0;
  const sleeps: number[] = [];
  const result = await requestExaCodeContext(
    { query: "tokio" },
    {
      apiKey: "secret",
      fetchImpl: async () => {
        calls += 1;
        if (calls === 1) return jsonResponse({ error: "limited" }, 429, { "retry-after": "2" });
        return jsonResponse(successPayload);
      },
      sleep: async (milliseconds) => {
        sleeps.push(milliseconds);
      },
    },
  );
  assert.equal(result.response, successPayload.response);
  assert.equal(calls, 2);
  assert.deepEqual(sleeps, [2_000]);
});

test("retries transient 5xx with bounded backoff", async () => {
  let calls = 0;
  const sleeps: number[] = [];
  await requestExaCodeContext(
    { query: "tokio" },
    {
      apiKey: "secret",
      maxRetries: 2,
      random: () => 0,
      fetchImpl: async () => {
        calls += 1;
        if (calls < 3) return jsonResponse({}, 503);
        return jsonResponse(successPayload);
      },
      sleep: async (milliseconds) => {
        sleeps.push(milliseconds);
      },
    },
  );
  assert.equal(calls, 3);
  assert.deepEqual(sleeps, [500, 1_000]);
});

test("does not retry non-transient HTTP failures or expose response bodies", async () => {
  for (const status of [400, 401, 403]) {
    let calls = 0;
    await assert.rejects(
      requestExaCodeContext(
        { query: "tokio" },
        {
          apiKey: "secret-value",
          fetchImpl: async () => {
            calls += 1;
            return new Response("server echoed secret-value", { status });
          },
        },
      ),
      (error: unknown) => {
        assert.ok(error instanceof ExaContextError);
        assert.equal(error.status, status);
        assert.doesNotMatch(error.message, /secret-value|server echoed/);
        return true;
      },
    );
    assert.equal(calls, 1);
  }
});

test("propagates caller cancellation", async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    requestExaCodeContext(
      { query: "tokio" },
      {
        apiKey: "secret",
        signal: controller.signal,
        fetchImpl: async () => jsonResponse(successPayload),
      },
    ),
    /aborted/i,
  );
});

test("enforces a bounded request timeout during fetch", async () => {
  await assert.rejects(
    requestExaCodeContext(
      { query: "tokio" },
      {
        apiKey: "secret",
        timeoutMs: 5,
        fetchImpl: async (_input, init) => {
          await new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
          });
          return jsonResponse(successPayload);
        },
      },
    ),
    /timed out after 5ms/,
  );
});

test("prefers a Context-specific key when configured", async () => {
  let authorization: string | null = null;
  await requestExaCodeContext(
    { query: "tokio" },
    {
      env: { EXA_CONTEXT_API_KEY: "context-key", EXA_API_KEY: "shared-key" },
      fetchImpl: async (_input, init) => {
        authorization = new Headers(init?.headers).get("authorization");
        return jsonResponse(successPayload);
      },
    },
  );
  assert.equal(authorization, "Bearer context-key");
});

test("normalizes timeout while reading the response body", async () => {
  await assert.rejects(
    requestExaCodeContext(
      { query: "tokio" },
      {
        apiKey: "secret",
        timeoutMs: 5,
        fetchImpl: async (_input, init) => new Response(new ReadableStream({
          start(controller) {
            init?.signal?.addEventListener("abort", () => controller.error(init.signal?.reason), { once: true });
          },
        })),
      },
    ),
    /timed out after 5ms/,
  );
});

test("normalizes timeout and caller cancellation during retry backoff", async () => {
  const blockingSleep = async (_milliseconds: number, signal?: AbortSignal): Promise<void> => {
    await new Promise((_resolve, reject) => {
      signal?.addEventListener("abort", () => reject(signal.reason), { once: true });
    });
  };
  await assert.rejects(
    requestExaCodeContext(
      { query: "tokio" },
      {
        apiKey: "secret",
        timeoutMs: 5,
        fetchImpl: async () => jsonResponse({}, 503),
        sleep: blockingSleep,
      },
    ),
    /timed out after 5ms/,
  );

  const controller = new AbortController();
  const request = requestExaCodeContext(
    { query: "tokio" },
    {
      apiKey: "secret",
      signal: controller.signal,
      fetchImpl: async () => jsonResponse({}, 503),
      sleep: blockingSleep,
    },
  );
  setTimeout(() => controller.abort(), 1);
  await assert.rejects(request, /request was aborted/);
});

test("surfaces final Retry-After without exposing the response body", async () => {
  await assert.rejects(
    requestExaCodeContext(
      { query: "tokio" },
      {
        apiKey: "secret-value",
        maxRetries: 0,
        fetchImpl: async () => new Response("secret-value", {
          status: 429,
          headers: { "retry-after": "17" },
        }),
      },
    ),
    (error: unknown) => {
      assert.ok(error instanceof ExaContextError);
      assert.equal(error.retryAfterMs, 17_000);
      assert.match(error.message, /approximately 17 seconds/);
      assert.doesNotMatch(error.message, /secret-value/);
      return true;
    },
  );
});

test("rejects oversized responses from Content-Length or streamed bytes", async () => {
  await assert.rejects(
    requestExaCodeContext(
      { query: "tokio" },
      {
        apiKey: "secret",
        maxResponseBytes: 100,
        fetchImpl: async () => new Response(JSON.stringify(successPayload), {
          status: 200,
          headers: { "content-length": "1000", "content-type": "application/json" },
        }),
      },
    ),
    /exceeded the 100-byte safety limit/,
  );

  const oversized = JSON.stringify({ ...successPayload, response: "x".repeat(500) });
  await assert.rejects(
    requestExaCodeContext(
      { query: "tokio" },
      {
        apiKey: "secret",
        maxResponseBytes: 100,
        fetchImpl: async () => new Response(new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(oversized));
            controller.close();
          },
        }), { headers: { "content-type": "application/json" } }),
      },
    ),
    /exceeded the 100-byte safety limit/,
  );
});

test("handles malformed, empty, and exhausted network responses safely", async () => {
  await assert.rejects(
    requestExaCodeContext(
      { query: "tokio" },
      { apiKey: "secret", fetchImpl: async () => new Response("not json") },
    ),
    /malformed JSON/,
  );
  await assert.rejects(
    requestExaCodeContext(
      { query: "tokio" },
      { apiKey: "secret", fetchImpl: async () => jsonResponse({ response: "" }) },
    ),
    /empty or invalid response/,
  );

  let calls = 0;
  await assert.rejects(
    requestExaCodeContext(
      { query: "tokio" },
      {
        apiKey: "secret-value",
        maxRetries: 1,
        fetchImpl: async () => {
          calls += 1;
          throw new Error("network echoed secret-value");
        },
        sleep: async () => {},
      },
    ),
    (error: unknown) => {
      assert.ok(error instanceof ExaContextError);
      assert.match(error.message, /network request failed after retries/);
      assert.doesNotMatch(error.message, /secret-value/);
      return true;
    },
  );
  assert.equal(calls, 2);
});

test("validates client safety options", async () => {
  await assert.rejects(
    requestExaCodeContext({ query: "tokio" }, { apiKey: "secret", timeoutMs: 0 }),
    /timeout must be a positive number/,
  );
  await assert.rejects(
    requestExaCodeContext({ query: "tokio" }, { apiKey: "secret", maxRetries: 6 }),
    /maxRetries must be an integer between 0 and 5/,
  );
  await assert.rejects(
    requestExaCodeContext({ query: "tokio" }, { apiKey: "secret", maxResponseBytes: 0 }),
    /maxResponseBytes must be an integer/,
  );
});
