import { execFile as execFileCallback } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFile, cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { promisify } from "node:util";

import type { ThinkingLevel } from "@earendil-works/pi-ai";
import {
  createAgentSession,
  DefaultResourceLoader,
  formatSkillsForPrompt,
  getAgentDir,
  ModelRuntime,
  resolveCliModel,
  SessionManager,
  SettingsManager,
  VERSION as PI_VERSION,
  type AgentSessionEvent,
} from "@earendil-works/pi-coding-agent";

import {
  BENCHMARK_NAME,
  BENCHMARK_OBJECT_NAME,
  BENCHMARK_PROMPT,
  BENCHMARK_SCHEDULE,
  BENCHMARK_SKILLS,
  createFlatSkillContents,
  evaluateBenchmarkProtocol,
  type BenchmarkCondition,
  type BenchmarkSlot,
} from "../src/pilot-benchmark.ts";
import { executeUpbgeOperation, sendUpbgeCode } from "../src/upbge-control.ts";

const execFile = promisify(execFileCallback);
const PROJECT_ROOT = resolve(import.meta.dirname, "..");
const GENERATED_FLAT_SKILLS = resolve(PROJECT_ROOT, "benchmarks", ".generated-flat-skills");
const CAPABILITIES_DIRECTORY = resolve(PROJECT_ROOT, "capabilities");
const GRAPH_EXTENSION = resolve(PROJECT_ROOT, "extensions", "skill-graph.ts");
const UPBGE_EXTENSION = resolve(PROJECT_ROOT, "extensions", "upbge-control.ts");
const RUN_TIMEOUT_MS = 5 * 60 * 1000;
const MAX_TOOL_CALLS = 12;
const THINKING_LEVELS = ["minimal", "low", "medium", "high", "xhigh", "max"] as const;

interface RunnerOptions {
  readonly model: string;
  readonly thinkingLevel: ThinkingLevel;
  readonly startSequence: number;
  readonly endSequence: number;
  readonly outputPath: string;
}

interface ToolCallRecord {
  readonly id: string;
  readonly name: string;
  readonly args: unknown;
  readonly startedAt: string;
  durationMs?: number;
  isError?: boolean;
}

interface UsageRecord {
  readonly input: number;
  readonly output: number;
  readonly cacheRead: number;
  readonly cacheWrite: number;
  readonly cost: number;
}

interface VerificationRecord {
  readonly ok: boolean;
  readonly failures: readonly unknown[];
  readonly error?: string;
}

type AttemptStatus =
  | "success"
  | "task_failure"
  | "protocol_failure"
  | "infrastructure_failure";

interface AttemptRecord {
  readonly benchmark: string;
  readonly sequence: number;
  readonly pair: number;
  readonly attempt: number;
  readonly condition: BenchmarkCondition;
  readonly status: AttemptStatus;
  readonly gitCommit: string;
  readonly gitDirty: boolean;
  readonly piVersion: string;
  readonly packageVersion: string;
  readonly model: string;
  readonly thinkingLevel: ThinkingLevel;
  readonly upbgeVersion: string;
  readonly upbgeBuildHash: string;
  readonly capabilityHashes: Readonly<Record<string, string>>;
  readonly startedAt: string;
  readonly durationMs: number;
  readonly turns: number;
  readonly toolCalls: readonly ToolCallRecord[];
  readonly usage: UsageRecord;
  readonly contextBytes: {
    readonly skillCatalog: number;
    readonly skillBodiesRead: number;
    readonly graphResults: number;
  };
  readonly independentVerification: VerificationRecord;
  readonly protocol: {
    readonly conformant: boolean;
    readonly reason: string | null;
  };
  readonly failureReason: string | null;
}

interface RunConfiguration {
  readonly gitCommit: string;
  readonly gitDirty: boolean;
  readonly packageVersion: string;
  readonly capabilityHashes: Readonly<Record<string, string>>;
  readonly upbgeBuildHash: string;
}

