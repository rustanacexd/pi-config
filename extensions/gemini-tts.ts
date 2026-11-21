// Gemini 3.8 TTS extension for visual-explainer narrated videos.
// Registers `gemini_tts_clips` to synthesize hash-named, config-cached .wav clips
// via the Gemini Interactions API (`GEMINI_API_KEY`) and to browse Gemini's voice catalog.
import { StringEnum } from "@earendil-works/pi-ai"
import { type ExtensionAPI, getAgentDir } from "@earendil-works/pi-coding-agent"
import { createHash, randomUUID } from "node:crypto"
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { homedir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { setTimeout as delay } from "node:timers/promises"
import { type Static, Type } from "typebox"
import { Value } from "typebox/value"

const INTERACTIONS_URL = "https://generativelanguage.googleapis.com/v1beta/interactions"
const VOICES_URL = "https://generativelanguage.googleapis.com/v1beta/voices"
const MANIFEST_NAME = ".gemini-tts.json"
const CLIP_ID_RE = /^[A-Za-z0-9._-]+$/
const LINE_PREFIX_RE = /^([A-Za-z0-9._-]+)\t(.*)$/

const MODELS = ["gemini-3.8-flash-tts", "gemini-3.8-flash-lite-tts"] as const
const DEFAULTS = {
  model: "gemini-3.8-flash-tts" as (typeof MODELS)[number],
  voice: "Charon",
  language: "en-US",
  seed: 42,
  concurrency: 20,
  maxConcurrency: 32,
  maxAttempts: 4,
  voiceLimit: 15,
  requestTimeoutMs: 60_000,
  maxRetryDelayMs: 60_000,
} as const

const paramsSchema = Type.Object({
  action: Type.Optional(StringEnum(["synthesize", "voices"] as const, {
    description: "synthesize (default): generate <id>.wav clips; voices: search Gemini's Extended Voice Library.",
  })),
  deckPath: Type.Optional(Type.String({
    description: "Path to a visual-explainer video deck (<deck.html>). Extracts lines with visual-explainer-video --lines.",
  })),
  lines: Type.Optional(Type.Array(
    Type.Object({
      id: Type.Optional(Type.String({ description: "Optional clip id; defaults to sha256(text).slice(0, 12)." })),
      text: Type.String({ description: "Verbatim narration line to synthesize." }),
    }),
    { description: "Explicit narration lines when not reading from a deck." },
  )),
  clipsDir: Type.Optional(Type.String({
    description: "Output folder for <id>.wav clips. Defaults to <deck-stem>.clips beside deckPath (required with lines).",
  })),
  model: Type.Optional(StringEnum(MODELS, {
    description: `Gemini 3.8 TTS model (default: ${DEFAULTS.model}; alt: gemini-3.8-flash-lite-tts).`,
  })),
  voice: Type.Optional(Type.String({
    description: `Prebuilt voice name, Extended Voice Library id (e.g. algenib, en-us-riko), or voice_... id. Fallback: ${DEFAULTS.voice}.`,
  })),
  language: Type.Optional(Type.String({
    description: `BCP-47 language code to pin accent/pronunciation (default: ${DEFAULTS.language}). Pass empty string to auto-detect.`,
  })),
  style: Type.Optional(Type.String({
    description: "Optional short constant speech_metadata.style note (omit by default to avoid voice drift).",
  })),
  seed: Type.Optional(Type.Integer({
    description: `Deterministic seed shared across clips for consistent tone and pacing (default: ${DEFAULTS.seed}).`,
  })),
  concurrency: Type.Optional(Type.Integer({
    minimum: 1,
    maximum: DEFAULTS.maxConcurrency,
    description: `Parallel Gemini TTS requests, 1-${DEFAULTS.maxConcurrency} (default: ${DEFAULTS.concurrency}).`,
  })),
  force: Type.Optional(Type.Boolean({
    description: "Regenerate clips even when cached with matching config (default: false).",
  })),
  search: Type.Optional(Type.String({
    description: "For action=voices: keyword filter (e.g. narrator, podcaster, warm).",
  })),
  regionCode: Type.Optional(Type.String({
    description: "For action=voices: two-letter region filter (e.g. US, GB, AU).",
  })),
  gender: Type.Optional(Type.String({
    description: "For action=voices: gender filter (male, female).",
  })),
  limit: Type.Optional(Type.Integer({
    minimum: 1,
    maximum: 50,
    description: `For action=voices: max voices to return (default: ${DEFAULTS.voiceLimit}).`,
  })),
})

const manifestSchema = Type.Object({
  clips: Type.Record(Type.String(), Type.String()),
})

const interactionResponseSchema = Type.Object({
  steps: Type.Optional(Type.Array(Type.Object({
    type: Type.Optional(Type.String()),
    content: Type.Optional(Type.Array(Type.Object({
      type: Type.Optional(Type.String()),
      data: Type.Optional(Type.String()),
      mime_type: Type.Optional(Type.String()),
    }))),
  }))),
})

const voiceRecordSchema = Type.Object({
  id: Type.Optional(Type.String()),
  gender: Type.Optional(Type.String()),
  pitch: Type.Optional(Type.String()),
  accent: Type.Optional(Type.String()),
  persona: Type.Optional(Type.String()),
  description: Type.Optional(Type.String()),
})

const voicesResponseSchema = Type.Object({
  voices: Type.Optional(Type.Array(voiceRecordSchema)),
})

type Params = Static<typeof paramsSchema>
type Manifest = Static<typeof manifestSchema>
type VoiceRecord = Static<typeof voiceRecordSchema>
type ClipEntry = { id: string; text: string }

type SynthesisConfig = {
  model: (typeof MODELS)[number]
  voice: string
  language: string
  style?: string
  seed: number
  concurrency: number
  force: boolean
}

type InputSource =
  | { kind: "deck"; deckPath: string; clipsDir: string }
  | { kind: "lines"; items: Array<{ id?: string; text: string }>; clipsDir: string }

type VoicesDetails = { action: "voices"; voiceCount: number }
type SynthesizeDetails = {
  action: "synthesize"
  clipsDir: string
  model?: string
  voice?: string
  language?: string
  seed?: number
  generated: number
  cached: number
  total: number
}
type ToolDetails = VoicesDetails | SynthesizeDetails

function normalizePath(raw: string, cwd: string): string {
  const stripped = raw.trim().replace(/^@/, "")
  if (stripped === "~") return homedir()
  if (stripped.startsWith("~/")) return join(homedir(), stripped.slice(2))
  return resolve(cwd, stripped)
}

function lineId(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 12)
}

