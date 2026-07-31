const EXA_CONTEXT_URL = "https://api.exa.ai/context";
const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_RETRIES = 2;
const MAX_RETRY_DELAY_MS = 30_000;

export const EXA_CONTEXT_QUERY_MAX_LENGTH = 2_000;
export const EXA_CONTEXT_TOKEN_MIN = 50;
export const EXA_CONTEXT_TOKEN_MAX = 100_000;
export const EXA_CONTEXT_HIGH_COST_THRESHOLD = 10_000;
export const EXA_CONTEXT_RESPONSE_MAX_BYTES = 2 * 1024 * 1024;

export type ContextTokenBudget = "dynamic" | number;
export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export interface ExaContextRequest {
  query: string;
  tokensNum?: ContextTokenBudget;
}

export interface ValidatedExaContextRequest {
  query: string;
  tokensNum: ContextTokenBudget;
}

export interface ExaContextResponse {
  requestId?: string;
  query?: string;
  response: string;
  resultsCount?: number;
  costDollars?: Record<string, unknown>;
  searchTime?: number;
  outputTokens?: number;
}

export interface ExaContextClientOptions {
  apiKey?: string;
  env?: Record<string, string | undefined>;
  signal?: AbortSignal;
  timeoutMs?: number;
  maxRetries?: number;
  maxResponseBytes?: number;
  fetchImpl?: FetchLike;
  sleep?: (milliseconds: number, signal?: AbortSignal) => Promise<void>;
  random?: () => number;
}

export class ExaContextError extends Error {
  readonly status?: number;
  readonly retryAfterMs?: number;

  constructor(message: string, options: { status?: number; retryAfterMs?: number } = {}) {
    super(message);
    this.name = "ExaContextError";
    this.status = options.status;
    this.retryAfterMs = options.retryAfterMs;
  }
}

export function validateContextRequest(request: ExaContextRequest): ValidatedExaContextRequest {
  if (typeof request.query !== "string") {
    throw new ExaContextError("Exa Context query must be a string");
  }
  const query = request.query.trim();
  if (!query) {
    throw new ExaContextError("Exa Context query must contain non-whitespace characters");
  }
  if (query.length > EXA_CONTEXT_QUERY_MAX_LENGTH) {
    throw new ExaContextError(`Exa Context query must be at most ${EXA_CONTEXT_QUERY_MAX_LENGTH} characters`);
  }

  const tokensNum = request.tokensNum ?? "dynamic";
  if (tokensNum !== "dynamic") {
    if (!Number.isInteger(tokensNum) || tokensNum < EXA_CONTEXT_TOKEN_MIN || tokensNum > EXA_CONTEXT_TOKEN_MAX) {
      throw new ExaContextError(
        `Exa Context tokensNum must be 'dynamic' or an integer between ${EXA_CONTEXT_TOKEN_MIN} and ${EXA_CONTEXT_TOKEN_MAX}`,
      );
    }
  }

  return { query, tokensNum };
}

function retryAfterMilliseconds(value: string | null, now = Date.now()): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1_000, MAX_RETRY_DELAY_MS);
  }
  const date = Date.parse(value);
  if (!Number.isFinite(date)) return undefined;
  return Math.min(Math.max(0, date - now), MAX_RETRY_DELAY_MS);
}

function backoffMilliseconds(attempt: number, random: () => number): number {
  const base = Math.min(500 * 2 ** attempt, 8_000);
  return Math.min(base + Math.floor(random() * base * 0.25), MAX_RETRY_DELAY_MS);
}

function isTransientStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status <= 599);
}

function formatRetryAfter(retryAfterMs: number | undefined): string {
  if (retryAfterMs === undefined) return "";
  const seconds = Math.max(1, Math.ceil(retryAfterMs / 1_000));
  return `; retry after approximately ${seconds} second${seconds === 1 ? "" : "s"}`;
}

function statusMessage(status: number, retryAfterMs?: number): string {
  if (status === 400) return "Exa Context rejected the request (HTTP 400)";
  if (status === 401) return "Exa Context authentication failed (HTTP 401); verify EXA_CONTEXT_API_KEY or EXA_API_KEY";
  if (status === 403) return "Exa Context access was forbidden (HTTP 403); verify account access";
  if (status === 429) {
    return `Exa Context rate limit persisted after retries (HTTP 429)${formatRetryAfter(retryAfterMs)}`;
  }
  if (status >= 500) return `Exa Context service remained unavailable after retries (HTTP ${status})`;
  return `Exa Context request failed (HTTP ${status})`;
}

function classifyAbort(
  combinedSignal: AbortSignal,
  timeoutSignal: AbortSignal,
  callerSignal: AbortSignal | undefined,
  timeoutMs: number,
): ExaContextError | undefined {
  if (!combinedSignal.aborted) return undefined;
  if (timeoutSignal.aborted && !callerSignal?.aborted) {
    return new ExaContextError(`Exa Context request timed out after ${timeoutMs}ms`);
  }
  return new ExaContextError("Exa Context request was aborted");
}

function throwIfAborted(
  combinedSignal: AbortSignal,
  timeoutSignal: AbortSignal,
  callerSignal: AbortSignal | undefined,
  timeoutMs: number,
): void {
  const error = classifyAbort(combinedSignal, timeoutSignal, callerSignal, timeoutMs);
  if (error) throw error;
}

