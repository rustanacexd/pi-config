// Gemini 3.8 TTS extension for visual-explainer narrated videos.
// Registers `gemini_tts_clips` to synthesize hash-named, config-cached .wav clips
// via the Gemini Interactions API (`GEMINI_API_KEY`) and to browse Gemini's voice catalog.
import { StringEnum } from "@earendil-works/pi-ai"
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { type Static, Type } from "typebox"

const INTERACTIONS_URL = "https://generativelanguage.googleapis.com/v1beta/interactions"
const VOICES_URL = "https://generativelanguage.googleapis.com/v1beta/voices"

const MODELS = ["gemini-3.8-flash-tts", "gemini-3.8-flash-lite-tts"] as const
const DEFAULT_MODEL = "gemini-3.8-flash-tts"
const DEFAULT_VOICE = "Charon"
const DEFAULT_LANGUAGE = "en-US"
const DEFAULT_SEED = 42
const DEFAULT_CONCURRENCY = 20
const MAX_CONCURRENCY = 32
const MAX_ATTEMPTS = 3
const MANIFEST_NAME = ".gemini-tts.json"

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
    description: "Output folder for <id>.wav clips. Defaults to <deck-stem>.clips beside deckPath.",
  })),
  model: Type.Optional(StringEnum(MODELS, {
    description: "Gemini 3.8 TTS model (default: gemini-3.8-flash-tts; alt: gemini-3.8-flash-lite-tts).",
  })),
  voice: Type.Optional(Type.String({
    description:
      "Voice to use. Pick by tone when unspecified: Charon (technical explainers/architecture), Erinome (tutorials/walkthroughs), Algieba (polished/executive overviews), Puck (product demos/upbeat recaps), or any prebuilt/Extended Voice Library/voice_... id. Fallback: Charon.",
  })),
  language: Type.Optional(Type.String({
    description: "BCP-47 language code to pin accent/pronunciation (default: en-US). Pass empty string to auto-detect.",
  })),
  style: Type.Optional(Type.String({
    description: "Optional short constant speech_metadata.style note (omit by default to avoid voice drift).",
  })),
  seed: Type.Optional(Type.Integer({
    description: "Deterministic seed shared across clips for consistent tone and pacing (default: 42).",
  })),
  concurrency: Type.Optional(Type.Integer({
    minimum: 1,
    maximum: MAX_CONCURRENCY,
    description: `Parallel Gemini TTS requests, 1-${MAX_CONCURRENCY} (default: ${DEFAULT_CONCURRENCY}).`,
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
    description: "For action=voices: max voices to return (default: 15).",
  })),
})

type Params = Static<typeof paramsSchema>
type ClipEntry = { id: string; text: string }
type Manifest = { clips: Record<string, string> }
type VoiceRecord = { id?: string; gender?: string; pitch?: string; accent?: string; persona?: string; description?: string }

type ToolDetails = {
  action: "synthesize" | "voices"
  clipsDir?: string
  model?: string
  voice?: string
  language?: string
  seed?: number
  generated?: number
  cached?: number
  total?: number
  voiceCount?: number
}

function normalizePath(raw: string, cwd: string): string {
  const stripped = raw.trim().replace(/^@/, "")
  if (stripped === "~") return homedir()
  if (stripped.startsWith("~/")) return join(homedir(), stripped.slice(2))
  return resolve(cwd, stripped)
}

function lineId(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 12)
}

function isWav(buf: Buffer): boolean {
  return (
    buf.length >= 44 &&
    buf.subarray(0, 4).toString("ascii") === "RIFF" &&
    buf.subarray(8, 12).toString("ascii") === "WAVE"
  )
}

function findVideoRenderer(): string {
  const agentDir = process.env.PI_CODING_AGENT_DIR || join(homedir(), ".pi", "agent")
  const packaged = join(agentDir, "npm", "node_modules", ".bin", "visual-explainer-video")
  if (existsSync(packaged)) return packaged
  return "visual-explainer-video"
}

function readManifest(dir: string): Manifest {
  const file = join(dir, MANIFEST_NAME)
  if (!existsSync(file)) return { clips: {} }
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as Partial<Manifest>
    if (parsed && typeof parsed.clips === "object" && parsed.clips !== null) {
      return { clips: { ...parsed.clips } }
    }
  } catch {
    // Corrupt manifest falls back to regenerating cleanly.
  }
  return { clips: {} }
}

function writeManifest(dir: string, manifest: Manifest): void {
  const file = join(dir, MANIFEST_NAME)
  const tmp = join(dir, `.${MANIFEST_NAME}.${process.pid}.tmp`)
  writeFileSync(tmp, JSON.stringify(manifest, null, 2) + "\n")
  renameSync(tmp, file)
}

async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) throw new Error("Cancelled")
  await new Promise<void>((resolveSleep, rejectSleep) => {
    const onAbort = () => {
      clearTimeout(timer)
      rejectSleep(new Error("Cancelled"))
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort)
      resolveSleep()
    }, ms)
    signal?.addEventListener("abort", onAbort, { once: true })
  })
}

