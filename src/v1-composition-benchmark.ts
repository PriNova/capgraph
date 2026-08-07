import { parseFrontmatter } from "@earendil-works/pi-coding-agent";
import { stringify } from "yaml";

export const V1_BENCHMARK_NAME = "v1-vehicle-composition";
export const V1_BENCHMARK_MODEL = "openai-codex/gpt-5.6-luna";
export const V1_BENCHMARK_THINKING_LEVEL = "max";
export const V1_OBJECT_NAME = "CapgraphVehicle";
export const V1_CAMERA_NAME = "CapgraphVehicleCamera";
export const V1_COLLECTION_NAME = "CapgraphVehicleCollection";
export const V1_ROOT_SKILL = "vehicle-create";

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
interface ProtocolResult { readonly conformant: boolean; readonly reason: string | null }
function record(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }

export function isCompleteV1VerifierCall(call: V1RecordedToolCall): boolean {
  return call.name === "upbge_control" &&
    call.isError === false &&
    record(call.args) &&
    call.args.operation === "verify_state" &&
    call.args.object_name === V1_OBJECT_NAME &&
    call.args.profile === "vehicle";
}

export function v1IrrelevantLoadedSkills(variant: V1Variant, loadedSkills: readonly string[]): string[] {
  const relevant = new Set<string>(V1_NORMAL_LOADED_SKILLS);
  if (variant === "recovery") relevant.add("vehicle-collision-repair");
  return [...new Set(loadedSkills)].filter((skill) => !relevant.has(skill));
}
function graphCall(call: V1RecordedToolCall, operation: string, skill = V1_ROOT_SKILL): boolean {
  return call.name === "skill_graph" && call.isError === false && record(call.args) && call.args.operation === operation && call.args.skill === skill;
}

export function evaluateV1Protocol(condition: V1Condition, variant: V1Variant, calls: readonly V1RecordedToolCall[]): ProtocolResult {
  if (condition === "flat") {
    return calls.some((call) => call.name === "read" && call.isError === true)
      ? { conformant: false, reason: "Flat run attempted a blocked or failed fixture read." }
      : { conformant: true, reason: null };
  }
  if (calls.some((call) => call.name === "read")) return { conformant: false, reason: "Graph run used flat read discovery." };
  const expand = calls.findIndex((call) => graphCall(call, "expand"));
  const batches = calls.map((call, i) => graphCall(call, "load_many") ? i : -1).filter((i) => i >= 0);
  const mutation = calls.findIndex((call) => call.name === "upbge_control" && record(call.args) && !["status", "verify_state"].includes(String(call.args.operation)));
  if (expand < 0 || batches.length !== 1 || batches[0]! < expand) return { conformant: false, reason: "Graph must expand then batch-load vehicle-create exactly once." };
  if (mutation >= 0 && batches[0]! > mutation) return { conformant: false, reason: "Graph execution started before batch loading." };
  const recoveryLoads = calls.filter((call) => graphCall(call, "load", "vehicle-collision-repair"));
  const firstVerify = calls.findIndex((call) => call.name === "upbge_control" && record(call.args) && call.args.operation === "verify_state");
  if (recoveryLoads.some((call) => calls.indexOf(call) < firstVerify)) return { conformant: false, reason: "Recovery prose was eagerly loaded." };
  if (variant === "normal" && recoveryLoads.length > 0) return { conformant: false, reason: "Normal run loaded recovery prose." };
  return { conformant: true, reason: null };
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
