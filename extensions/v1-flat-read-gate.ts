import { realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";

import { isToolCallEventType, type ExtensionAPI } from "@earendil-works/pi-coding-agent";

const FLAT_SKILLS_DIRECTORY = resolve(import.meta.dirname, "..", "benchmarks", ".generated-v1-flat-skills");

export type V1ReadCondition = "flat" | "graph";

export function isAllowedV1FlatRead(path: string): boolean {
  const absolute = resolve(path.replace(/^@/, ""));
  const fromRoot = relative(FLAT_SKILLS_DIRECTORY, absolute);
  if (fromRoot === "" || fromRoot === ".." || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot)) return false;
  const parts = fromRoot.split(sep);
  return parts.length === 2 && parts[1] === "SKILL.md";
}

export function isV1ReadAllowedForCondition(condition: V1ReadCondition, path: string): boolean {
  return condition === "flat" && isAllowedV1FlatRead(path);
}

async function isCanonicalFlatSkill(path: string): Promise<boolean> {
  if (!isAllowedV1FlatRead(path)) return false;
  try {
    const [root, requested] = await Promise.all([
      realpath(FLAT_SKILLS_DIRECTORY),
      realpath(resolve(path.replace(/^@/, ""))),
    ]);
    const fromRoot = relative(root, requested);
    const parts = fromRoot.split(sep);
    return !isAbsolute(fromRoot) && parts.length === 2 && parts[1] === "SKILL.md";
  } catch {
    return false;
  }
}

export function registerV1ReadSandbox(pi: ExtensionAPI, condition: V1ReadCondition): void {
  pi.on("tool_call", async (event) => {
    if (!isToolCallEventType("read", event)) return undefined;
    if (condition === "flat" && await isCanonicalFlatSkill(event.input.path)) return undefined;
    return {
      block: true,
      reason: condition === "flat"
        ? "V1 Flat read access is limited to discovered generated SKILL.md fixtures."
        : "V1 Graph skill prose must be loaded through skill_graph.",
    };
  });
}

export default function registerV1FlatReadGate(pi: ExtensionAPI): void {
  registerV1ReadSandbox(pi, "flat");
}