interface LiveUpbgeState {
  readonly version: string;
  readonly objectExists: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function parsePositiveInteger(value: string | undefined, option: string): number {
  if (value === undefined || !/^\d+$/.test(value)) {
    throw new Error(`${option} requires a positive integer.`);
  }
  const parsed = Number(value);
  if (parsed < 1 || parsed > BENCHMARK_SCHEDULE.length) {
    throw new Error(`${option} must be between 1 and ${BENCHMARK_SCHEDULE.length}.`);
  }
  return parsed;
}

function parseOptions(args: readonly string[]): RunnerOptions {
  let model: string | undefined;
  let thinkingLevel: ThinkingLevel | undefined;
  let startSequence = 1;
  let endSequence = BENCHMARK_SCHEDULE.length;
  let outputPath: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const option = args[index];
    const value = args[index + 1];
    if (option === "--model") {
      if (value === undefined) throw new Error("--model requires provider/model.");
      model = value;
      index += 1;
    } else if (option === "--thinking") {
      if (value === undefined || !THINKING_LEVELS.some((level) => level === value)) {
        throw new Error(`--thinking must be one of: ${THINKING_LEVELS.join(", ")}.`);
      }
      thinkingLevel = value;
      index += 1;
    } else if (option === "--start") {
      startSequence = parsePositiveInteger(value, option);
      index += 1;
    } else if (option === "--end") {
      endSequence = parsePositiveInteger(value, option);
      index += 1;
    } else if (option === "--output") {
      if (value === undefined || value.trim() === "") throw new Error("--output requires a path.");
      outputPath = resolve(PROJECT_ROOT, value);
      index += 1;
    } else {
      throw new Error(`Unknown option: ${option ?? "<missing>"}`);
    }
  }

  if (model === undefined) throw new Error("--model provider/model is required.");
  if (thinkingLevel === undefined) throw new Error("--thinking level is required.");
  if (startSequence > endSequence) throw new Error("--start must not exceed --end.");

  const timestamp = new Date().toISOString().replaceAll(":", "-").replace(".", "-");
  return {
    model,
    thinkingLevel,
    startSequence,
    endSequence,
    outputPath:
      outputPath ?? resolve(PROJECT_ROOT, "benchmarks", "results", `${BENCHMARK_NAME}-${timestamp}.jsonl`),
  };
}

async function prepareFlatSkills(): Promise<void> {
  for (const skill of BENCHMARK_SKILLS) {
    const sourceDirectory = resolve(CAPABILITIES_DIRECTORY, skill);
    const source = await readFile(resolve(sourceDirectory, "SKILL.md"), "utf8");
    const targetDirectory = resolve(GENERATED_FLAT_SKILLS, skill);
    await cp(sourceDirectory, targetDirectory, { recursive: true, force: true });
    await writeFile(resolve(targetDirectory, "SKILL.md"), createFlatSkillContents(source), "utf8");
  }
}

