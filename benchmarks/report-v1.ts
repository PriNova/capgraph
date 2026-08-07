import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";

import { V1_BENCHMARK_NAME, V1_SCHEDULE } from "../src/v1-composition-benchmark.ts";

type Condition = "flat" | "graph";
type Variant = "normal" | "recovery";

interface Run {
  benchmark: string;
  sequence: number;
  block: number;
  position: number;
  condition: Condition;
  variant: Variant;
  status: string;
  gitCommit: string;
  gitDirty: boolean;
  piVersion: string;
  model: string;
  thinkingLevel: string;
  upbgeVersion: string;
  upbgeBuildHash: string;
  independentVerification: { ok: boolean };
  protocol: { conformant: boolean };
  composition: { conformant: boolean; reasons: readonly string[] };
  executionBehavior: { conformant: boolean; reasons: readonly string[] };
  turns: number;
  agentToolCalls: number;
  failedToolCalls: number;
  durationMs: number;
  usage: { input: number; output: number; cacheRead: number; cacheWrite: number; cost: number };
  contextBytes: { loadedSkillProse: number; graphMetadata: number; flatCatalog: number };
  exactSkillsLoaded: string[];
  irrelevantSkillBodiesLoaded: string[];
  selectedVerifier: unknown;
  recoverySkillLoaded: boolean;
  recoveryOperationCalled: boolean;
  firstVerifierResult: boolean | null;
  secondVerifierResult: boolean | null;
}

const ROOT = resolve(import.meta.dirname, "..");
const DEFAULT_INPUT = resolve(ROOT, "benchmarks", "artifacts", "v1-formal.jsonl");
const DEFAULT_OUTPUT = resolve(ROOT, "docs", "v1-generated-results.md");

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown, field: string, line: number): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`Malformed record at line ${line}: "${field}" must be an object.`);
  return value;
}

function requireString(record: Record<string, unknown>, field: string, line: number): string {
  const value = record[field];
  if (typeof value !== "string" || value.length === 0) throw new Error(`Malformed record at line ${line}: "${field}" must be a non-empty string.`);
  return value;
}

function requireNumber(record: Record<string, unknown>, field: string, line: number): number {
  const value = record[field];
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`Malformed record at line ${line}: "${field}" must be a finite number.`);
  return value;
}

function requireBoolean(record: Record<string, unknown>, field: string, line: number): boolean {
  const value = record[field];
  if (typeof value !== "boolean") throw new Error(`Malformed record at line ${line}: "${field}" must be a boolean.`);
  return value;
}