function bufferHash(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex").slice(0, 16)
}

function isWavBuffer(buf: Buffer): boolean {
  return (
    buf.length >= 44 &&
    buf.subarray(0, 4).toString("ascii") === "RIFF" &&
    buf.subarray(8, 12).toString("ascii") === "WAVE"
  )
}

function findVideoRenderer(): string {
  const packaged = join(getAgentDir(), "npm", "node_modules", ".bin", "visual-explainer-video")
  return existsSync(packaged) ? packaged : "visual-explainer-video"
}

function assertClipId(id: string, context: string): void {
  if (!CLIP_ID_RE.test(id) || id === "." || id === "..") {
    throw new Error(`Invalid clip id ${JSON.stringify(id)} (${context})`)
  }
}

function normalizeEntries(raw: Array<{ id?: string; text: string }>, sourceKind: "deck" | "lines"): ClipEntry[] {
  const seen = new Map<string, string>()
  for (const [idx, item] of raw.entries()) {
    const text = sourceKind === "deck" ? item.text : item.text.trim()
    if (!text) {
      if (sourceKind === "deck") throw new Error(`Empty text for clip "${item.id ?? idx + 1}"`)
      continue
    }
    const id = item.id?.trim() || lineId(text)
    assertClipId(id, `entry ${idx + 1}`)
    const existing = seen.get(id)
    if (existing !== undefined && existing !== text) {
      throw new Error(`Duplicate clip id "${id}" with conflicting text`)
    }
    if (existing === undefined) seen.set(id, text)
  }
  return [...seen.entries()].map(([id, text]) => ({ id, text }))
}

