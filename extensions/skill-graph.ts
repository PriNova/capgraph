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

import { expand, inspect, loadGraph, loadSkill, type GraphReadOptions } from "../src/graph.ts";

const CAPABILITIES_DIRECTORY = fileURLToPath(new URL("../capabilities/", import.meta.url));
const OPERATIONS = ["inspect", "expand", "load"] as const;

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
        "Reduce the selected capability graph before expanding it.",
    );
  }

  return output;
}

const skillGraphTool = defineTool({
  name: "skill_graph",
  label: "Skill Graph",
  description:
    `Inspect, expand, or load a known capability by canonical skill name. ` +
    `Results are limited to ${DEFAULT_MAX_LINES} lines or ${formatSize(DEFAULT_MAX_BYTES)}.`,
  promptSnippet: "Inspect, expand, or progressively load capabilities from a known root skill",
  promptGuidelines: [
    "Use skill_graph only when the task supplies or otherwise establishes a canonical root skill name.",
    "For an execution task, call expand on the root capability to get metadata, then load the root capability before using execution tools.",
    "Load dependency and verification skill prose only when needed for the current step; load recovery prose only after a relevant failure.",
    "Use inspect only when the task asks about one capability's direct graph metadata without executing it.",
  ],
  parameters,

  async execute(_toolCallId, params, signal) {
    signal?.throwIfAborted();
    const options = getReadOptions(signal);
    const graph = await loadGraph(CAPABILITIES_DIRECTORY, options);
    signal?.throwIfAborted();

    const result =
      params.operation === "inspect"
        ? inspect(graph, params.skill)
        : params.operation === "expand"
          ? await expand(graph, params.skill, options)
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
});

export default function registerSkillGraph(pi: ExtensionAPI): void {
  pi.registerTool(skillGraphTool);
}