function parseRun(value: unknown, line: number): Run {
  const record = requireRecord(value, "record", line);
  const condition = requireString(record, "condition", line);
  const variant = requireString(record, "variant", line);
  if (condition !== "flat" && condition !== "graph") throw new Error(`Malformed record at line ${line}: invalid condition "${condition}".`);
  if (variant !== "normal" && variant !== "recovery") throw new Error(`Malformed record at line ${line}: invalid variant "${variant}".`);

  const nested = (field: string) => requireRecord(record[field], field, line);
  const independentVerification = nested("independentVerification");
  const protocol = nested("protocol");
  const composition = nested("composition");
  const executionBehavior = nested("executionBehavior");
  const usage = nested("usage");
  const contextBytes = nested("contextBytes");
  for (const field of ["exactSkillsLoaded", "irrelevantSkillBodiesLoaded"] as const) {
    if (!Array.isArray(record[field]) || !record[field].every((item) => typeof item === "string")) {
      throw new Error(`Malformed record at line ${line}: "${field}" must be a string array.`);
    }
  }
  for (const [field, owner] of [["reasons", composition], ["reasons", executionBehavior]] as const) {
    if (!Array.isArray(owner[field]) || !owner[field].every((item) => typeof item === "string")) {
      throw new Error(`Malformed record at line ${line}: classification "${field}" must be a string array.`);
    }
  }
  const nullableBoolean = (field: "firstVerifierResult" | "secondVerifierResult") => {
    const value = record[field];
    if (value !== null && typeof value !== "boolean") throw new Error(`Malformed record at line ${line}: "${field}" must be boolean or null.`);
    return value;
  };

  return {
    benchmark: requireString(record, "benchmark", line),
    sequence: requireNumber(record, "sequence", line),
    block: requireNumber(record, "block", line),
    position: requireNumber(record, "position", line),
    condition,
    variant,
    status: requireString(record, "status", line),
    gitCommit: requireString(record, "gitCommit", line),
    gitDirty: requireBoolean(record, "gitDirty", line),
    piVersion: requireString(record, "piVersion", line),
    model: requireString(record, "model", line),
    thinkingLevel: requireString(record, "thinkingLevel", line),
    upbgeVersion: requireString(record, "upbgeVersion", line),
    upbgeBuildHash: requireString(record, "upbgeBuildHash", line),
    independentVerification: { ok: requireBoolean(independentVerification, "ok", line) },
    protocol: { conformant: requireBoolean(protocol, "conformant", line) },
    composition: { conformant: requireBoolean(composition, "conformant", line), reasons: composition.reasons as string[] },
    executionBehavior: { conformant: requireBoolean(executionBehavior, "conformant", line), reasons: executionBehavior.reasons as string[] },
    turns: requireNumber(record, "turns", line),
    agentToolCalls: requireNumber(record, "agentToolCalls", line),
    failedToolCalls: requireNumber(record, "failedToolCalls", line),
    durationMs: requireNumber(record, "durationMs", line),
    usage: {
      input: requireNumber(usage, "input", line),
      output: requireNumber(usage, "output", line),
      cacheRead: requireNumber(usage, "cacheRead", line),
      cacheWrite: requireNumber(usage, "cacheWrite", line),
      cost: requireNumber(usage, "cost", line),
    },
    contextBytes: {
      loadedSkillProse: requireNumber(contextBytes, "loadedSkillProse", line),
      graphMetadata: requireNumber(contextBytes, "graphMetadata", line),
      flatCatalog: requireNumber(contextBytes, "flatCatalog", line),
    },
    exactSkillsLoaded: record.exactSkillsLoaded as string[],
    irrelevantSkillBodiesLoaded: record.irrelevantSkillBodiesLoaded as string[],
    selectedVerifier: record.selectedVerifier,
    recoverySkillLoaded: requireBoolean(record, "recoverySkillLoaded", line),
    recoveryOperationCalled: requireBoolean(record, "recoveryOperationCalled", line),
    firstVerifierResult: nullableBoolean("firstVerifierResult"),
    secondVerifierResult: nullableBoolean("secondVerifierResult"),
  };
}

function validateSchedule(runs: readonly Run[]): void {
  if (runs.length !== V1_SCHEDULE.length) throw new Error(`Expected ${V1_SCHEDULE.length} formal records; found ${runs.length}.`);
  const bySequence = new Map(runs.map((run) => [run.sequence, run]));
  if (bySequence.size !== runs.length) throw new Error("Formal records contain duplicate sequence numbers.");
  for (const slot of V1_SCHEDULE) {
    const run = bySequence.get(slot.sequence);
    if (run === undefined) throw new Error(`Missing expected formal record for sequence ${slot.sequence}.`);
    for (const field of ["block", "position", "condition", "variant"] as const) {
      if (run[field] !== slot[field]) throw new Error(`Sequence ${slot.sequence} has unexpected ${field}: ${String(run[field])}.`);
    }
    if (run.benchmark !== V1_BENCHMARK_NAME) throw new Error(`Sequence ${slot.sequence} has unexpected benchmark "${run.benchmark}".`);
    if (run.status !== "success") throw new Error(`Sequence ${slot.sequence} has non-success status "${run.status}".`);
  }
}

