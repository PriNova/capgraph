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
