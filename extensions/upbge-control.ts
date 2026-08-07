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
  executeUpbgeOperation,
  UPBGE_OPERATIONS,
  type UpbgeControlInput,
} from "../src/upbge-control.ts";

const parameters = Type.Object(
  {
    operation: StringEnum(UPBGE_OPERATIONS, {
      description: "Allowed UPBGE editor operation.",
    }),
    object_name: Type.Optional(
      Type.String({
        description: "Existing or new UPBGE object name. Required except for status.",
        minLength: 1,
        maxLength: 64,
        pattern: "^[A-Za-z][A-Za-z0-9_-]{0,63}$",
      }),
    ),
  },
  { additionalProperties: false },
);

function serializeResult(result: unknown): string {
  const output = JSON.stringify(result, null, 2);
  const lineCount = output.split("\n").length;
  const byteCount = Buffer.byteLength(output, "utf8");
  if (lineCount > DEFAULT_MAX_LINES || byteCount > DEFAULT_MAX_BYTES) {
    throw new Error(
      `UPBGE result exceeds ${DEFAULT_MAX_LINES} lines or ${formatSize(DEFAULT_MAX_BYTES)}.`,
    );
  }
  return output;
}

export default function registerUpbgeControl(pi: ExtensionAPI): void {
  pi.registerTool(
    defineTool({
      name: "upbge_control",
      label: "UPBGE Control",
      description:
        "Run one allowed Capgraph operation in the UPBGE editor bridge at 127.0.0.1:9876. " +
        "The tool sends fixed wrappers that load repository capability scripts; it never sends model-authored Python.",
      promptSnippet: "Control and verify UPBGE editor objects through approved Capgraph capability scripts",
      promptGuidelines: [
        "Use upbge_control only for UPBGE editor operations represented by its allowed operation list.",
        "Call mutating upbge_control operations sequentially; do not run mutations in parallel.",
        "Derive operation selection, ordering, and verification requirements from the applicable capability instructions.",
      ],
      parameters,

      async execute(_toolCallId, params, signal) {
        signal?.throwIfAborted();
        const input: UpbgeControlInput =
          params.object_name === undefined
            ? { operation: params.operation }
            : { operation: params.operation, objectName: params.object_name };
        const result = await executeUpbgeOperation(
          input,
          signal === undefined ? {} : { signal },
        );
        signal?.throwIfAborted();
        return {
          content: [{ type: "text", text: serializeResult(result) }],
          details: {
            operation: params.operation,
            objectName: params.object_name,
          },
        };
      },
    }),
  );
}
