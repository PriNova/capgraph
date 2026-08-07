import { fileURLToPath } from "node:url";

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { registerSkillGraph } from "./skill-graph.ts";

const V1_CAPABILITIES_DIRECTORY = fileURLToPath(new URL("../capabilities-v1/", import.meta.url));

export default function registerV1SkillGraphBatch(pi: ExtensionAPI): void {
  registerSkillGraph(pi, "batch", V1_CAPABILITIES_DIRECTORY);
}
