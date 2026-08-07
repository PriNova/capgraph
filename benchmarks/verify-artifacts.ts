import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const expected = {
  "v0-formal.jsonl": "55c5dd92082921f9cf0d911afef0579c16c283dc7d6ea2d11c9c8ebf5469921c",
  "v0.1-formal.jsonl": "b266d1babd451944417a1538d24c8ad4028412e2940d3dd943e29edefdafc881",
  "v1-formal.jsonl": "d42aae57e84f7f35af7bc34b43a605be0127815cdfddb145c3f3596749723318",
} as const;

const ABSOLUTE_MACHINE_PATH = /(?:^|[\s"'(])(?:[A-Za-z]:[\\/]|\\\\[^\\\s]+\\|\/(?:Users|home|tmp|var\/tmp|mnt|workspace|workspaces|root)\/)/m;

function assertNoAbsoluteMachinePath(value: unknown, artifact: string, line: number): void {
  if (typeof value === "string") {
    if (ABSOLUTE_MACHINE_PATH.test(value)) {
      throw new Error(`Canonical artifact ${artifact} contains an absolute machine path at line ${line}: ${value.slice(0, 160)}`);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) assertNoAbsoluteMachinePath(item, artifact, line);
    return;
  }
  if (typeof value === "object" && value !== null) {
    for (const item of Object.values(value)) assertNoAbsoluteMachinePath(item, artifact, line);
  }
}

const directory = resolve(import.meta.dirname, "artifacts");
for (const [name, expectedHash] of Object.entries(expected)) {
  const contents = await readFile(resolve(directory, name));
  const actualHash = createHash("sha256").update(contents).digest("hex");
  if (actualHash !== expectedHash) {
    throw new Error(`Canonical artifact ${name} has SHA-256 ${actualHash}; expected ${expectedHash}.`);
  }
  const lines = contents.toString("utf8").split(/\r?\n/).filter((line) => line.trim().length > 0);
  for (let index = 0; index < lines.length; index += 1) {
    try {
      const record: unknown = JSON.parse(lines[index]!);
      assertNoAbsoluteMachinePath(record, name, index + 1);
    } catch (error: unknown) {
      if (error instanceof SyntaxError) {
        throw new Error(`Canonical artifact ${name} has malformed JSON at line ${index + 1}: ${error.message}`);
      }
      throw error;
    }
  }
  console.log(`${name}: ${actualHash} (${lines.length} records)`);
}

const legacyV0Path = resolve(import.meta.dirname, "results", "v0-physics-object-pilot-2026-08-07T15-35-14-424Z.jsonl");
const [legacyV0, canonicalV0] = await Promise.all([
  readFile(legacyV0Path),
  readFile(resolve(directory, "v0-formal.jsonl")),
]);
if (!legacyV0.equals(canonicalV0)) {
  throw new Error("Legacy tracked V0 artifact must remain byte-identical to canonical v0-formal.jsonl.");
}
console.log("Legacy tracked V0 artifact matches sanitized canonical evidence.");
