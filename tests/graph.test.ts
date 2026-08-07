import assert from "node:assert/strict";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  buildGraph,
  expand,
  GraphValidationError,
  inspect,
  loadGraph,
  parseCapabilitySkill,
  validateRequiresAcyclic,
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

test("inspects one capability by ID", () => {
  const definition = parseSkill({ name: "object-create", id: "object.create" });
  const graph = buildGraph([definition]);

  assert.deepEqual(inspect(graph, "object.create"), definition);
});

test("rejects inspection and expansion of an unknown capability", () => {
  const graph = buildGraph([]);
  const expectedError = new GraphValidationError('Unknown capability "missing.create".');

  assert.throws(() => inspect(graph, "missing.create"), expectedError);
  assert.throws(() => expand(graph, "missing.create"), expectedError);
});

test("expands the project physics workflow in deterministic order", async () => {
  const capabilitiesPath = fileURLToPath(new URL("../capabilities/", import.meta.url));
  const graph = await loadGraph(capabilitiesPath);

  assert.deepEqual(
    expand(graph, "physics_object.create").map((definition) => definition.id),
    [
      "physics_object.create",
      "object.create",
      "rigid_body.add",
      "collision.add",
      "physics_object.verify",
    ],
  );
});

test("expands recursive requirements once and groups terminal relations last", () => {
  const root = parseSkill({
    name: "workflow-create",
    id: "workflow.create",
    requires: "component.first component.second",
    verifyWith: "workflow.verify component.verify",
    recoverWith: "workflow.repair",
  });
  const first = parseSkill({
    name: "component-first",
    id: "component.first",
    requires: "component.shared",
    verifyWith: "component.verify",
  });
  const second = parseSkill({
    name: "component-second",
    id: "component.second",
    requires: "component.shared",
  });
  const shared = parseSkill({ name: "component-shared", id: "component.shared" });
  const verify = parseSkill({ name: "workflow-verify", id: "workflow.verify" });
  const componentVerify = parseSkill({ name: "component-verify", id: "component.verify" });
  const repair = parseSkill({ name: "workflow-repair", id: "workflow.repair" });
  const graph = buildGraph([root, first, second, shared, verify, componentVerify, repair]);

  assert.deepEqual(
    expand(graph, "workflow.create").map((definition) => definition.id),
    [
      "workflow.create",
      "component.first",
      "component.shared",
      "component.second",
      "workflow.verify",
      "component.verify",
      "workflow.repair",
    ],
  );
});

test("does not traverse outgoing relations from verification or recovery nodes", () => {
  const root = parseSkill({
    name: "workflow-create",
    id: "workflow.create",
    verifyWith: "workflow.verify",
    recoverWith: "workflow.repair",
  });
  const verify = parseSkill({
    name: "workflow-verify",
    id: "workflow.verify",
    requires: "terminal.hidden",
  });
  const repair = parseSkill({
    name: "workflow-repair",
    id: "workflow.repair",
    verifyWith: "terminal.hidden",
  });
  const hidden = parseSkill({ name: "terminal-hidden", id: "terminal.hidden" });
  const graph = buildGraph([root, verify, repair, hidden]);

  assert.deepEqual(
    expand(graph, "workflow.create").map((definition) => definition.id),
    ["workflow.create", "workflow.verify", "workflow.repair"],
  );
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

test("rejects reachable requires cycles", () => {
  const create = parseSkill({
    name: "workflow-create",
    id: "workflow.create",
    requires: "workflow.prepare",
  });
  const prepare = parseSkill({
    name: "workflow-prepare",
    id: "workflow.prepare",
    requires: "workflow.create",
  });
  const graph = buildGraph([create, prepare]);

  assert.throws(
    () => validateRequiresAcyclic(graph, "workflow.create"),
    new GraphValidationError(
      "Requires cycle detected: workflow.create -> workflow.prepare -> workflow.create.",
    ),
  );
});

test("allows cycles through verification and recovery relations", () => {
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
  const graph = buildGraph([create, verify]);

  assert.doesNotThrow(() => validateRequiresAcyclic(graph, "workflow.create"));
});

test("ignores requires cycles outside the requested root closure", () => {
  const root = parseSkill({ name: "workflow-create", id: "workflow.create" });
  const first = parseSkill({
    name: "unrelated-first",
    id: "unrelated.first",
    requires: "unrelated.second",
  });
  const second = parseSkill({
    name: "unrelated-second",
    id: "unrelated.second",
    requires: "unrelated.first",
  });
  const graph = buildGraph([root, first, second]);

  assert.doesNotThrow(() => validateRequiresAcyclic(graph, "workflow.create"));
  assert.throws(
    () => validateRequiresAcyclic(graph, "unrelated.first"),
    new GraphValidationError(
      "Requires cycle detected: unrelated.first -> unrelated.second -> unrelated.first.",
    ),
  );
});
