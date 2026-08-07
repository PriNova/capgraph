import { isAbsolute, relative, resolve, sep } from "node:path";

import { isToolCallEventType, type ExtensionAPI } from "@earendil-works/pi-coding-agent";

const FLAT_SKILLS_DIRECTORY = resolve(import.meta.dirname, "..", "benchmarks", ".generated-v1-flat-skills");

export function isAllowedV1FlatRead(path: string): boolean {
  const absolute = resolve(path.replace(/^@/, ""));
  const fromRoot = relative(FLAT_SKILLS_DIRECTORY, absolute);
  if (fromRoot === "" || fromRoot === ".." || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot)) return false;
  const parts = fromRoot.split(sep);
  return parts.length === 2 && parts[1] === "SKILL.md";
}

export default function registerV1FlatReadGate(pi: ExtensionAPI): void {
  pi.on("tool_call", (event) => {
    if (!isToolCallEventType("read", event) || isAllowedV1FlatRead(event.input.path)) return undefined;
    return {
      block: true,
      reason: "V1 Flat read access is limited to discovered generated SKILL.md fixtures.",
    };
  });
}