function parseLinesOutput(stdout: string): ClipEntry[] {
  const seen = new Map<string, string>()
  for (const [idx, line] of stdout.split(/\r?\n/).entries()) {
    if (!line.trim()) continue
    const tab = line.indexOf("\t")
    if (tab === -1) throw new Error(`Malformed --lines output on line ${idx + 1}`)
    const id = line.slice(0, tab).trim()
    const text = line.slice(tab + 1).trim()
    if (!/^[A-Za-z0-9._-]+$/.test(id)) throw new Error(`Invalid clip id "${id}" on line ${idx + 1}`)
    if (!text) throw new Error(`Empty text for clip "${id}" on line ${idx + 1}`)
    if (!seen.has(id)) seen.set(id, text)
  }
  return [...seen.entries()].map(([id, text]) => ({ id, text }))
}

async function synthesizeClip(opts: {
  apiKey: string
  model: string
  voice: string
  language: string
  style?: string
  seed: number
  text: string
  signal?: AbortSignal
}): Promise<Buffer> {
  const contentItem: Record<string, unknown> = { type: "text", text: opts.text }
  if (opts.style) {
    contentItem.annotations = [{ type: "speech_metadata", style: opts.style }]
  }
  const speechEntry: Record<string, unknown> = { voice: opts.voice }
  if (opts.language) speechEntry.language = opts.language

  const body = JSON.stringify({
    model: opts.model,
    input: [{ type: "user_input", content: [contentItem] }],
    response_format: { type: "audio" },
    generation_config: {
      seed: opts.seed,
      speech_config: [speechEntry],
    },
  })

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const res = await fetch(INTERACTIONS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": opts.apiKey },
      body,
      signal: opts.signal,
    })
    if (res.ok) {
      const json = (await res.json()) as {
        steps?: Array<{ type?: string; content?: Array<{ type?: string; data?: string; mime_type?: string }> }>
      }
      const audio = (json.steps ?? [])
        .filter((s) => s.type === "model_output")
        .flatMap((s) => s.content ?? [])
        .filter((c) => c.type === "audio" && typeof c.data === "string")
        .at(-1)
      if (!audio?.data) throw new Error("Gemini TTS response contained no audio block")
      const wav = Buffer.from(audio.data, "base64")
      if (!isWav(wav)) {
        throw new Error(`Expected RIFF/WAVE payload, got ${wav.length} bytes (${audio.mime_type ?? "unknown"})`)
      }
      return wav
    }
    const errText = (await res.text()).slice(0, 300)
    const retryable = res.status === 429 || res.status >= 500
    if (!retryable || attempt === MAX_ATTEMPTS) {
      throw new Error(`Gemini TTS HTTP ${res.status}: ${errText}`)
    }
    await sleep(attempt * 1000 + Math.floor(Math.random() * 400), opts.signal)
  }
  throw new Error("Gemini TTS exhausted retries")
}

