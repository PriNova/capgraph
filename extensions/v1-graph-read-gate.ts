import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { registerV1ReadSandbox } from "./v1-flat-read-gate.ts";

export default function registerV1GraphReadGate(pi: ExtensionAPI): void {
  registerV1ReadSandbox(pi, "graph");
}
