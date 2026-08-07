import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { registerSkillGraph } from "./skill-graph.ts";

export default function registerBatchSkillGraph(pi: ExtensionAPI): void {
  registerSkillGraph(pi, "batch");
}