async function listVoices(apiKey: string, params: Params, signal?: AbortSignal): Promise<VoiceRecord[]> {
  const url = new URL(VOICES_URL)
  const limit = params.limit ?? 15
  url.searchParams.set("page_size", String(limit))
  if (params.search?.trim()) url.searchParams.set("search", params.search.trim())
  if (params.regionCode?.trim()) url.searchParams.set("region_code", params.regionCode.trim().toUpperCase())
  if (params.gender?.trim()) url.searchParams.set("gender", params.gender.trim().toLowerCase())

  const res = await fetch(url, {
    headers: { "x-goog-api-key": apiKey },
    signal,
  })
  if (!res.ok) {
    throw new Error(`Gemini Voices HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`)
  }
  const json = (await res.json()) as { voices?: VoiceRecord[] }
  return (json.voices ?? []).slice(0, limit)
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
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not set in the environment.")
      }

      const action = params.action ?? "synthesize"
      if (action === "voices") {
        const voices = await listVoices(apiKey, params, signal)
        if (!voices.length) {
          return {
            content: [{ type: "text", text: "No Gemini voices matched those filters." }],
            details: { action: "voices", voiceCount: 0 } satisfies ToolDetails,
          }
        }
        const rows = voices.map((v) =>
          [v.id ?? "?", v.gender, v.pitch, v.accent, v.persona].filter(Boolean).join(" · "),
        )
        return {
          content: [{ type: "text", text: rows.join("\n") }],
          details: { action: "voices", voiceCount: voices.length } satisfies ToolDetails,
        }
      }

      if (!params.deckPath && (!params.lines || !params.lines.length)) {
        throw new Error("Provide either deckPath or a non-empty lines array.")
      }

      let entries: ClipEntry[]
      let defaultClipsDir: string | undefined

      if (params.deckPath) {
        const deck = normalizePath(params.deckPath, ctx.cwd)
        if (!existsSync(deck)) throw new Error(`Deck file not found: ${deck}`)
        defaultClipsDir = `${deck.replace(/\.[^./]+$/, "")}.clips`

        const renderer = findVideoRenderer()
        onUpdate?.({
          content: [{ type: "text", text: `Extracting narration lines from ${deck}...` }],
          details: { action: "synthesize" } satisfies ToolDetails,
        })
        const extracted = await pi.exec(renderer, [deck, "--lines"], { cwd: dirname(deck), signal })
        if (extracted.code !== 0) {
          throw new Error(`visual-explainer-video --lines failed (${extracted.code}): ${extracted.stderr || extracted.stdout}`)
        }
        entries = parseLinesOutput(extracted.stdout)
      } else {
        const seen = new Map<string, string>()
        for (const item of params.lines ?? []) {
          const text = item.text.trim()
          if (!text) continue
          const id = (item.id?.trim() || lineId(text))
          if (!/^[A-Za-z0-9._-]+$/.test(id)) throw new Error(`Invalid clip id: ${JSON.stringify(id)}`)
          if (!seen.has(id)) seen.set(id, text)
        }
        entries = [...seen.entries()].map(([id, text]) => ({ id, text }))
      }

      const clipsDir = params.clipsDir
        ? normalizePath(params.clipsDir, ctx.cwd)
        : defaultClipsDir
      if (!clipsDir) {
        throw new Error("clipsDir is required when using explicit lines without deckPath.")
      }

      if (!entries.length) {
        return {
          content: [{ type: "text", text: "Deck has 0 narration lines; no clips needed." }],
          details: { action: "synthesize", clipsDir, generated: 0, cached: 0, total: 0 } satisfies ToolDetails,
        }
      }

      const model = params.model ?? DEFAULT_MODEL
      const voice = params.voice?.trim() || DEFAULT_VOICE
      const language = params.language === undefined ? DEFAULT_LANGUAGE : params.language.trim()
      const style = params.style?.trim() || undefined
      const seed = params.seed ?? DEFAULT_SEED
      const concurrency = params.concurrency ?? DEFAULT_CONCURRENCY
      const force = params.force ?? false
      const configKey = JSON.stringify({ model, voice, language, style: style ?? "", seed })

      mkdirSync(clipsDir, { recursive: true })
      const manifest = readManifest(clipsDir)
      const todo: Array<ClipEntry & { dest: string }> = []
      let cached = 0

      for (const entry of entries) {
        const dest = join(clipsDir, `${entry.id}.wav`)
        if (!force && existsSync(dest) && manifest.clips[entry.id] === configKey) {
          cached++
        } else {
          todo.push({ ...entry, dest })
        }
      }

      if (!todo.length) {
        const details: ToolDetails = {
          action: "synthesize",
          clipsDir,
          model,
          voice,
          language,
          seed,
          generated: 0,
          cached,
          total: entries.length,
        }
        return {
          content: [
            {
              type: "text",
              text: `0 generated, ${cached} cached in ${clipsDir} (${model}, voice=${voice}, language=${language || "auto"}, seed=${seed})`,
            },
          ],
          details,
        }
      }

      let cursor = 0
      let generated = 0
      const worker = async (): Promise<void> => {
        while (cursor < todo.length) {
          if (signal?.aborted) throw new Error("Cancelled")
          const job = todo[cursor++]
          const tmp = join(clipsDir, `.${job.id}.${process.pid}.tmp`)
          try {
            const wav = await synthesizeClip({
              apiKey,
              model,
              voice,
              language,
              style,
              seed,
              text: job.text,
              signal,
            })
            writeFileSync(tmp, wav)
            renameSync(tmp, job.dest)
            manifest.clips[job.id] = configKey
            writeManifest(clipsDir, manifest)
            generated++
            onUpdate?.({
              content: [{ type: "text", text: `Synthesized ${generated}/${todo.length} clip(s) into ${clipsDir}...` }],
              details: {
                action: "synthesize",
                clipsDir,
                model,
                voice,
                language,
                seed,
                generated,
                cached,
                total: entries.length,
              } satisfies ToolDetails,
            })
          } catch (err) {
            rmSync(tmp, { force: true })
            const msg = err instanceof Error ? err.message : String(err)
            throw new Error(`Clip ${job.id} failed: ${msg}`)
          }
        }
      }

      await Promise.all(Array.from({ length: Math.min(concurrency, todo.length) }, () => worker()))

      const details: ToolDetails = {
        action: "synthesize",
        clipsDir,
        model,
        voice,
        language,
        seed,
        generated,
        cached,
        total: entries.length,
      }
      return {
        content: [
          {
            type: "text",
            text: `${generated} generated, ${cached} cached in ${clipsDir} (${model}, voice=${voice}, language=${language || "auto"}, seed=${seed})`,
          },
        ],
        details,
      }
    },
  })
}
