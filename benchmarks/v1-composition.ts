import { execFile as execFileCallback } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFile, cp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";
import { promisify } from "node:util";

import type { ThinkingLevel } from "@earendil-works/pi-ai";
import { createAgentSession, DefaultResourceLoader, formatSkillsForPrompt, getAgentDir, ModelRuntime, resolveCliModel, SessionManager, SettingsManager, VERSION as PI_VERSION, type AgentSessionEvent } from "@earendil-works/pi-coding-agent";

import { createV1FlatSkillContents, evaluateV1Composition, evaluateV1ExecutionBehavior, evaluateV1Protocol, isCompleteV1VerificationCall, isCompleteV1VerifierCall, V1_BENCHMARK_MODEL, V1_BENCHMARK_NAME, V1_BENCHMARK_THINKING_LEVEL, V1_NORMAL_LOADED_SKILLS, V1_OBJECT_NAME, V1_SCHEDULE, v1IrrelevantLoadedSkills, v1Prompt, v1SessionToolNames, type V1Condition, type V1Slot } from "../src/v1-composition-benchmark.ts";
import { buildV1FaultControlCode, buildV1ResetCode, executeV1UpbgeOperation } from "../src/v1-upbge-control.ts";
import { sendUpbgeCode } from "../src/upbge-control.ts";

const execFile = promisify(execFileCallback);
const ROOT = resolve(import.meta.dirname, "..");
const SOURCE = resolve(ROOT, "capabilities-v1");
const FLAT = resolve(ROOT, "benchmarks", ".generated-v1-flat-skills");
const GRAPH_EXTENSION = resolve(ROOT, "extensions", "v1-skill-graph-batch.ts");
const FLAT_READ_GATE_EXTENSION = resolve(ROOT, "extensions", "v1-flat-read-gate.ts");
const GRAPH_READ_GATE_EXTENSION = resolve(ROOT, "extensions", "v1-graph-read-gate.ts");
const UPBGE_EXTENSION = resolve(ROOT, "extensions", "v1-upbge-control.ts");
const MAX_TOOL_CALLS = 30;
const TIMEOUT_MS = 5 * 60_000;

interface Options { model: string; thinking: ThinkingLevel; start: number; end: number; output: string; }
interface Call { id: string; name: string; args: unknown; startedAt: string; durationMs?: number; isError?: boolean; result?: unknown; }
interface Verification { ok: boolean; failures: readonly unknown[]; error?: string; }
interface Usage { input: number; output: number; cacheRead: number; cacheWrite: number; cost: number; }

