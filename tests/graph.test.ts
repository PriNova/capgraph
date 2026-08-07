import assert from "node:assert/strict";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  buildGraph,
  GraphValidationError,
  loadGraph,
  parseCapabilitySkill,
} from "../src/graph.ts";

interface SkillOptions {
  readonly name: string;
  readonly id: string;
  readonly requires?: string;
  readonly verifyWith?: string;
  readonly recoverWith?: string;
}

function createSkill(options: SkillOptions): string {
  const metadata = [
    `  capgraph-id: "${options.id}"`,
    options.requires === undefined ? undefined : `  capgraph-requires: "${options.requires}"`,
    options.verifyWith === undefined
      ? undefined
      : `  capgraph-verify-with: "${options.verifyWith}"`,
    options.recoverWith === undefined
      ? undefined
      : `  capgraph-recover-with: "${options.recoverWith}"`,
  ].filter((line): line is string => line !== undefined);

  return [
    "---",
    `name: ${options.name}`,
    `description: Performs ${options.name}. Use when testing graph metadata.`,
    "metadata:",
    ...metadata,
    "---",
    "",
    `# ${options.name}`,
    "",
  ].join("\n");
}

function parseSkill(options: SkillOptions) {
  return parseCapabilitySkill(createSkill(options), options.name, `/skills/${options.name}/SKILL.md`);
}

test("loads and normalizes the project graph from capability skills", async () => {
  const capabilitiesPath = fileURLToPath(new URL("../capabilities/", import.meta.url));
  const graph = await loadGraph(capabilitiesPath);

  assert.equal(Object.keys(graph).length, 5);
  assert.deepEqual(graph["object.create"], {
    skill: "object-create",
    filePath: join(capabilitiesPath, "object-create", "SKILL.md"),
    requires: [],
    verify_with: [],
    recover_with: [],
  });
  assert.deepEqual(graph["physics_object.create"]?.requires, [
    "object.create",
    "rigid_body.add",
    "collision.add",
  ]);
});

test("parses standard string metadata", () => {
  const definition = parseSkill({
    name: "workflow-create",
    id: "workflow.create",
    requires: "object.create collision.add",
    verifyWith: "workflow.verify",
  });

  assert.equal(definition.id, "workflow.create");
  assert.deepEqual(definition.node.requires, ["object.create", "collision.add"]);
  assert.deepEqual(definition.node.verify_with, ["workflow.verify"]);
  assert.deepEqual(definition.node.recover_with, []);
});

test("rejects non-string metadata values", () => {
  const contents = `---
name: workflow-create
description: Creates a workflow. Use when testing invalid metadata.
metadata:
  capgraph-id: "workflow.create"
  capgraph-requires:
    - "object.create"
---
`;

  assert.throws(
    () => parseCapabilitySkill(contents, "workflow-create", "/skills/workflow-create/SKILL.md"),
    new GraphValidationError(
      'Skill "/skills/workflow-create/SKILL.md" metadata value "capgraph-requires" must be a string.',
    ),
  );
});

test("rejects custom top-level graph fields", () => {
  const contents = `---
name: workflow-create
description: Creates a workflow. Use when testing invalid frontmatter.
metadata:
  capgraph-id: "workflow.create"
graph:
  requires: object.create
---
`;

  assert.throws(
    () => parseCapabilitySkill(contents, "workflow-create", "/skills/workflow-create/SKILL.md"),
    new GraphValidationError(
      'Skill "/skills/workflow-create/SKILL.md" contains unsupported frontmatter field "graph".',
    ),
  );
});

test("rejects references to unknown capabilities", () => {
  const definition = parseSkill({
    name: "workflow-create",
    id: "workflow.create",
    requires: "missing.create",
  });

  assert.throws(
    () => buildGraph([definition]),
    new GraphValidationError(
      'Node "workflow.create" field "requires" references unknown node "missing.create".',
    ),
  );
});

test("rejects duplicate capability IDs", () => {
  const first = parseSkill({ name: "workflow-create", id: "workflow.create" });
  const second = parseSkill({ name: "workflow-copy", id: "workflow.create" });

  assert.throws(
    () => buildGraph([first, second]),
    new GraphValidationError('Duplicate capability ID "workflow.create".'),
  );
});

test("rejects cycles across graph relations", () => {
  const create = parseSkill({
    name: "workflow-create",
    id: "workflow.create",
    verifyWith: "workflow.verify",
  });
  const verify = parseSkill({
    name: "workflow-verify",
    id: "workflow.verify",
    recoverWith: "workflow.create",
  });

  assert.throws(
    () => buildGraph([create, verify]),
    new GraphValidationError(
      "Cycle detected: workflow.create -> workflow.verify -> workflow.create.",
    ),
  );
});