function parseLinesOutput(stdout: string): ClipEntry[] {
  if (!stdout.trim()) return []
  const raw: Array<{ id: string; text: string }> = []
  const lines = stdout.replace(/\r?\n$/, "").split(/\r?\n/)
  for (const [idx, line] of lines.entries()) {
    const match = LINE_PREFIX_RE.exec(line)
    if (match) {
      raw.push({ id: match[1], text: match[2] })
    } else if (raw.length > 0) {
      raw[raw.length - 1].text += `\n${line}`
    } else if (line.trim()) {
      throw new Error(`Malformed --lines output on line ${idx + 1}`)
    }
  }
  return normalizeEntries(raw, "deck")
}

function parseSource(params: Params, cwd: string): InputSource {
  const hasDeck = Boolean(params.deckPath?.trim())
  const hasLines = Boolean(params.lines && params.lines.length > 0)
  if (hasDeck && hasLines) {
    throw new Error("Provide either deckPath or lines, not both.")
  }
  if (!hasDeck && !hasLines) {
    throw new Error("Provide either deckPath or a non-empty lines array.")
  }
  if (hasDeck) {
    const deckPath = normalizePath(params.deckPath!, cwd)
    if (!existsSync(deckPath)) throw new Error(`Deck file not found: ${deckPath}`)
    const clipsDir = params.clipsDir
      ? normalizePath(params.clipsDir, cwd)
      : `${deckPath.replace(/\.[^./]+$/, "")}.clips`
    return { kind: "deck", deckPath, clipsDir }
  }
  if (!params.clipsDir?.trim()) {
    throw new Error("clipsDir is required when using explicit lines without deckPath.")
  }
  return { kind: "lines", items: params.lines!, clipsDir: normalizePath(params.clipsDir, cwd) }
}

function resolveConfig(params: Params): SynthesisConfig {
  return {
    model: params.model ?? DEFAULTS.model,
    voice: params.voice?.trim() || DEFAULTS.voice,
    language: params.language === undefined ? DEFAULTS.language : params.language.trim(),
    style: params.style?.trim() || undefined,
    seed: params.seed ?? DEFAULTS.seed,
    concurrency: params.concurrency ?? DEFAULTS.concurrency,
    force: params.force ?? false,
  }
}

function readManifest(dir: string): Manifest {
  const file = join(dir, MANIFEST_NAME)
  if (!existsSync(file)) return { clips: {} }
  try {
    const parsed: unknown = JSON.parse(readFileSync(file, "utf8"))
    if (Value.Check(manifestSchema, parsed)) return { clips: { ...parsed.clips } }
  } catch {
    // Corrupt manifest falls back to empty and regenerates cleanly.
  }
  return { clips: {} }
}

