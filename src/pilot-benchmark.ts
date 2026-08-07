import { parseFrontmatter } from "@earendil-works/pi-coding-agent";
import { stringify } from "yaml";

export const BENCHMARK_NAME = "v0-physics-object-pilot";
export const BENCHMARK_OBJECT_NAME = "CapgraphBenchmarkCube";
export const BENCHMARK_PROMPT = `Create a physics-enabled cube named ${BENCHMARK_OBJECT_NAME} in UPBGE.

Known root capability:
physics-object-create

Complete the task and verify the result. Stop after verification passes or you determine that completion is impossible.`;

export const BENCHMARK_SKILLS = [
  "object-create",
  "rigid-body-add",
  "collision-add",
  "physics-object-create",
  "physics-object-verify",
] as const;

export type BenchmarkCondition = "flat" | "graph";

export interface BenchmarkProtocolCall {
  readonly name: string;
  readonly args: unknown;
  readonly isError?: boolean;
}

export interface BenchmarkProtocolResult {
  readonly conformant: boolean;
  readonly reason: string | null;
}

export interface BenchmarkSlot {
  readonly sequence: number;
  readonly pair: number;
  readonly condition: BenchmarkCondition;
}

export const BENCHMARK_SCHEDULE: readonly BenchmarkSlot[] = [
  { sequence: 1, pair: 1, condition: "flat" },
  { sequence: 2, pair: 1, condition: "graph" },
  { sequence: 3, pair: 2, condition: "graph" },
  { sequence: 4, pair: 2, condition: "flat" },
  { sequence: 5, pair: 3, condition: "flat" },
  { sequence: 6, pair: 3, condition: "graph" },
  { sequence: 7, pair: 4, condition: "graph" },
  { sequence: 8, pair: 4, condition: "flat" },
  { sequence: 9, pair: 5, condition: "flat" },
  { sequence: 10, pair: 5, condition: "graph" },
];

interface SkillFrontmatter {
  readonly [key: string]: unknown;
  readonly name?: unknown;
  readonly description?: unknown;
  readonly compatibility?: unknown;
  readonly "disable-model-invocation"?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function evaluateBenchmarkProtocol(
  condition: BenchmarkCondition,
  calls: readonly BenchmarkProtocolCall[],
): BenchmarkProtocolResult {
  if (condition === "flat") return { conformant: true, reason: null };

  const expandIndex = calls.findIndex(
    (call) =>
      call.name === "skill_graph" &&
      call.isError === false &&
      isRecord(call.args) &&
      call.args.operation === "expand" &&
      call.args.skill === "physics-object-create",
  );
  if (expandIndex === -1) {
    return {
      conformant: false,
      reason: "Graph run did not successfully expand physics-object-create.",
    };
  }

  const firstMutationIndex = calls.findIndex(
    (call) =>
      call.name === "upbge_control" &&
      isRecord(call.args) &&
      (call.args.operation === "create_cube" ||
        call.args.operation === "add_rigid_body" ||
        call.args.operation === "add_collision"),
  );
  if (firstMutationIndex !== -1 && expandIndex > firstMutationIndex) {
    return {
      conformant: false,
      reason: "Graph run expanded the root capability only after UPBGE mutation started.",
    };
  }

  return { conformant: true, reason: null };
}

export function createFlatSkillContents(source: string): string {
  const { frontmatter, body } = parseFrontmatter<SkillFrontmatter>(source);
  if (typeof frontmatter.name !== "string" || typeof frontmatter.description !== "string") {
    throw new Error("Capability frontmatter must contain string name and description fields.");
  }

  const flatFrontmatter: Record<string, string | boolean> = {
    name: frontmatter.name,
    description: frontmatter.description,
  };
  if (typeof frontmatter.compatibility === "string") {
    flatFrontmatter.compatibility = frontmatter.compatibility;
  }
  if (typeof frontmatter["disable-model-invocation"] === "boolean") {
    flatFrontmatter["disable-model-invocation"] = frontmatter["disable-model-invocation"];
  }

  const preservedBody = source.endsWith("\n") && !body.endsWith("\n") ? `${body}\n` : body;
  return `---\n${stringify(flatFrontmatter).trimEnd()}\n---\n\n${preservedBody}`;
}
