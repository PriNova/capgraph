import { StringEnum } from "@earendil-works/pi-ai";
import { defineTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

import { executeV1UpbgeOperation, V1_UPBGE_OPERATIONS, V1_VERIFICATION_PROFILES, type V1UpbgeControlInput } from "../src/v1-upbge-control.ts";

export const V1_UPBGE_TOOL_DESCRIPTION = "Run one allowed primitive operation through the UPBGE editor bridge. The interface accepts fixed wrappers only; it never executes model-authored Python.";
export const V1_UPBGE_PROMPT_SNIPPET = "Apply approved primitive operations to persistent UPBGE editor state";
export const V1_UPBGE_PROMPT_GUIDELINES = [
  "Use this tool only for its listed UPBGE editor operations.",
  "Run mutations sequentially and preserve existing valid state.",
  "Derive operation selection and completion requirements from capability instructions and observed results.",
] as const;

export const V1_UPBGE_PARAMETER_DESCRIPTIONS = {
  operation: "Primitive editor operation.",
  objectName: "Required exact subject object name. Status inspects this name without requiring the object to exist. For create_camera, supply the existing target object; the operation creates its configured camera.",
  profile: "State profile to inspect. Required only for verify_state.",
  collisionGroup: "Sixteen explicit boolean collision-group bits. Required only for set_collision_layers.",
  collisionMask: "Sixteen explicit boolean collision-mask bits. Required for set_collision_layers and set_collision_mask.",
} as const;

const parameters = Type.Object({
  operation: StringEnum(V1_UPBGE_OPERATIONS, { description: V1_UPBGE_PARAMETER_DESCRIPTIONS.operation }),
  object_name: Type.String({ description: V1_UPBGE_PARAMETER_DESCRIPTIONS.objectName, pattern: "^[A-Za-z][A-Za-z0-9_-]{0,63}$" }),
  profile: Type.Optional(StringEnum(V1_VERIFICATION_PROFILES, { description: V1_UPBGE_PARAMETER_DESCRIPTIONS.profile })),
  collision_group: Type.Optional(Type.Array(Type.Boolean(), { description: V1_UPBGE_PARAMETER_DESCRIPTIONS.collisionGroup, minItems: 16, maxItems: 16 })),
  collision_mask: Type.Optional(Type.Array(Type.Boolean(), { description: V1_UPBGE_PARAMETER_DESCRIPTIONS.collisionMask, minItems: 16, maxItems: 16 })),
}, { additionalProperties: false });

export default function registerV1UpbgeControl(pi: ExtensionAPI): void {
  pi.registerTool(defineTool({
    name: "upbge_control",
    label: "UPBGE Control",
    description: V1_UPBGE_TOOL_DESCRIPTION,
    promptSnippet: V1_UPBGE_PROMPT_SNIPPET,
    promptGuidelines: [...V1_UPBGE_PROMPT_GUIDELINES],
    parameters,
    async execute(_id, params, signal) {
      const input: V1UpbgeControlInput = {
        operation: params.operation,
        objectName: params.object_name,
        ...(params.profile === undefined ? {} : { profile: params.profile }),
        ...(params.collision_group === undefined ? {} : { collisionGroup: params.collision_group }),
        ...(params.collision_mask === undefined ? {} : { collisionMask: params.collision_mask }),
      };
      const result = await executeV1UpbgeOperation(input, signal === undefined ? {} : { signal });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }], details: input };
    },
  }));
}