async function sha256(path: string): Promise<string> {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

async function loadConfiguration(): Promise<RunConfiguration> {
  const [{ stdout: commit }, { stdout: status }, packageText] = await Promise.all([
    execFile("git", ["rev-parse", "HEAD"], { cwd: PROJECT_ROOT }),
    execFile("git", ["status", "--porcelain"], { cwd: PROJECT_ROOT }),
    readFile(resolve(PROJECT_ROOT, "package.json"), "utf8"),
  ]);
  const packageManifest: unknown = JSON.parse(packageText);
  if (!isRecord(packageManifest) || typeof packageManifest.version !== "string") {
    throw new Error("package.json must contain a string version.");
  }

  const capabilityHashes: Record<string, string> = {};
  for (const skill of BENCHMARK_SKILLS) {
    capabilityHashes[skill] = await sha256(resolve(CAPABILITIES_DIRECTORY, skill, "SKILL.md"));
  }

  return {
    gitCommit: commit.trim(),
    gitDirty: status.trim() !== "",
    packageVersion: packageManifest.version,
    capabilityHashes,
    upbgeBuildHash: process.env.CAPGRAPH_UPBGE_BUILD_HASH ?? "9a92b08bb47b",
  };
}

async function inspectUpbgeState(): Promise<LiveUpbgeState> {
  const status = await executeUpbgeOperation({ operation: "status" });
  if (!isRecord(status) || typeof status.version !== "string") {
    throw new Error("UPBGE status returned no version.");
  }

  const objectState = await sendUpbgeCode(
    [
      "import bpy",
      `obj = bpy.data.objects.get(${JSON.stringify(BENCHMARK_OBJECT_NAME)})`,
      'result = {"exists": obj is not None}',
    ].join("\n"),
  );
  if (!isRecord(objectState) || typeof objectState.exists !== "boolean") {
    throw new Error("UPBGE object precondition returned an invalid result.");
  }
  return { version: status.version, objectExists: objectState.exists };
}

async function waitForManualGate(slot: BenchmarkSlot): Promise<LiveUpbgeState> {
  const input = createInterface({ input: process.stdin, output: process.stdout });
  try {
    while (true) {
      try {
        const state = await inspectUpbgeState();
        if (!state.objectExists) {
          await input.question(
            `\nSlot ${slot.sequence}/10 (${slot.condition}, pair ${slot.pair}) is clean. Press Enter to start.`,
          );
          return state;
        }
        console.log(
          `\nManual reset required: remove ${BENCHMARK_OBJECT_NAME} or reload the empty benchmark scene.`,
        );
      } catch (error) {
        console.log(`\nUPBGE is not ready: ${errorMessage(error)}`);
        console.log("Start UPBGE and its bridge, then restore the empty benchmark scene.");
      }
      await input.question("Press Enter to check again.");
    }
  } finally {
    input.close();
  }
}

function isInside(path: string, directory: string): boolean {
  const relativePath = relative(directory, path);
  return (
    relativePath !== "" &&
    relativePath !== ".." &&
    !relativePath.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) &&
    !isAbsolute(relativePath)
  );
}

function isSkillFile(path: string): boolean {
  const absolutePath = resolve(path);
  return (
    basename(absolutePath) === "SKILL.md" &&
    (isInside(absolutePath, GENERATED_FLAT_SKILLS) || isInside(absolutePath, CAPABILITIES_DIRECTORY))
  );
}

function textBytes(value: unknown): number {
  if (!isRecord(value) || !Array.isArray(value.content)) return 0;
  let bytes = 0;
  for (const content of value.content) {
    if (isRecord(content) && content.type === "text" && typeof content.text === "string") {
      bytes += Buffer.byteLength(content.text, "utf8");
    }
  }
  return bytes;
}

function parseVerification(value: unknown): VerificationRecord {
  if (!isRecord(value) || typeof value.ok !== "boolean" || !Array.isArray(value.failures)) {
    return { ok: false, failures: [], error: "Verifier returned an invalid result." };
  }
  return { ok: value.ok, failures: value.failures };
}

function isInfrastructureError(message: string): boolean {
  return /Cannot communicate with UPBGE|Timed out waiting for UPBGE|bridge closed|model|provider|API key|rate limit|network/i.test(
    message,
  );
}

async function createLoader(
  condition: BenchmarkCondition,
  settingsManager: SettingsManager,
): Promise<DefaultResourceLoader> {
  const loader = new DefaultResourceLoader({
    cwd: PROJECT_ROOT,
    agentDir: getAgentDir(),
    settingsManager,
    additionalExtensionPaths:
      condition === "graph" ? [GRAPH_EXTENSION, UPBGE_EXTENSION] : [UPBGE_EXTENSION],
    additionalSkillPaths: condition === "flat" ? [GENERATED_FLAT_SKILLS] : [],
    noExtensions: true,
    noSkills: true,
    noPromptTemplates: true,
    noThemes: true,
    noContextFiles: true,
  });
  await loader.reload();
  const extensionErrors = loader.getExtensions().errors;
  if (extensionErrors.length > 0) {
    throw new Error(`Extension loading failed: ${JSON.stringify(extensionErrors)}`);
  }
  const skillDiagnostics = loader.getSkills().diagnostics;
  if (skillDiagnostics.length > 0) {
    throw new Error(`Skill loading failed: ${JSON.stringify(skillDiagnostics)}`);
  }
  return loader;
}