function defaultSleep(milliseconds: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason ?? new DOMException("Aborted", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, milliseconds);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

async function waitBeforeRetry(
  milliseconds: number,
  sleep: (milliseconds: number, signal?: AbortSignal) => Promise<void>,
  combinedSignal: AbortSignal,
  timeoutSignal: AbortSignal,
  callerSignal: AbortSignal | undefined,
  timeoutMs: number,
): Promise<void> {
  try {
    await sleep(milliseconds, combinedSignal);
  } catch {
    const abort = classifyAbort(combinedSignal, timeoutSignal, callerSignal, timeoutMs);
    if (abort) throw abort;
    throw new ExaContextError("Exa Context retry wait failed");
  }
}

async function discardResponseBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // Error bodies are intentionally neither read nor surfaced.
  }
}

async function readBoundedJson(response: Response, maxBytes: number): Promise<unknown> {
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    await discardResponseBody(response);
    throw new ExaContextError(`Exa Context response exceeded the ${maxBytes}-byte safety limit`);
  }
  if (!response.body) {
    throw new ExaContextError("Exa Context returned an empty response body");
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw new ExaContextError(`Exa Context response exceeded the ${maxBytes}-byte safety limit`);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const text = new TextDecoder().decode(bytes);
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ExaContextError("Exa Context returned malformed JSON");
  }
}

function projectCostDollars(value: unknown, depth = 0): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value) || depth > 2) return undefined;
  const projected: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value).slice(0, 20)) {
    if (typeof child === "number" && Number.isFinite(child)) {
      projected[key.slice(0, 100)] = child;
      continue;
    }
    const nested = projectCostDollars(child, depth + 1);
    if (nested && Object.keys(nested).length > 0) projected[key.slice(0, 100)] = nested;
  }
  return Object.keys(projected).length > 0 ? projected : undefined;
}

function projectResponse(value: unknown): ExaContextResponse {
  if (!value || typeof value !== "object") {
    throw new ExaContextError("Exa Context returned an invalid JSON response");
  }
  const raw = value as Record<string, unknown>;
  if (typeof raw.response !== "string" || !raw.response.trim()) {
    throw new ExaContextError("Exa Context returned an empty or invalid response");
  }

  const result: ExaContextResponse = { response: raw.response };
  if (typeof raw.requestId === "string") result.requestId = raw.requestId.slice(0, 500);
  if (typeof raw.query === "string") result.query = raw.query.slice(0, EXA_CONTEXT_QUERY_MAX_LENGTH);
  if (typeof raw.resultsCount === "number" && Number.isFinite(raw.resultsCount)) result.resultsCount = raw.resultsCount;
  const costDollars = projectCostDollars(raw.costDollars);
  if (costDollars) result.costDollars = costDollars;
  if (typeof raw.searchTime === "number" && Number.isFinite(raw.searchTime)) result.searchTime = raw.searchTime;
  if (typeof raw.outputTokens === "number" && Number.isFinite(raw.outputTokens)) result.outputTokens = raw.outputTokens;
  return result;
}

export async function requestExaCodeContext(
  request: ExaContextRequest,
  options: ExaContextClientOptions = {},
): Promise<ExaContextResponse> {
  const body = validateContextRequest(request);
  const environment = options.env ?? process.env;
  const apiKey = options.apiKey ?? environment.EXA_CONTEXT_API_KEY ?? environment.EXA_API_KEY;
  if (!apiKey) {
    throw new ExaContextError("EXA_CONTEXT_API_KEY or EXA_API_KEY is not configured for Exa Context");
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new ExaContextError("Exa Context timeout must be a positive number");
  }
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  if (!Number.isInteger(maxRetries) || maxRetries < 0 || maxRetries > 5) {
    throw new ExaContextError("Exa Context maxRetries must be an integer between 0 and 5");
  }
  const maxResponseBytes = options.maxResponseBytes ?? EXA_CONTEXT_RESPONSE_MAX_BYTES;
  if (!Number.isInteger(maxResponseBytes) || maxResponseBytes <= 0 || maxResponseBytes > 10 * 1024 * 1024) {
    throw new ExaContextError("Exa Context maxResponseBytes must be an integer between 1 and 10485760");
  }

  const fetchImpl: FetchLike = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? defaultSleep;
  const random = options.random ?? Math.random;
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const signal = options.signal ? AbortSignal.any([options.signal, timeoutSignal]) : timeoutSignal;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    throwIfAborted(signal, timeoutSignal, options.signal, timeoutMs);

    let response: Response;
    try {
      response = await fetchImpl(EXA_CONTEXT_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal,
      });
    } catch {
      const abort = classifyAbort(signal, timeoutSignal, options.signal, timeoutMs);
      if (abort) throw abort;
      if (attempt < maxRetries) {
        await waitBeforeRetry(
          backoffMilliseconds(attempt, random),
          sleep,
          signal,
          timeoutSignal,
          options.signal,
          timeoutMs,
        );
        continue;
      }
      throw new ExaContextError("Exa Context network request failed after retries");
    }

    if (response.ok) {
      let payload: unknown;
      try {
        payload = await readBoundedJson(response, maxResponseBytes);
      } catch (error) {
        const abort = classifyAbort(signal, timeoutSignal, options.signal, timeoutMs);
        if (abort) throw abort;
        if (error instanceof ExaContextError) throw error;
        throw new ExaContextError("Exa Context response read failed");
      }
      return projectResponse(payload);
    }

    const retryAfterMs = retryAfterMilliseconds(response.headers.get("retry-after"));
    await discardResponseBody(response);
    if (isTransientStatus(response.status) && attempt < maxRetries) {
      await waitBeforeRetry(
        retryAfterMs ?? backoffMilliseconds(attempt, random),
        sleep,
        signal,
        timeoutSignal,
        options.signal,
        timeoutMs,
      );
      continue;
    }
    throw new ExaContextError(statusMessage(response.status, retryAfterMs), {
      status: response.status,
      retryAfterMs,
    });
  }

  throw new ExaContextError("Exa Context request failed");
}