function validateConfiguration(runs: readonly Run[]): void {
  const first = runs[0];
  if (first === undefined) throw new Error("Formal V1 records are empty.");
  if (first.gitDirty) throw new Error(`Sequence ${first.sequence} records gitDirty=true; formal V1 records must use a clean working tree.`);
  for (const run of runs.slice(1)) {
    if (run.gitDirty) throw new Error(`Sequence ${run.sequence} records gitDirty=true; formal V1 records must use a clean working tree.`);
    for (const field of ["gitCommit", "piVersion", "model", "thinkingLevel", "upbgeVersion", "upbgeBuildHash"] as const) {
      if (run[field] !== first[field]) {
        throw new Error(`Formal V1 configuration mismatch at sequence ${run.sequence}: "${field}" is "${run[field]}"; expected "${first[field]}".`);
      }
    }
  }
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

function count(runs: readonly Run[], predicate: (run: Run) => boolean): string {
  return `${runs.filter(predicate).length}/${runs.length}`;
}

function number(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function seconds(value: number): string {
  return (value / 1000).toFixed(3);
}

const inputPath = resolve(process.argv[2] ?? DEFAULT_INPUT);
const outputPath = resolve(process.argv[3] ?? DEFAULT_OUTPUT);
const raw = await readFile(inputPath);
const text = raw.toString("utf8");
const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
const runs = lines.map((line, index) => {
  try {
    return parseRun(JSON.parse(line) as unknown, index + 1);
  } catch (error: unknown) {
    if (error instanceof SyntaxError) throw new Error(`Malformed JSON at line ${index + 1}: ${error.message}`);
    throw error;
  }
});
validateSchedule(runs);
validateConfiguration(runs);

const groups = Object.fromEntries((["flat", "graph"] as const).map((condition) => [condition, runs.filter((run) => run.condition === condition)])) as Record<Condition, Run[]>;
const recovery = Object.fromEntries((["flat", "graph"] as const).map((condition) => [condition, groups[condition].filter((run) => run.variant === "recovery")])) as Record<Condition, Run[]>;
const metric = (condition: Condition, get: (run: Run) => number) => median(groups[condition].map(get));
const context = (run: Run) => run.contextBytes.flatCatalog + run.contextBytes.graphMetadata + run.contextBytes.loadedSkillProse;
const table = [
  ["Independently verified success", ...(["flat", "graph"] as const).map((condition) => count(groups[condition], (run) => run.independentVerification.ok))],
  ["Benchmark protocol conformance", ...(["flat", "graph"] as const).map((condition) => count(groups[condition], (run) => run.protocol.conformant))],
  ["Composition-conformant runs", ...(["flat", "graph"] as const).map((condition) => count(groups[condition], (run) => run.composition.conformant))],
  ["Execution-behavior clean runs", ...(["flat", "graph"] as const).map((condition) => count(groups[condition], (run) => run.executionBehavior.conformant))],
  ["Agent turns", ...(["flat", "graph"] as const).map((condition) => number(metric(condition, (run) => run.turns)))],
  ["Agent tool calls", ...(["flat", "graph"] as const).map((condition) => number(metric(condition, (run) => run.agentToolCalls)))],
  ["Failed tool calls", ...(["flat", "graph"] as const).map((condition) => number(metric(condition, (run) => run.failedToolCalls)))],
  ["Duration (s)", ...(["flat", "graph"] as const).map((condition) => seconds(metric(condition, (run) => run.durationMs)))],
  ["Provider input tokens", ...(["flat", "graph"] as const).map((condition) => number(metric(condition, (run) => run.usage.input)))],
  ["Provider output tokens", ...(["flat", "graph"] as const).map((condition) => number(metric(condition, (run) => run.usage.output)))],
  ["Cache-read tokens", ...(["flat", "graph"] as const).map((condition) => number(metric(condition, (run) => run.usage.cacheRead)))],
  ["Cache-write tokens", ...(["flat", "graph"] as const).map((condition) => number(metric(condition, (run) => run.usage.cacheWrite)))],
  ["Provider cost", ...(["flat", "graph"] as const).map((condition) => `$${metric(condition, (run) => run.usage.cost).toFixed(6)}`)],
  ["Skill bodies loaded", ...(["flat", "graph"] as const).map((condition) => number(metric(condition, (run) => run.exactSkillsLoaded.length)))],
  ["Irrelevant bodies loaded", ...(["flat", "graph"] as const).map((condition) => number(metric(condition, (run) => run.irrelevantSkillBodiesLoaded.length)))],
  ["Measured capability context (bytes)", ...(["flat", "graph"] as const).map((condition) => number(metric(condition, context)))],
];
const sha256 = createHash("sha256").update(raw).digest("hex");
const sourcePath = relative(ROOT, inputPath).replaceAll("\\", "/");
const first = runs[0]!;
const markdown = `# V1 Generated Results\n\n> Generated file. Do not edit measurements by hand. Human-authored interpretation is in [V1 Composition Benchmark Report](v1-composition-benchmark-report.md).\n\n## Provenance\n\n- Raw artifact: [\`${sourcePath}\`](../${sourcePath})\n- SHA-256: \`${sha256}\`\n- Records: ${runs.length}\n- Benchmark: \`${V1_BENCHMARK_NAME}\`\n- Frozen commit: \`${first.gitCommit}\`\n- Working tree recorded clean: ${count(runs, (run) => !run.gitDirty)}\n- pi: \`${first.piVersion}\`\n- Model: \`${first.model}\`\n- Reasoning: \`${first.thinkingLevel}\`\n- UPBGE: \`${first.upbgeVersion}\` (build \`${first.upbgeBuildHash}\`)\n\n## Aggregate measurements\n\nValues are medians over four runs per condition unless shown as counts.\n\n| Metric | Flat | Graph |\n|---|---:|---:|\n${table.map((row) => `| ${row.join(" | ")} |`).join("\n")}\n\n## Recovery measurements\n\n| Mechanism | Flat | Graph |\n|---|---:|---:|\n| Correct first verifier selected | ${count(recovery.flat, (run) => run.selectedVerifier === "vehicle")} | ${count(recovery.graph, (run) => run.selectedVerifier === "vehicle")} |\n| Controlled first verification failed | ${count(recovery.flat, (run) => run.firstVerifierResult === false)} | ${count(recovery.graph, (run) => run.firstVerifierResult === false)} |\n| Recovery prose loaded | ${count(recovery.flat, (run) => run.exactSkillsLoaded.includes("vehicle-collision-repair"))} | ${count(recovery.graph, (run) => run.recoverySkillLoaded)} |\n| Recovery operation called | ${count(recovery.flat, (run) => run.recoveryOperationCalled)} | ${count(recovery.graph, (run) => run.recoveryOperationCalled)} |\n| Second verification passed | ${count(recovery.flat, (run) => run.secondVerifierResult === true)} | ${count(recovery.graph, (run) => run.secondVerifierResult === true)} |\n\n## Per-run measurements\n\n| Slot | Condition | Variant | Success | Protocol | Composition | Execution | Turns | Tools | Failed | Duration (s) | Input | Output | Cache read | Cost | Context bytes | Bodies | Irrelevant |\n|---:|---|---|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|\n${runs.sort((a, b) => a.sequence - b.sequence).map((run) => `| ${run.sequence} | ${run.condition} | ${run.variant} | ${run.independentVerification.ok ? "Yes" : "No"} | ${run.protocol.conformant ? "Yes" : "No"} | ${run.composition.conformant ? "Yes" : "No"} | ${run.executionBehavior.conformant ? "Yes" : "No"} | ${run.turns} | ${run.agentToolCalls} | ${run.failedToolCalls} | ${seconds(run.durationMs)} | ${run.usage.input} | ${run.usage.output} | ${run.usage.cacheRead} | $${run.usage.cost.toFixed(6)} | ${context(run)} | ${run.exactSkillsLoaded.length} | ${run.irrelevantSkillBodiesLoaded.length} |`).join("\n")}\n\n## Measurement boundary\n\nContext bytes are recorded harness payload measurements. They combine the Flat catalog or Graph metadata with loaded payloads and include frontmatter and serialization differences. They are not graph-edge compression or per-category token attribution. Tool-call differences also include Graph Batch versus individual Flat reads.\n`;
await writeFile(outputPath, markdown, "utf8");
console.log(`Generated V1 results: ${relative(ROOT, outputPath).replaceAll("\\", "/")}`);
