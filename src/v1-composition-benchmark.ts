import { parseFrontmatter } from "@earendil-works/pi-coding-agent";
import { stringify } from "yaml";

export const V1_BENCHMARK_NAME = "v1-vehicle-composition";
export const V1_BENCHMARK_MODEL = "openai-codex/gpt-5.6-luna";
export const V1_BENCHMARK_THINKING_LEVEL = "max";
export const V1_OBJECT_NAME = "CapgraphVehicle";
export const V1_CAMERA_NAME = "CapgraphVehicleCamera";
export const V1_COLLECTION_NAME = "CapgraphVehicleCollection";
export const V1_ROOT_SKILL = "vehicle-create";
export const V1_EXPECTED_COLLISION_GROUP: readonly boolean[] = [true, ...Array<boolean>(15).fill(false)];
export const V1_EXPECTED_COLLISION_MASK: readonly boolean[] = [true, true, ...Array<boolean>(14).fill(false)];
export const V1_FAULT_COLLISION_MASK: readonly boolean[] = [true, ...Array<boolean>(15).fill(false)];

export const V1_EXPECTED_ORDER = [
  "mesh-object-create",
  "object-resolve",
  "rigid-body-add",
  "chassis-create",
  "keyboard-input",
  "input-map-create",
  "vehicle-controls",
  "collision-add",
  "collision-mask-configure",
  "vehicle-collision",
  "camera-create",
  "third-person-camera",
  "vehicle-create",
  "vehicle-verify",
  "vehicle-collision-repair",
] as const;

export const V1_EXECUTION_ORDER = V1_EXPECTED_ORDER.slice(0, 13);
export const V1_NORMAL_LOADED_SKILLS = [...V1_EXECUTION_ORDER, "vehicle-verify"] as const;
export const V1_UNRELATED_SKILLS = [
  "light-create", "audio-source-add", "navmesh-build", "character-controller-add",
  "animation-state-machine-create", "first-person-camera", "static-scene-verify",
  "character-verify", "vehicle-static-verify",
] as const;

export type V1Condition = "flat" | "graph";
export type V1Variant = "normal" | "recovery";

export function v1SessionToolNames(condition: V1Condition): readonly string[] {
  return condition === "flat"
    ? ["read", "upbge_control"]
    : ["read", "skill_graph", "upbge_control"];
}

export interface V1Slot {
  readonly sequence: number;
  readonly block: number;
  readonly position: number;
  readonly condition: V1Condition;
  readonly variant: V1Variant;
}

export const V1_SCHEDULE: readonly V1Slot[] = [
  { sequence: 1, block: 1, position: 1, condition: "flat", variant: "normal" },
  { sequence: 2, block: 1, position: 2, condition: "graph", variant: "recovery" },
  { sequence: 3, block: 2, position: 1, condition: "graph", variant: "normal" },
  { sequence: 4, block: 2, position: 2, condition: "flat", variant: "recovery" },
  { sequence: 5, block: 3, position: 1, condition: "flat", variant: "recovery" },
  { sequence: 6, block: 3, position: 2, condition: "graph", variant: "normal" },
  { sequence: 7, block: 4, position: 1, condition: "graph", variant: "recovery" },
  { sequence: 8, block: 4, position: 2, condition: "flat", variant: "normal" },
];

export function v1Prompt(variant: V1Variant): string {
  return `Create one small controllable vehicle named ${V1_OBJECT_NAME} in the known empty UPBGE scene.${variant === "recovery" ? " The fixture may report an observed runtime fault; preserve valid state while resolving it." : ""}\n\nKnown root capability:\n${V1_ROOT_SKILL}\n\nComplete the task and verify actual editor state. Stop after verification passes or completion is impossible.`;
}

export interface V1RecordedToolCall { readonly name: string; readonly args: unknown; readonly isError?: boolean }
export interface V1Assessment { readonly conformant: boolean; readonly reasons: readonly string[] }
interface ProtocolResult { readonly conformant: boolean; readonly reason: string | null }
function record(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }

export function isCompleteV1VerificationCall(call: V1RecordedToolCall): boolean {
  return call.name === "upbge_control" &&
    call.isError === false &&
    record(call.args) &&
    call.args.operation === "verify_state" &&
    call.args.object_name === V1_OBJECT_NAME &&
    typeof call.args.profile === "string";
}

export function isCompleteV1VerifierCall(call: V1RecordedToolCall): boolean {
  return isCompleteV1VerificationCall(call) && record(call.args) && call.args.profile === "vehicle";
}

export function v1IrrelevantLoadedSkills(variant: V1Variant, loadedSkills: readonly string[]): string[] {
  const relevant = new Set<string>(V1_NORMAL_LOADED_SKILLS);
  if (variant === "recovery") relevant.add("vehicle-collision-repair");
  return [...new Set(loadedSkills)].filter((skill) => !relevant.has(skill));
}
function graphCall(call: V1RecordedToolCall, operation: string, skill = V1_ROOT_SKILL): boolean {
  return call.name === "skill_graph" && call.isError === false && record(call.args) && call.args.operation === operation && call.args.skill === skill;
}

export function evaluateV1Protocol(condition: V1Condition, _variant: V1Variant, calls: readonly V1RecordedToolCall[]): ProtocolResult {
  if (condition === "flat") return { conformant: true, reason: null };

  const expand = calls.findIndex((call) => graphCall(call, "expand"));
  const batches = calls.map((call, index) => graphCall(call, "load_many") ? index : -1).filter((index) => index >= 0);
  const mutation = calls.findIndex((call) => call.name === "upbge_control" && record(call.args) && !["status", "verify_state"].includes(String(call.args.operation)));
  if (expand < 0 || batches.length !== 1 || batches[0]! < expand) {
    return { conformant: false, reason: "Graph must expand then batch-load vehicle-create exactly once." };
  }
  if (mutation >= 0 && batches[0]! > mutation) {
    return { conformant: false, reason: "Graph execution started before batch loading." };
  }
  const disallowedLoads = calls.filter((call) => call.name === "skill_graph" && call.isError === false && record(call.args) && call.args.operation === "load" && call.args.skill !== "vehicle-collision-repair");
  if (disallowedLoads.length > 0) {
    return { conformant: false, reason: "Graph Batch run used an individual non-recovery graph load." };
  }
  return { conformant: true, reason: null };
}

export function evaluateV1VerifierResults(
  variant: V1Variant,
  firstResult: boolean | null,
  secondResult: boolean | null,
  firstFailures: readonly unknown[] = [],
): ProtocolResult {
  if (variant === "normal") return { conformant: true, reason: null };
  if (firstResult !== false) return { conformant: false, reason: "Recovery run did not observe the controlled first-verifier failure." };
  const failure = firstFailures[0];
  if (
    firstFailures.length !== 1 ||
    !record(failure) ||
    failure.capability !== "vehicle-collision" ||
    failure.property !== "collision_mask" ||
    JSON.stringify(failure.expected) !== JSON.stringify(V1_EXPECTED_COLLISION_MASK) ||
    JSON.stringify(failure.actual) !== JSON.stringify(V1_FAULT_COLLISION_MASK)
  ) {
    return { conformant: false, reason: "Recovery run did not observe the exact controlled collision-mask failure." };
  }
  if (secondResult !== true) return { conformant: false, reason: "Recovery run did not pass the second complete verification." };
  return { conformant: true, reason: null };
}