function openClipCache(clipsDir: string, config: SynthesisConfig) {
  mkdirSync(clipsDir, { recursive: true })
  const initialManifest = readManifest(clipsDir)
  const baseConfig = {
    model: config.model,
    voice: config.voice,
    language: config.language,
    style: config.style ?? "",
    seed: config.seed,
  }
  const signature = (entry: ClipEntry, wavHash: string) =>
    JSON.stringify({ ...baseConfig, textHash: lineId(entry.text), wavHash })

  return {
    isFresh(entry: ClipEntry): boolean {
      const recorded = initialManifest.clips[entry.id]
      if (!recorded) return false
      const dest = join(clipsDir, `${entry.id}.wav`)
      try {
        const buf = readFileSync(dest)
        return isWavBuffer(buf) && recorded === signature(entry, bufferHash(buf))
      } catch {
        return false
      }
    },
    write(entry: ClipEntry, wav: Buffer): void {
      const dest = join(clipsDir, `${entry.id}.wav`)
      const wavTmp = join(clipsDir, `.${entry.id}.${process.pid}.${randomUUID()}.tmp`)
      const manifestTmp = join(clipsDir, `.${MANIFEST_NAME}.${process.pid}.${randomUUID()}.tmp`)
      try {
        writeFileSync(wavTmp, wav)
        renameSync(wavTmp, dest)
        const latest = readManifest(clipsDir)
        latest.clips[entry.id] = signature(entry, bufferHash(wav))
        writeFileSync(manifestTmp, JSON.stringify(latest, null, 2) + "\n")
        renameSync(manifestTmp, join(clipsDir, MANIFEST_NAME))
      } catch (err) {
        rmSync(wavTmp, { force: true })
        rmSync(manifestTmp, { force: true })
        throw err
      }
    },
  }
}

function parseRetryDelayMs(res: Response, errBody: string): number | undefined {
  const header = res.headers.get("retry-after")?.trim()
  if (header) {
    const seconds = Number(header)
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, DEFAULTS.maxRetryDelayMs)
    const dateMs = Date.parse(header)
    if (Number.isFinite(dateMs)) return Math.min(Math.max(0, dateMs - Date.now()), DEFAULTS.maxRetryDelayMs)
  }
  const match = /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/.exec(errBody)
  if (match) {
    const seconds = Number(match[1])
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, DEFAULTS.maxRetryDelayMs)
  }
  return undefined
}

async function geminiJsonFetch(
  url: string | URL,
  opts: { apiKey: string; label: string; body?: string; signal?: AbortSignal; retries?: number },
): Promise<unknown> {
  const maxAttempts = opts.retries ?? DEFAULTS.maxAttempts
  const headers: Record<string, string> = { "x-goog-api-key": opts.apiKey }
  if (opts.body !== undefined) headers["Content-Type"] = "application/json"

  for (let attempt = 1; ; attempt++) {
    if (opts.signal?.aborted) throw new Error("Cancelled")
    const timeoutSignal = AbortSignal.timeout(DEFAULTS.requestTimeoutMs)
    const combinedSignal = opts.signal ? AbortSignal.any([opts.signal, timeoutSignal]) : timeoutSignal
    try {
      const res = await fetch(url, {
        method: opts.body !== undefined ? "POST" : "GET",
        headers,
        body: opts.body,
        signal: combinedSignal,
      })
      if (res.ok) return await res.json()
      const errText = await res.text()
      const retryable = res.status === 429 || res.status >= 500
      if (!retryable || attempt >= maxAttempts) {
        throw new Error(`${opts.label} HTTP ${res.status}: ${errText.slice(0, 300)}`)
      }
      const serverWait = res.status === 429 ? parseRetryDelayMs(res, errText) : undefined
      const waitMs = serverWait ?? attempt * 1000 + Math.floor(Math.random() * 400)
      await delay(waitMs, undefined, { signal: opts.signal })
    } catch (err) {
      if (opts.signal?.aborted) throw new Error("Cancelled")
      if (err instanceof Error && err.message.startsWith(`${opts.label} HTTP `)) throw err
      if (attempt >= maxAttempts) throw err
      await delay(attempt * 1000 + Math.floor(Math.random() * 400), undefined, { signal: opts.signal })
    }
  }
}

