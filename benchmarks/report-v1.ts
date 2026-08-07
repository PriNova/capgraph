import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

interface Run {
  condition: "flat" | "graph"; variant: "normal" | "recovery"; status: string;
  independentVerification: { ok: boolean }; protocol: { conformant: boolean };
  turns: number; agentToolCalls: number; failedToolCalls: number; durationMs: number;
  usage: { input: number; output: number; cacheRead: number; cacheWrite: number; cost: number };
  contextBytes: { loadedSkillProse: number; graphMetadata: number; flatCatalog: number };
  exactSkillsLoaded: string[]; irrelevantSkillBodiesLoaded: string[]; selectedVerifier: unknown;
  recoverySkillLoaded: boolean; recoveryOperationCalled: boolean; firstVerifierResult: boolean | null;
  secondVerifierResult: boolean | null;
}
function median(values: readonly number[]): number { const sorted = [...values].sort((a, b) => a - b); const middle = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2; }
function count(runs: readonly Run[], predicate: (run: Run) => boolean): string { return `${runs.filter(predicate).length}/${runs.length}`; }
function number(value: number): string { return Number.isInteger(value) ? String(value) : value.toFixed(2); }

const input = process.argv[2];
if (!input) throw new Error("Usage: npm run report:v1 -- <records.jsonl> [report.md]");
const inputPath = resolve(input), outputPath = resolve(process.argv[3] ?? "docs/v1-composition-benchmark-report.md");
const runs = (await readFile(inputPath, "utf8")).trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as Run).filter((run) => run.status !== "infrastructure_failure");
const groups = Object.fromEntries(["flat", "graph"].map((condition) => [condition, runs.filter((run) => run.condition === condition)])) as Record<"flat" | "graph", Run[]>;
const metric = (condition: "flat" | "graph", get: (run: Run) => number) => median(groups[condition].map(get));
const table = [
  ["Independently verified success", ...(["flat", "graph"] as const).map((c) => count(groups[c], (r) => r.independentVerification.ok))],
  ["Protocol conformance", ...(["flat", "graph"] as const).map((c) => count(groups[c], (r) => r.protocol.conformant))],
  ["Agent turns", ...(["flat", "graph"] as const).map((c) => number(metric(c, (r) => r.turns)))],
  ["Agent tool calls", ...(["flat", "graph"] as const).map((c) => number(metric(c, (r) => r.agentToolCalls)))],
  ["Failed tool calls", ...(["flat", "graph"] as const).map((c) => number(metric(c, (r) => r.failedToolCalls)))],
  ["Duration (ms)", ...(["flat", "graph"] as const).map((c) => number(metric(c, (r) => r.durationMs)))],
  ["Provider input tokens", ...(["flat", "graph"] as const).map((c) => number(metric(c, (r) => r.usage.input)))],
  ["Provider output tokens", ...(["flat", "graph"] as const).map((c) => number(metric(c, (r) => r.usage.output)))],
  ["Cache reads", ...(["flat", "graph"] as const).map((c) => number(metric(c, (r) => r.usage.cacheRead)))],
  ["Cache writes", ...(["flat", "graph"] as const).map((c) => number(metric(c, (r) => r.usage.cacheWrite)))],
  ["Provider cost", ...(["flat", "graph"] as const).map((c) => metric(c, (r) => r.usage.cost).toFixed(6))],
  ["Loaded skill prose bytes", ...(["flat", "graph"] as const).map((c) => number(metric(c, (r) => r.contextBytes.loadedSkillProse)))],
  ["Graph metadata bytes", ...(["flat", "graph"] as const).map((c) => number(metric(c, (r) => r.contextBytes.graphMetadata)))],
  ["Irrelevant bodies loaded", ...(["flat", "graph"] as const).map((c) => number(metric(c, (r) => r.irrelevantSkillBodiesLoaded.length)))],
];
const recovery = Object.fromEntries((["flat", "graph"] as const).map((c) => [c, groups[c].filter((r) => r.variant === "recovery")])) as Record<"flat" | "graph", Run[]>;
const conclusion = groups.flat.every((r) => r.independentVerification.ok) === groups.graph.every((r) => r.independentVerification.ok)
  ? "Reliability was equal in this schedule. Differences below concern measured composition and usage mechanisms, not a general winner."
  : "Reliability differed in this schedule. The mechanism tables must be read before attributing the difference to graph structure.";
const markdown = `# V1 Composition Benchmark Report\n\n## Result\n\n${conclusion}\n\nThis run set is small. Counts and medians are descriptive; no statistical significance is claimed.\n\nRaw records: \`${inputPath.replaceAll("\\", "/")}\`\n\n## Aggregate mechanisms\n\n| Metric | Flat | Graph |\n|---|---:|---:|\n${table.map((row) => `| ${row.join(" | ")} |`).join("\n")}\n\n## Reliability and protocol\n\n- Flat success: ${count(groups.flat, (r) => r.independentVerification.ok)}.\n- Graph success: ${count(groups.graph, (r) => r.independentVerification.ok)}.\n- Flat protocol: ${count(groups.flat, (r) => r.protocol.conformant)}.\n- Graph protocol: ${count(groups.graph, (r) => r.protocol.conformant)}.\n\n## Verifier and recovery selection\n\n| Mechanism | Flat recovery | Graph recovery |\n|---|---:|---:|\n| Correct first verifier selected | ${count(recovery.flat, (r) => r.selectedVerifier === "vehicle")} | ${count(recovery.graph, (r) => r.selectedVerifier === "vehicle")} |\n| Controlled first verification failed | ${count(recovery.flat, (r) => r.firstVerifierResult === false)} | ${count(recovery.graph, (r) => r.firstVerifierResult === false)} |\n| Recovery prose loaded | ${count(recovery.flat, (r) => r.recoverySkillLoaded)} | ${count(recovery.graph, (r) => r.recoverySkillLoaded)} |\n| Recovery operation called | ${count(recovery.flat, (r) => r.recoveryOperationCalled)} | ${count(recovery.graph, (r) => r.recoveryOperationCalled)} |\n| Second verification passed | ${count(recovery.flat, (r) => r.secondVerifierResult === true)} | ${count(recovery.graph, (r) => r.secondVerifierResult === true)} |\n\n## Interpretation boundaries\n\nReportable mechanisms are reliability, irrelevant-skill avoidance, shared-dependency handling, verifier selection, recovery selection, agent-operation count, provider usage, and cost. Byte measurements are context payload measurements and are not per-category token attribution. V1 does not test natural-language root resolution.\n`;
await writeFile(outputPath, markdown, "utf8");
console.log(`Report written: ${outputPath}`);