function record(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function message(error: unknown): string { return error instanceof Error ? error.message : String(error); }
function parseVerification(value: unknown): Verification { return record(value) && typeof value.ok === "boolean" && Array.isArray(value.failures) ? { ok: value.ok, failures: value.failures } : { ok: false, failures: [], error: "Invalid verifier result." }; }
function parseToolVerification(value: unknown): Verification {
  const output = text(value);
  for (const candidate of [output, output.slice(output.indexOf("{"))]) {
    if (!candidate) continue;
    try { return parseVerification(JSON.parse(candidate)); } catch { /* Try next representation. */ }
  }
  return { ok: false, failures: [], error: `Invalid agent verifier result: ${output.slice(0, 120)}` };
}
function parsePositive(value: string | undefined, name: string): number { const number = Number(value); if (!Number.isInteger(number) || number < 1 || number > V1_SCHEDULE.length) throw new Error(`${name} must be 1-${V1_SCHEDULE.length}.`); return number; }
function isThinking(value: string | undefined): value is ThinkingLevel { return ["minimal", "low", "medium", "high", "xhigh", "max"].includes(value ?? ""); }

function options(args: readonly string[]): Options {
  let model = V1_BENCHMARK_MODEL; let thinking: ThinkingLevel = V1_BENCHMARK_THINKING_LEVEL; let start = 1; let end = V1_SCHEDULE.length; let output: string | undefined;
  for (let i = 0; i < args.length; i++) {
    const key = args[i], value = args[i + 1];
    if (key === "--model") { if (!value) throw new Error("--model requires provider/model."); model = value; i++; }
    else if (key === "--thinking") { if (!isThinking(value)) throw new Error("Invalid --thinking."); thinking = value; i++; }
    else if (key === "--start") { start = parsePositive(value, key); i++; }
    else if (key === "--end") { end = parsePositive(value, key); i++; }
    else if (key === "--output") { if (!value) throw new Error("--output requires path."); output = resolve(ROOT, value); i++; }
    else throw new Error(`Unknown option: ${key}`);
  }
  if (start > end) throw new Error("--start must not exceed --end.");
  const stamp = new Date().toISOString().replaceAll(":", "-").replace(".", "-");
  return { model, thinking, start, end, output: output ?? resolve(ROOT, "benchmarks", "results", `${V1_BENCHMARK_NAME}-${stamp}.jsonl`) };
}

async function skillNames(): Promise<string[]> { return (await readdir(SOURCE, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort(); }
async function prepareFlat(names: readonly string[]): Promise<void> {
  for (const name of names) { const source = resolve(SOURCE, name); const target = resolve(FLAT, name); await cp(source, target, { recursive: true, force: true }); await writeFile(resolve(target, "SKILL.md"), createV1FlatSkillContents(await readFile(resolve(source, "SKILL.md"), "utf8")), "utf8"); }
}
async function fixtureConfiguration(names: readonly string[]) {
  const hashes: Record<string, string> = {}; let totalBytes = 0;
  for (const name of names) { const path = resolve(SOURCE, name, "SKILL.md"); const contents = await readFile(path); hashes[name] = createHash("sha256").update(contents).digest("hex"); totalBytes += contents.byteLength; }
  const relevantBytes = (await Promise.all(V1_NORMAL_LOADED_SKILLS.map(async (name) => Buffer.byteLength((await readFile(resolve(SOURCE, name, "SKILL.md"), "utf8")).replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n+/, "").trim(), "utf8")))).reduce((a, b) => a + b, 0);
  const [{ stdout: commit }, { stdout: status }, packageText] = await Promise.all([execFile("git", ["rev-parse", "HEAD"], { cwd: ROOT }), execFile("git", ["status", "--porcelain"], { cwd: ROOT }), readFile(resolve(ROOT, "package.json"), "utf8")]);
  return { hashes, totalBytes, relevantBytes, commit: commit.trim(), dirty: status.trim() !== "", packageVersion: (JSON.parse(packageText) as { version: string }).version };
}

async function resetFixture(): Promise<void> {
  const result = await sendUpbgeCode(buildV1ResetCode());
  if (!record(result) || result.clean !== true || result.mesh_clean !== true) {
    throw new Error(`V1 fixture reset failed: ${JSON.stringify(result)}`);
  }
}

async function loader(condition: V1Condition, settings: SettingsManager): Promise<DefaultResourceLoader> {
  const result = new DefaultResourceLoader({ cwd: ROOT, agentDir: getAgentDir(), settingsManager: settings, additionalExtensionPaths: condition === "graph" ? [GRAPH_EXTENSION, GRAPH_READ_GATE_EXTENSION, UPBGE_EXTENSION] : [FLAT_READ_GATE_EXTENSION, UPBGE_EXTENSION], additionalSkillPaths: condition === "flat" ? [FLAT] : [], noExtensions: true, noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true });
  await result.reload();
  if (result.getExtensions().errors.length || result.getSkills().diagnostics.length) throw new Error(`Resource loading failed: ${JSON.stringify([result.getExtensions().errors, result.getSkills().diagnostics])}`);
  return result;
}
function text(value: unknown): string { if (!record(value) || !Array.isArray(value.content)) return ""; return value.content.filter((item) => record(item) && item.type === "text" && typeof item.text === "string").map((item) => String(item.text)).join(""); }
function graphSkills(value: unknown): string[] { try { const parsed: unknown = JSON.parse(text(value)); if (!record(parsed)) return []; const loaded = [...(Array.isArray(parsed.execution) ? parsed.execution : []), ...(Array.isArray(parsed.verification) ? parsed.verification : [])]; return loaded.filter(record).map((item) => item.skill).filter((name): name is string => typeof name === "string"); } catch { return []; } }
function flatName(path: unknown): string | undefined { if (typeof path !== "string") return undefined; const absolute = resolve(path), rel = relative(FLAT, absolute); return basename(absolute) === "SKILL.md" && rel !== ".." && !rel.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) && !isAbsolute(rel) ? basename(dirname(absolute)) : undefined; }
function infrastructure(error: string): boolean { return /Cannot communicate|Timed out|bridge closed|provider|API key|rate limit|network|model/i.test(error); }

async function attempt(slot: V1Slot, attemptNumber: number, opts: Options, config: Awaited<ReturnType<typeof fixtureConfiguration>>, runtime: ModelRuntime) {
  const resolved = resolveCliModel({ cliModel: opts.model, modelRuntime: runtime }); if (!resolved.model || resolved.error) throw new Error(resolved.error ?? "Model resolution failed.");
  const settings = SettingsManager.inMemory({ compaction: { enabled: false }, retry: { enabled: false } }); const resources = await loader(slot.condition, settings);
  const catalogBytes = Buffer.byteLength(formatSkillsForPrompt(resources.getSkills().skills), "utf8");
  const { session, extensionsResult } = await createAgentSession({ cwd: ROOT, agentDir: getAgentDir(), model: resolved.model, thinkingLevel: opts.thinking, modelRuntime: runtime, resourceLoader: resources, tools: [...v1SessionToolNames(slot.condition)], sessionManager: SessionManager.inMemory(ROOT), settingsManager: settings });
  if (extensionsResult.errors.length) throw new Error(JSON.stringify(extensionsResult.errors));
  const calls = new Map<string, Call>(); const loadedSkills: string[] = []; let turns = 0, graphMetadataBytes = 0, proseBytes = 0, limit: string | undefined; let aborted = false;
  const abort = (reason: string) => { if (!aborted) { aborted = true; limit = reason; queueMicrotask(() => void session.abort()); } };
  const unsubscribe = session.subscribe((event: AgentSessionEvent) => {
    if (event.type === "turn_start") turns++;
    else if (event.type === "tool_execution_start") { calls.set(event.toolCallId, { id: event.toolCallId, name: event.toolName, args: event.args, startedAt: new Date().toISOString() }); if (calls.size > MAX_TOOL_CALLS) abort(`Exceeded ${MAX_TOOL_CALLS} tool calls.`); }
    else if (event.type === "tool_execution_end") { const call = calls.get(event.toolCallId); if (!call) return; call.durationMs = Date.now() - Date.parse(call.startedAt); call.isError = event.isError; call.result = event.result;
      if (!event.isError && call.name === "read" && record(call.args)) { const name = flatName(call.args.path); if (name) { loadedSkills.push(name); proseBytes += Buffer.byteLength(text(event.result), "utf8"); } }
      if (!event.isError && call.name === "skill_graph" && record(call.args)) { const bytes = Buffer.byteLength(text(event.result), "utf8"); if (call.args.operation === "expand") graphMetadataBytes += bytes; else if (call.args.operation === "load_many") { const names = graphSkills(event.result); loadedSkills.push(...names); proseBytes += bytes; } else if (call.args.operation === "load" && typeof call.args.skill === "string") { loadedSkills.push(call.args.skill); proseBytes += bytes; } }
    }
  });
  const started = new Date(); const timer = setTimeout(() => abort("Exceeded 5 minute duration."), TIMEOUT_MS); let runError: string | undefined;
  try { await session.prompt(v1Prompt(slot.variant), { source: "extension" }); await session.waitForIdle(); } catch (error) { runError = message(error); } finally { clearTimeout(timer); unsubscribe(); }
  const toolCalls = [...calls.values()];
  const verifyCalls = toolCalls.filter(isCompleteV1VerifierCall);
  const firstVerifyCall = verifyCalls[0];
  const selectedVerifierCall = toolCalls.find(isCompleteV1VerificationCall);
  const firstVerifier = firstVerifyCall ? parseToolVerification(firstVerifyCall.result) : undefined;
  const secondVerifier = verifyCalls[1] ? parseToolVerification(verifyCalls[1].result) : undefined;
  const faultState = await sendUpbgeCode(buildV1FaultControlCode(false));
  let independent: Verification; try { independent = parseVerification(await executeV1UpbgeOperation({ operation: "verify_state", objectName: V1_OBJECT_NAME, profile: "vehicle" })); } catch (error) { independent = { ok: false, failures: [], error: message(error) }; }
  const stats = session.getSessionStats(), sessionError = session.agent.state.errorMessage; session.dispose();
  const protocol = evaluateV1Protocol(slot.condition, slot.variant, toolCalls);
  const irrelevant = v1IrrelevantLoadedSkills(slot.variant, loadedSkills);
  const selectedVerifier = record(selectedVerifierCall?.args) ? selectedVerifierCall.args.profile ?? null : null;
  const composition = evaluateV1Composition(slot.condition, slot.variant, toolCalls, selectedVerifier, firstVerifier?.ok ?? null, secondVerifier?.ok ?? null, firstVerifier?.failures ?? [], irrelevant);
  const executionBehavior = evaluateV1ExecutionBehavior(slot.variant, toolCalls);
  const failureReason = limit ?? runError ?? sessionError ?? independent.error ?? protocol.reason;
  const status = failureReason && infrastructure(failureReason) ? "infrastructure_failure" : !protocol.conformant ? "protocol_failure" : independent.ok && !failureReason ? "success" : "task_failure";
  const operations = toolCalls.filter((call) => call.name === "upbge_control" && record(call.args)).map((call) => String((call.args as Record<string, unknown>).operation));
  const usage: Usage = { input: stats.tokens.input, output: stats.tokens.output, cacheRead: stats.tokens.cacheRead, cacheWrite: stats.tokens.cacheWrite, cost: stats.cost };
  return { benchmark: V1_BENCHMARK_NAME, sequence: slot.sequence, block: slot.block, position: slot.position, attempt: attemptNumber, condition: slot.condition, variant: slot.variant, status, gitCommit: config.commit, gitDirty: config.dirty, piVersion: PI_VERSION, packageVersion: config.packageVersion, model: `${resolved.model.provider}/${resolved.model.id}`, thinkingLevel: opts.thinking, upbgeVersion: "5.3.0 Alpha", upbgeBuildHash: process.env.CAPGRAPH_UPBGE_BUILD_HASH ?? "9a92b08bb47b", startedAt: started.toISOString(), durationMs: Date.now() - started.getTime(), turns, agentToolCalls: toolCalls.length, failedToolCalls: toolCalls.filter((call) => call.isError).length, toolCalls, usage, totalAvailableCapabilityCount: Object.keys(config.hashes).length, totalCatalogBytes: config.totalBytes, relevantExpandedClosureCount: V1_NORMAL_LOADED_SKILLS.length, relevantClosureBytes: config.relevantBytes, contextBytes: { flatCatalog: catalogBytes, graphMetadata: graphMetadataBytes, loadedSkillProse: proseBytes }, exactSkillsLoaded: loadedSkills, irrelevantSkillBodiesLoaded: irrelevant, selectedVerifier, firstVerifierResult: firstVerifier?.ok ?? null, firstVerifierFailureDetails: firstVerifier?.failures ?? [], recoverySkillLoaded: loadedSkills.includes("vehicle-collision-repair"), recoveryOperationCalled: operations.includes("set_collision_mask"), secondVerifierResult: secondVerifier?.ok ?? null, deduplicatedSharedDependencies: ["object-resolve"], exactExecutionSequence: operations.filter((operation) => !["verify_state", "set_collision_mask"].includes(operation)), exactVerificationSequence: operations.filter((operation) => operation === "verify_state"), exactRecoverySequence: operations.filter((operation) => operation === "set_collision_mask"), faultState, independentVerification: independent, protocol, composition, executionBehavior, capabilityHashes: config.hashes, failureReason: failureReason ?? null };
}

async function main() {
  const opts = options(process.argv.slice(2)), names = await skillNames(); await prepareFlat(names); const config = await fixtureConfiguration(names); const runtime = await ModelRuntime.create(); await mkdir(dirname(opts.output), { recursive: true });
  console.log(`Benchmark: ${V1_BENCHMARK_NAME}\nOutput: ${opts.output}\nModel: ${opts.model}; thinking: ${opts.thinking}`);
  for (const slot of V1_SCHEDULE.filter(({ sequence }) => sequence >= opts.start && sequence <= opts.end)) { let number = 1; while (true) { await resetFixture(); await sendUpbgeCode(buildV1FaultControlCode(slot.variant === "recovery", true)); const result = await attempt(slot, number, opts, config, runtime); await appendFile(opts.output, `${JSON.stringify(result)}\n`, "utf8"); console.log(`Slot ${slot.sequence} attempt ${number}: ${result.status}; independent=${result.independentVerification.ok}; protocol=${result.protocol.conformant}`); if (result.status !== "infrastructure_failure") break; number++; } }
  console.log(`V1 schedule complete. Raw records: ${opts.output}`);
}
main().catch((error) => { console.error(`V1 runner failed: ${message(error)}`); process.exitCode = 1; });