async function synthesizeClip(
  apiKey: string,
  config: SynthesisConfig,
  text: string,
  signal: AbortSignal,
): Promise<Buffer> {
  const body = JSON.stringify({
    model: config.model,
    store: false,
    input: [
      {
        type: "user_input",
        content: [
          {
            type: "text",
            text,
            ...(config.style ? { annotations: [{ type: "speech_metadata", style: config.style }] } : {}),
          },
        ],
      },
    ],
    response_format: { type: "audio" },
    generation_config: {
      seed: config.seed,
      speech_config: [{ voice: config.voice, ...(config.language ? { language: config.language } : {}) }],
    },
  })

  const json = await geminiJsonFetch(INTERACTIONS_URL, { apiKey, label: "Gemini TTS", body, signal })
  if (!Value.Check(interactionResponseSchema, json)) {
    throw new Error("Unexpected Gemini TTS response shape")
  }
  const audio = (json.steps ?? [])
    .filter((s) => s.type === "model_output")
    .flatMap((s) => s.content ?? [])
    .filter((c) => c.type === "audio" && typeof c.data === "string")
    .at(-1)
  if (!audio?.data) throw new Error("Gemini TTS response contained no audio block")
  const wav = Buffer.from(audio.data, "base64")
  if (!isWavBuffer(wav)) {
    throw new Error(`Expected RIFF/WAVE payload, got ${wav.length} bytes (${audio.mime_type ?? "unknown"})`)
  }
  return wav
}

async function listVoices(apiKey: string, params: Params, signal?: AbortSignal): Promise<VoiceRecord[]> {
  const url = new URL(VOICES_URL)
  const limit = params.limit ?? DEFAULTS.voiceLimit
  url.searchParams.set("page_size", String(limit))
  if (params.search?.trim()) url.searchParams.set("search", params.search.trim())
  if (params.regionCode?.trim()) url.searchParams.set("region_code", params.regionCode.trim().toUpperCase())
  if (params.gender?.trim()) url.searchParams.set("gender", params.gender.trim().toLowerCase())

  const json = await geminiJsonFetch(url, { apiKey, label: "Gemini Voices", signal, retries: 2 })
  if (!Value.Check(voicesResponseSchema, json)) {
    throw new Error("Unexpected Gemini Voices response shape")
  }
  return (json.voices ?? []).slice(0, limit)
}

async function mapPool<T>(
  items: T[],
  concurrency: number,
  signal: AbortSignal | undefined,
  fn: (item: T, workerSignal: AbortSignal) => Promise<void>,
): Promise<void> {
  if (!items.length) return
  const ac = new AbortController()
  const onExternalAbort = () => ac.abort(signal?.reason ?? new Error("Cancelled"))
  if (signal?.aborted) {
    onExternalAbort()
    throw new Error("Cancelled")
  }
  signal?.addEventListener("abort", onExternalAbort, { once: true })

  let cursor = 0
  let firstError: unknown
  const worker = async () => {
    while (!ac.signal.aborted && cursor < items.length) {
      const item = items[cursor++]
      try {
        await fn(item, ac.signal)
      } catch (err) {
        if (firstError === undefined) {
          firstError = err
          ac.abort(err)
        }
        return
      }
    }
  }

  try {
    await Promise.allSettled(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()))
  } finally {
    signal?.removeEventListener("abort", onExternalAbort)
  }
  if (firstError !== undefined) throw firstError
  if (signal?.aborted) throw new Error("Cancelled")
}

function makeDetails(
  clipsDir: string,
  config: SynthesisConfig,
  generated: number,
  cached: number,
  total: number,
): SynthesizeDetails {
  return {
    action: "synthesize",
    clipsDir,
    model: config.model,
    voice: config.voice,
    language: config.language,
    seed: config.seed,
    generated,
    cached,
    total,
  }
}