async function runAttempt(
  slot: BenchmarkSlot,
  attempt: number,
  options: RunnerOptions,
  configuration: RunConfiguration,
  upbgeVersion: string,
  modelRuntime: ModelRuntime,
): Promise<AttemptRecord> {
  const resolvedModel = resolveCliModel({ cliModel: options.model, modelRuntime });
  if (resolvedModel.error !== undefined || resolvedModel.model === undefined) {
    throw new Error(resolvedModel.error ?? `Cannot resolve model ${options.model}.`);
  }

  const settingsManager = SettingsManager.inMemory({
    compaction: { enabled: false },
    retry: { enabled: false },
  });
  const loader = await createLoader(slot.condition, settingsManager);
  const catalogBytes = Buffer.byteLength(formatSkillsForPrompt(loader.getSkills().skills), "utf8");
  const toolNames =
    slot.condition === "graph"
      ? ["read", "skill_graph", "upbge_control"]
      : ["read", "upbge_control"];
  const { session, extensionsResult } = await createAgentSession({
    cwd: PROJECT_ROOT,
    agentDir: getAgentDir(),
    model: resolvedModel.model,
    thinkingLevel: options.thinkingLevel,
    modelRuntime,
    resourceLoader: loader,
    tools: toolNames,
    sessionManager: SessionManager.inMemory(PROJECT_ROOT),
    settingsManager,
  });
  if (extensionsResult.errors.length > 0) {
    session.dispose();
    throw new Error(`Session extension loading failed: ${JSON.stringify(extensionsResult.errors)}`);
  }

  const startedAt = new Date();
  const calls = new Map<string, ToolCallRecord>();
  let turns = 0;
  let skillBodiesRead = 0;
  let graphResults = 0;
  let limitReason: string | undefined;
  let abortRequested = false;

  const requestAbort = (reason: string): void => {
    if (abortRequested) return;
    abortRequested = true;
    limitReason = reason;
    queueMicrotask(() => void session.abort());
  };

  const unsubscribe = session.subscribe((event: AgentSessionEvent) => {
    if (event.type === "turn_start") {
      turns += 1;
    } else if (event.type === "tool_execution_start") {
      calls.set(event.toolCallId, {
        id: event.toolCallId,
        name: event.toolName,
        args: event.args,
        startedAt: new Date().toISOString(),
      });
      if (calls.size > MAX_TOOL_CALLS) {
        requestAbort(`Exceeded ${MAX_TOOL_CALLS} agent tool calls.`);
      }
    } else if (event.type === "tool_execution_end") {
      const call = calls.get(event.toolCallId);
      if (call !== undefined) {
        call.durationMs = Date.now() - Date.parse(call.startedAt);
        call.isError = event.isError;
        if (
          call.name === "read" &&
          isRecord(call.args) &&
          typeof call.args.path === "string" &&
          isSkillFile(call.args.path)
        ) {
          skillBodiesRead += textBytes(event.result);
        } else if (call.name === "skill_graph") {
          graphResults += textBytes(event.result);
        }
      }
    }
  });

  const timeout = setTimeout(() => requestAbort("Exceeded 5 minute run duration."), RUN_TIMEOUT_MS);
  let promptError: string | undefined;
  try {
    await session.prompt(BENCHMARK_PROMPT, { source: "extension" });
    await session.waitForIdle();
  } catch (error) {
    promptError = errorMessage(error);
  } finally {
    clearTimeout(timeout);
    unsubscribe();
  }

  let verification: VerificationRecord;
  try {
    verification = parseVerification(
      await executeUpbgeOperation({
        operation: "verify_physics_object",
        objectName: BENCHMARK_OBJECT_NAME,
      }),
    );
  } catch (error) {
    verification = { ok: false, failures: [], error: errorMessage(error) };
  }

  const stats = session.getSessionStats();
  const sessionError = session.agent.state.errorMessage;
  session.dispose();

  const toolCalls = [...calls.values()];
  const protocol = evaluateBenchmarkProtocol(slot.condition, toolCalls);
  const runtimeFailure = limitReason ?? promptError ?? sessionError ?? verification.error ?? null;
  const failureReason = runtimeFailure ?? protocol.reason;
  let status: AttemptStatus;
  if (runtimeFailure !== null && isInfrastructureError(runtimeFailure)) {
    status = "infrastructure_failure";
  } else if (!protocol.conformant) {
    status = "protocol_failure";
  } else if (verification.ok && runtimeFailure === null) {
    status = "success";
  } else {
    status = "task_failure";
  }

  return {
    benchmark: BENCHMARK_NAME,
    sequence: slot.sequence,
    pair: slot.pair,
    attempt,
    condition: slot.condition,
    status,
    gitCommit: configuration.gitCommit,
    gitDirty: configuration.gitDirty,
    piVersion: PI_VERSION,
    packageVersion: configuration.packageVersion,
    model: `${resolvedModel.model.provider}/${resolvedModel.model.id}`,
    thinkingLevel: options.thinkingLevel,
    upbgeVersion,
    upbgeBuildHash: configuration.upbgeBuildHash,
    capabilityHashes: configuration.capabilityHashes,
    startedAt: startedAt.toISOString(),
    durationMs: Date.now() - startedAt.getTime(),
    turns,
    toolCalls,
    usage: {
      input: stats.tokens.input,
      output: stats.tokens.output,
      cacheRead: stats.tokens.cacheRead,
      cacheWrite: stats.tokens.cacheWrite,
      cost: stats.cost,
    },
    contextBytes: { skillCatalog: catalogBytes, skillBodiesRead, graphResults },
    independentVerification: verification,
    protocol,
    failureReason,
  };
}

