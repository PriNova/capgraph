export const LOADING_POLICY_BENCHMARK_NAME = "v0.1-physics-object-loading-policy";
export const LOADING_POLICY_BENCHMARK_MODEL = "openai-codex/gpt-5.6-luna";
export const LOADING_POLICY_BENCHMARK_THINKING_LEVEL = "max";
export const LOADING_POLICY_BENCHMARK_OBJECT_NAME = "CapgraphBenchmarkCube";
export const LOADING_POLICY_BENCHMARK_PROMPT = `Create a physics-enabled cube named ${LOADING_POLICY_BENCHMARK_OBJECT_NAME} in UPBGE.

Known root capability:
physics-object-create

Complete the task and verify the result. Stop after verification passes or you determine that completion is impossible.`;

export const LOADING_POLICY_BENCHMARK_SKILLS = [
  "object-create",
  "rigid-body-add",
  "collision-add",
  "physics-object-create",
  "physics-object-verify",
] as const;

export type LoadingPolicyCondition = "flat" | "graph_progressive" | "graph_batch";
export type GraphLoadingPolicy = "none" | "progressive" | "batch";

export interface LoadingPolicyProtocolCall {
  readonly name: string;
  readonly args: unknown;
  readonly isError?: boolean;
}

export interface LoadingPolicyProtocolResult {
  readonly conformant: boolean;
  readonly reason: string | null;
}

export interface LoadingPolicySlot {
  readonly sequence: number;
  readonly block: number;
  readonly position: number;
  readonly condition: LoadingPolicyCondition;
}

const BLOCK_ORDERS: readonly (readonly LoadingPolicyCondition[])[] = [
  ["flat", "graph_progressive", "graph_batch"],
  ["graph_progressive", "graph_batch", "flat"],
  ["graph_batch", "flat", "graph_progressive"],
  ["flat", "graph_batch", "graph_progressive"],
  ["graph_batch", "graph_progressive", "flat"],
  ["graph_progressive", "flat", "graph_batch"],
];

export const LOADING_POLICY_BENCHMARK_SCHEDULE: readonly LoadingPolicySlot[] =
  BLOCK_ORDERS.flatMap((conditions, blockIndex) =>
    conditions.map((condition, positionIndex) => ({
      sequence: blockIndex * conditions.length + positionIndex + 1,
      block: blockIndex + 1,
      position: positionIndex + 1,
      condition,
    })),
  );

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSuccessfulGraphOperation(
  call: LoadingPolicyProtocolCall,
  operation: "expand" | "load" | "load_many",
): boolean {
  return (
    call.name === "skill_graph" &&
    call.isError === false &&
    isRecord(call.args) &&
    call.args.operation === operation
  );
}

function isSuccessfulRootGraphCall(
  call: LoadingPolicyProtocolCall,
  operation: "expand" | "load" | "load_many",
): boolean {
  return (
    isSuccessfulGraphOperation(call, operation) &&
    isRecord(call.args) &&
    call.args.skill === "physics-object-create"
  );
}

function firstMutationIndex(calls: readonly LoadingPolicyProtocolCall[]): number {
  return calls.findIndex(
    (call) =>
      call.name === "upbge_control" &&
      isRecord(call.args) &&
      (call.args.operation === "create_cube" ||
        call.args.operation === "add_rigid_body" ||
        call.args.operation === "add_collision"),
  );
}

export function graphLoadingPolicy(condition: LoadingPolicyCondition): GraphLoadingPolicy {
  if (condition === "graph_progressive") return "progressive";
  if (condition === "graph_batch") return "batch";
  return "none";
}

export function evaluateLoadingPolicyProtocol(
  condition: LoadingPolicyCondition,
  calls: readonly LoadingPolicyProtocolCall[],
): LoadingPolicyProtocolResult {
  if (condition === "flat") return { conformant: true, reason: null };

  const expandIndex = calls.findIndex((call) => isSuccessfulRootGraphCall(call, "expand"));
  if (expandIndex === -1) {
    return {
      conformant: false,
      reason: "Graph run did not successfully expand physics-object-create.",
    };
  }

  const expectedOperation = condition === "graph_batch" ? "load_many" : "load";
  const loadIndices = calls
    .map((call, index) => (isSuccessfulRootGraphCall(call, expectedOperation) ? index : -1))
    .filter((index) => index !== -1);
  if (loadIndices.length === 0) {
    return {
      conformant: false,
      reason:
        condition === "graph_batch"
          ? "Graph Batch run did not batch-load physics-object-create after expansion."
          : "Graph Progressive run did not load physics-object-create after expansion.",
    };
  }

  const disallowedOperation = condition === "graph_batch" ? "load" : "load_many";
  if (calls.some((call) => isSuccessfulGraphOperation(call, disallowedOperation))) {
    return {
      conformant: false,
      reason:
        condition === "graph_batch"
          ? "Graph Batch run used an individual graph load."
          : "Graph Progressive run used batch graph loading.",
    };
  }
  if (condition === "graph_batch" && loadIndices.length !== 1) {
    return {
      conformant: false,
      reason: "Graph Batch run must use exactly one batch graph load.",
    };
  }

  const firstLoadIndex = loadIndices[0];
  if (firstLoadIndex === undefined || firstLoadIndex < expandIndex) {
    return {
      conformant: false,
      reason: "Graph run loaded capability prose before expanding root metadata.",
    };
  }

  const mutationIndex = firstMutationIndex(calls);
  if (mutationIndex !== -1 && expandIndex > mutationIndex) {
    return {
      conformant: false,
      reason: "Graph run expanded root metadata only after UPBGE mutation started.",
    };
  }
  if (mutationIndex !== -1 && firstLoadIndex > mutationIndex) {
    return {
      conformant: false,
      reason: "Graph run loaded capability prose only after UPBGE mutation started.",
    };
  }

  return { conformant: true, reason: null };
}