export default function geminiTts(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "gemini_tts_clips",
    label: "Gemini TTS Clips",
    description:
      "Generate cached 24 kHz WAV narration clips for visual-explainer videos using Gemini 3.8 TTS (GEMINI_API_KEY), or search Gemini's Extended Voice Library.",
    promptSnippet:
      "Generate cached Gemini 3.8 TTS .wav voice clips for visual-explainer videos (or search Gemini voices)",
    promptGuidelines: [
      "Use gemini_tts_clips when generating voice clips for visual-explainer videos (references/video.md) and GEMINI_API_KEY is set, then pass the resulting clipsDir to visual-explainer-video --voice.",
      "Pick the voice to fit the deck unless the user specifies one: Charon (male, informative) for technical explainers, architecture, and deep-dives; Erinome (female, clear) for step-by-step tutorials, walkthroughs, and onboarding; Algieba (male, smooth) for polished executive or stakeholder overviews; Puck (male, upbeat) for product demos, launches, and energetic recaps. Use action='voices' if the user asks for another accent or persona.",
      "Leave gemini_tts_clips style unset by default so Gemini 3.8 TTS anchors cleanly on the voice; only pass a short constant style when a specific delivery tweak is needed.",
    ],
    parameters: paramsSchema,

    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      const apiKey = process.env.GEMINI_API_KEY?.trim()
      if (!apiKey) throw new Error("GEMINI_API_KEY is not set in the environment.")

      if ((params.action ?? "synthesize") === "voices") {
        const voices = await listVoices(apiKey, params, signal)
        const text = voices.length
          ? voices.map((v) => [v.id ?? "?", v.gender, v.pitch, v.accent, v.persona].filter(Boolean).join(" · ")).join("\n")
          : "No Gemini voices matched those filters."
        return { content: [{ type: "text", text }], details: { action: "voices", voiceCount: voices.length } satisfies ToolDetails }
      }

      const source = parseSource(params, ctx.cwd)
      let entries: ClipEntry[]
      if (source.kind === "deck") {
        onUpdate?.({
          content: [{ type: "text", text: `Extracting narration lines from ${source.deckPath}...` }],
          details: { action: "synthesize", clipsDir: source.clipsDir, generated: 0, cached: 0, total: 0 } satisfies ToolDetails,
        })
        const extracted = await pi.exec(findVideoRenderer(), [source.deckPath, "--lines"], {
          cwd: dirname(source.deckPath),
          signal,
        })
        if (extracted.killed || signal?.aborted) throw new Error("Cancelled")
        if (extracted.code !== 0) {
          throw new Error(`visual-explainer-video --lines failed (${extracted.code}): ${extracted.stderr || extracted.stdout}`)
        }
        entries = parseLinesOutput(extracted.stdout)
      } else {
        entries = normalizeEntries(source.items, "lines")
      }

      if (!entries.length) {
        const text = source.kind === "deck"
          ? "Deck has 0 narration lines; no clips needed."
          : "No non-empty narration lines provided; no clips needed."
        return {
          content: [{ type: "text", text }],
          details: { action: "synthesize", clipsDir: source.clipsDir, generated: 0, cached: 0, total: 0 } satisfies ToolDetails,
        }
      }

      const config = resolveConfig(params)
      const cache = openClipCache(source.clipsDir, config)
      const todo = config.force ? entries : entries.filter((e) => !cache.isFresh(e))
      const cached = entries.length - todo.length
      let generated = 0

      await mapPool(todo, config.concurrency, signal, async (entry, workerSignal) => {
        try {
          const wav = await synthesizeClip(apiKey, config, entry.text, workerSignal)
          if (workerSignal.aborted) return
          cache.write(entry, wav)
          generated++
          onUpdate?.({
            content: [{ type: "text", text: `Synthesized ${generated}/${todo.length} clip(s) into ${source.clipsDir}...` }],
            details: makeDetails(source.clipsDir, config, generated, cached, entries.length),
          })
        } catch (err) {
          if (workerSignal.aborted) throw err
          const msg = err instanceof Error ? err.message : String(err)
          throw new Error(`Clip ${entry.id} failed: ${msg}`)
        }
      })

      const details = makeDetails(source.clipsDir, config, generated, cached, entries.length)
      return {
        content: [
          {
            type: "text",
            text: `${generated} generated, ${cached} cached in ${source.clipsDir} (${config.model}, voice=${config.voice}, language=${config.language || "auto"}, seed=${config.seed})`,
          },
        ],
        details,
      }
    },
  })
}