async function appendRecord(path: string, record: AttemptRecord): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${JSON.stringify(record)}\n`, "utf8");
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  await prepareFlatSkills();
  const configuration = await loadConfiguration();
  const modelRuntime = await ModelRuntime.create();
  const schedule = BENCHMARK_SCHEDULE.filter(
    (slot) => slot.sequence >= options.startSequence && slot.sequence <= options.endSequence,
  );

  console.log(`Benchmark: ${BENCHMARK_NAME}`);
  console.log(`Output: ${options.outputPath}`);
  console.log(`Model: ${options.model}; thinking: ${options.thinkingLevel}`);
  console.log("Manual gate enabled. The runner never resets or removes UPBGE objects.");

  for (const slot of schedule) {
    let attempt = 1;
    while (true) {
      const state = await waitForManualGate(slot);
      const record = await runAttempt(
        slot,
        attempt,
        options,
        configuration,
        state.version,
        modelRuntime,
      );
      await appendRecord(options.outputPath, record);
      console.log(
        `Slot ${slot.sequence} attempt ${attempt}: ${record.status}; ` +
          `verification=${record.independentVerification.ok}; ` +
          `protocol=${record.protocol.conformant}; tools=${record.toolCalls.length}`,
      );
      if (record.status !== "infrastructure_failure") break;
      console.log("Infrastructure failure recorded. The same slot must be repeated.");
      attempt += 1;
    }
  }

  console.log(`Pilot range complete. Raw records: ${options.outputPath}`);
}

main().catch((error: unknown) => {
  console.error(`Benchmark runner failed: ${errorMessage(error)}`);
  process.exitCode = 1;
});