export function evaluateV1Composition(
  condition: V1Condition,
  variant: V1Variant,
  calls: readonly V1RecordedToolCall[],
  selectedVerifier: unknown,
  firstResult: boolean | null,
  secondResult: boolean | null,
  firstFailures: readonly unknown[],
  irrelevantSkills: readonly string[],
): V1Assessment {
  const reasons: string[] = [];
  if (selectedVerifier !== "vehicle") reasons.push("The first selected verifier was not vehicle.");
  if (irrelevantSkills.length > 0) reasons.push(`Loaded irrelevant skill bodies: ${irrelevantSkills.join(", ")}.`);
  if (variant === "recovery") {
    const resultAssessment = evaluateV1VerifierResults(variant, firstResult, secondResult, firstFailures);
    if (!resultAssessment.conformant && resultAssessment.reason !== null) reasons.push(resultAssessment.reason);

    const firstVerify = calls.findIndex(isCompleteV1VerifierCall);
    const repairs = calls.map((call, index) => call.name === "upbge_control" && call.isError === false && record(call.args) && call.args.operation === "set_collision_mask" ? index : -1).filter((index) => index >= 0);
    const repair = repairs[0];
    if (repairs.length !== 1) reasons.push("Recovery did not call the collision-mask mutation exactly once.");
    if (repair !== undefined && (firstVerify < 0 || repair < firstVerify)) reasons.push("Recovery mutation ran before the observed vehicle failure.");
    const repairCall = repair === undefined ? undefined : calls[repair];
    if (repairCall !== undefined && (!record(repairCall.args) || JSON.stringify(repairCall.args.collision_mask) !== JSON.stringify(V1_EXPECTED_COLLISION_MASK))) {
      reasons.push("Recovery did not supply the expected explicit collision mask.");
    }

    const recoveryLoads = calls.map((call, index) => {
      if (condition === "graph" && graphCall(call, "load", "vehicle-collision-repair")) return index;
      if (condition === "flat" && call.name === "read" && call.isError === false && record(call.args) && typeof call.args.path === "string" && /(?:^|[\\/])vehicle-collision-repair[\\/]SKILL\.md$/i.test(call.args.path)) return index;
      return -1;
    }).filter((index) => index >= 0);
    if (recoveryLoads.length !== 1) reasons.push("Recovery prose was not loaded exactly once.");
    if (repair !== undefined && recoveryLoads[0] !== undefined && recoveryLoads[0] > repair) reasons.push("Recovery prose was loaded only after the recovery mutation.");
    if (condition === "graph" && firstVerify >= 0 && recoveryLoads[0] !== undefined && recoveryLoads[0] < firstVerify) reasons.push("Graph recovery prose was loaded eagerly before the observed failure.");
  }
  return { conformant: reasons.length === 0, reasons };
}

export function evaluateV1ExecutionBehavior(variant: V1Variant, calls: readonly V1RecordedToolCall[]): V1Assessment {
  const reasons: string[] = [];
  const repairs = calls.map((call, index) => call.name === "upbge_control" && call.isError === false && record(call.args) && call.args.operation === "set_collision_mask" ? index : -1).filter((index) => index >= 0);
  const firstVerify = calls.findIndex(isCompleteV1VerifierCall);
  if (variant === "normal" && repairs.length > 0) reasons.push("Normal run called an unnecessary collision-mask mutation.");
  if (variant === "recovery" && repairs.some((index) => firstVerify < 0 || index < firstVerify)) reasons.push("Recovery run mutated the collision mask before observing the failure.");
  if (repairs.length > 1) reasons.push("Run called the collision-mask mutation more than once.");
  const failedCalls = calls.filter((call) => call.isError === true).length;
  if (failedCalls > 0) reasons.push(`Run had ${failedCalls} failed tool call${failedCalls === 1 ? "" : "s"}.`);
  return { conformant: reasons.length === 0, reasons };
}

export function createV1FlatSkillContents(source: string): string {
  const { frontmatter, body } = parseFrontmatter<Record<string, unknown>>(source);
  const copied = { ...frontmatter };
  if (record(copied.metadata)) {
    const metadata = Object.fromEntries(Object.entries(copied.metadata).filter(([key]) => !key.startsWith("capgraph-")));
    if (Object.keys(metadata).length === 0) delete copied.metadata;
    else copied.metadata = metadata;
  }
  const preservedBody = source.endsWith("\n") && !body.endsWith("\n") ? `${body}\n` : body;
  return `---\n${stringify(copied).trimEnd()}\n---\n\n${preservedBody}`;
}
