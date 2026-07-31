import { writeFile } from "node:fs/promises";

import { requestExaCodeContext } from "../client.ts";

interface Case {
  name: string;
  query: string;
  markers: string[];
  authoritativeDomains: string[];
}

const cases: Case[] = [
  { name: "Axum 0.8 wildcard", query: "Axum 0.8 exact wildcard route syntax capturing the remainder as tail", markers: ["/{*tail}"], authoritativeDomains: ["tokio.rs", "docs.rs"] },
  { name: "Pydantic 2 validator", query: "Pydantic 2 field validator exact decorator syntax and working example", markers: ["field_validator"], authoritativeDomains: ["docs.pydantic.dev"] },
  { name: "React 19 ref", query: "React 19 ref as a prop function component exact syntax", markers: ["ref"], authoritativeDomains: ["react.dev"] },
  { name: "Next.js 15 params", query: "Next.js 15 App Router page params Promise TypeScript exact syntax", markers: ["promise", "params"], authoritativeDomains: ["nextjs.org"] },
  { name: "Reqwest 0.12 JSON", query: "Rust reqwest 0.12 send JSON request feature flag exact example", markers: ["json", "feature"], authoritativeDomains: ["docs.rs"] },
  { name: "AWS SDK v3 undefined", query: "AWS SDK JavaScript v3 DynamoDBDocumentClient removeUndefinedValues marshallOptions exact configuration", markers: ["removeundefinedvalues", "marshalloptions"], authoritativeDomains: ["docs.aws.amazon.com"] },
  { name: "OpenAI Responses tools", query: "OpenAI Responses API function tool calling exact request fields", markers: ["tools", "function"], authoritativeDomains: ["platform.openai.com", "developers.openai.com"] },
  { name: "SQLx offline", query: "SQLx 0.8 offline mode cargo sqlx prepare exact workflow", markers: ["cargo sqlx prepare", ".sqlx"], authoritativeDomains: ["docs.rs", "github.com"] },
  { name: "Tailwind CSS 4 import", query: "Tailwind CSS v4 exact CSS import syntax", markers: ["@import", "tailwindcss"], authoritativeDomains: ["tailwindcss.com"] },
  { name: "Python 3.13 free-threaded", query: "Python 3.13 free-threaded build exact command or executable suffix", markers: ["free-threaded"], authoritativeDomains: ["docs.python.org"] },
];

function markerScore(text: string, markers: string[]): string {
  const normalized = text.toLowerCase();
  return `${markers.filter((marker) => normalized.includes(marker.toLowerCase())).length}/${markers.length}`;
}

function authoritativeScore(text: string, domains: string[]): string {
  const normalized = text.toLowerCase();
  return domains.some((domain) => normalized.includes(domain.toLowerCase())) ? "yes" : "no";
}

function numericTotal(value: unknown): number {
  if (!value || typeof value !== "object") return 0;
  const total = (value as Record<string, unknown>).total;
  return typeof total === "number" && Number.isFinite(total) ? total : 0;
}

async function search(query: string, apiKey: string): Promise<{ text: string; latencyMs: number; cost: number }> {
  const started = performance.now();
  const response = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, type: "fast", numResults: 10, contents: { highlights: true } }),
  });
  if (!response.ok) throw new Error(`Exa Search failed with HTTP ${response.status}`);
  const data = await response.json() as Record<string, unknown>;
  return {
    text: JSON.stringify(data.results ?? []),
    latencyMs: performance.now() - started,
    cost: numericTotal(data.costDollars),
  };
}

const searchKey = process.env.EXA_SEARCH_API_KEY ?? process.env.EXA_API_KEY;
if (!searchKey) throw new Error("EXA_SEARCH_API_KEY or EXA_API_KEY is required");

const rows: string[] = [];
let contextCost = 0;
let searchCost = 0;
let contextLatency = 0;
let searchLatency = 0;

for (const item of cases) {
  const contextStarted = performance.now();
  const context = await requestExaCodeContext({ query: item.query, tokensNum: 1_000 });
  const contextMs = performance.now() - contextStarted;
  const searchResult = await search(item.query, searchKey);

  const contextMarker = markerScore(context.response, item.markers);
  const searchMarker = markerScore(searchResult.text, item.markers);
  const contextAuthority = authoritativeScore(context.response, item.authoritativeDomains);
  const searchAuthority = authoritativeScore(searchResult.text, item.authoritativeDomains);
  const oneContextCost = numericTotal(context.costDollars);

  contextCost += oneContextCost;
  searchCost += searchResult.cost;
  contextLatency += contextMs;
  searchLatency += searchResult.latencyMs;
  rows.push(`| ${item.name} | ${contextMarker} | ${searchMarker} | ${contextAuthority} | ${searchAuthority} | ${Math.round(contextMs)} | ${Math.round(searchResult.latencyMs)} | $${oneContextCost.toFixed(4)} | $${searchResult.cost.toFixed(4)} |`);
  await new Promise((resolve) => setTimeout(resolve, 250));
}

const report = `# Exa Context versus Exa Search smoke benchmark\n\nRun against ten public, version-sensitive coding queries. Context used a 1,000-token budget; Search used the official code-search recipe (fast, ten results, highlights). Marker and authoritative-domain checks are coarse retrieval smoke metrics, not a semantic quality judgment. No response bodies or credentials are persisted.\n\n| Case | Context markers | Search markers | Context authority | Search authority | Context ms | Search ms | Context cost | Search cost |\n|---|---:|---:|---|---|---:|---:|---:|---:|\n${rows.join("\n")}\n\n## Totals\n\n- Context average latency: ${Math.round(contextLatency / cases.length)} ms\n- Search average latency: ${Math.round(searchLatency / cases.length)} ms\n- Context reported cost: $${contextCost.toFixed(4)}\n- Search reported cost: $${searchCost.toFixed(4)}\n- Combined reported cost: $${(contextCost + searchCost).toFixed(4)}\n\n## Interpretation limits\n\nThese checks establish that each route retrieves expected public terms and authoritative domains. They do not blind-score correctness, snippet copyability, freshness, duplication, or hallucination; a stronger evaluation would require saved redacted outputs and independent grading, which would add a new retention surface.\n`;

const outputPath = process.argv[2];
if (outputPath) await writeFile(outputPath, report, "utf8");
else process.stdout.write(report);
