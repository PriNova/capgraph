import { fileURLToPath } from "node:url";

import { StringEnum } from "@earendil-works/pi-ai";
import {
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
  defineTool,
  formatSize,
  type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

import {
  expand,
  inspect,
  loadGraph,
  loadMany,
  loadSkill,
  type GraphReadOptions,
} from "../src/graph.ts";

const CAPABILITIES_DIRECTORY = fileURLToPath(new URL("../capabilities/", import.meta.url));
const OPERATIONS = ["inspect", "expand", "load", "load_many"] as const;

export type SkillGraphLoadingPolicy = "progressive" | "batch";

const parameters = Type.Object(
  {
    operation: StringEnum(OPERATIONS, {
      description: "Graph operation to perform.",
    }),
    skill: Type.String({
      description: "Canonical Agent Skills name of the known root capability.",
      minLength: 1,
      maxLength: 64,
      pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
    }),
  },
  { additionalProperties: false },
);

function getReadOptions(signal: AbortSignal | undefined): GraphReadOptions {
  return signal === undefined ? {} : { signal };
}

function serializeResult(result: unknown): string {
  const output = JSON.stringify(result, null, 2);
  const lineCount = output.split("\n").length;
  const byteCount = Buffer.byteLength(output, "utf8");

  if (lineCount > DEFAULT_MAX_LINES || byteCount > DEFAULT_MAX_BYTES) {
    throw new Error(
      `Skill graph result exceeds ${DEFAULT_MAX_LINES} lines or ${formatSize(DEFAULT_MAX_BYTES)}. ` +
        "Reduce the selected capability set before requesting it.",
    );
  }

  return output;
}

export function registerSkillGraph(
  pi: ExtensionAPI,
  loadingPolicy: SkillGraphLoadingPolicy = "progressive",
  capabilitiesDirectory: string = CAPABILITIES_DIRECTORY,
): void {
  const loadingGuideline =
    loadingPolicy === "batch"
      ? "After skill_graph expand, call skill_graph load_many on the root before execution. It loads the required execution and verification bodies in deterministic order."
      : "After skill_graph expand, use skill_graph load for individual root, dependency, and verification bodies as needed. Do not call load_many.";

  pi.registerTool(defineTool({
    name: "skill_graph",
    label: "Skill Graph",
    description:
      `Inspect, expand, load one skill, or batch-load a known root closure. ` +
      `Results are limited to ${DEFAULT_MAX_LINES} lines or ${formatSize(DEFAULT_MAX_BYTES)}.`,
    promptSnippet: "Inspect, expand, or load capabilities from a known root skill",
    promptGuidelines: [
      "Use skill_graph only when the task supplies or otherwise establishes a canonical root skill name.",
      "For an execution task, call skill_graph expand on the root before loading prose or using execution tools.",
      loadingGuideline,
      "Load recovery prose only after a relevant failure.",
      "Use skill_graph inspect only for direct metadata questions without execution.",
    ],
    parameters,

    async execute(_toolCallId, params, signal) {
      signal?.throwIfAborted();
      const options = getReadOptions(signal);
      const graph = await loadGraph(capabilitiesDirectory, options);
      signal?.throwIfAborted();

      const result =
        params.operation === "inspect"
          ? inspect(graph, params.skill)
          : params.operation === "expand"
            ? await expand(graph, params.skill, options)
            : params.operation === "load_many"
              ? await loadMany(graph, params.skill, options)
              : await loadSkill(graph, params.skill, options);

      signal?.throwIfAborted();
      return {
        content: [{ type: "text", text: serializeResult(result) }],
        details: {
          operation: params.operation,
          skill: params.skill,
        },
      };
    },
  }));
}

export default registerSkillGraph;
