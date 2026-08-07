import assert from "node:assert/strict";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import type { ExpandResult, InspectResult, LoadResult } from "../src/types/graph.ts";

import {
  buildGraph,
  expand,
  GraphValidationError,
  inspect,
  loadGraph,
  loadSkill,
  parseCapabilitySkill,
  validateRequiresAcyclic,
} from "../src/graph.ts";

interface SkillOptions {
  readonly name: string;
  readonly requires?: string;
  readonly verifyWith?: string;
  readonly recoverWith?: string;
}

function createSkill(options: SkillOptions): string {
  const metadata = [
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
    ...(metadata.length === 0 ? [] : ["metadata:", ...metadata]),
    "---",
    "",
    `# ${options.name}`,
    "",
  ].join("\n");
}

function parseSkill(options: SkillOptions, filePath?: string) {
  return parseCapabilitySkill(
    createSkill(options),
    options.name,
    filePath ?? `/skills/${options.name}/SKILL.md`,
  );
}

const readableSkillPath = fileURLToPath(
  new URL("../capabilities/object-create/SKILL.md", import.meta.url),
);

function parseExpandableSkill(options: SkillOptions) {
  return parseSkill(options, readableSkillPath);
}

test("loads the project graph keyed by canonical skill names", async () => {
  const capabilitiesPath = fileURLToPath(new URL("../capabilities/", import.meta.url));
  const graph = await loadGraph(capabilitiesPath);

  assert.equal(Object.keys(graph).length, 5);
  assert.deepEqual(graph["object-create"], {
    skill: "object-create",
    filePath: join(capabilitiesPath, "object-create", "SKILL.md"),
    requires: [],
    verify_with: [],
    recover_with: [],
  });
  assert.deepEqual(graph["physics-object-create"]?.requires, [
    "object-create",
    "rigid-body-add",
    "collision-add",
  ]);
});

test("honors an aborted graph load", async () => {
  const capabilitiesPath = fileURLToPath(new URL("../capabilities/", import.meta.url));
  const controller = new AbortController();
  const reason = new Error("Test cancellation.");
  controller.abort(reason);

  await assert.rejects(loadGraph(capabilitiesPath, { signal: controller.signal }), reason);
});

test("inspect returns exactly one node without prose or internal paths", () => {
  const graph = buildGraph([
    parseSkill({
      name: "workflow-create",
      requires: "object-create",
      verifyWith: "workflow-verify",
      recoverWith: "workflow-repair",
    }),
    parseSkill({ name: "object-create" }),
    parseSkill({ name: "workflow-verify" }),
    parseSkill({ name: "workflow-repair" }),
  ]);

  const result: InspectResult = inspect(graph, "workflow-create");

  assert.deepEqual(result, {
    skill: "workflow-create",
    requires: ["object-create"],
    verify_with: ["workflow-verify"],
    recover_with: ["workflow-repair"],
  });
});

test("rejects inspection and expansion of an unknown skill", async () => {
  const graph = buildGraph([]);
  const expectedError = new GraphValidationError('Unknown skill "missing-create".');

  assert.throws(() => inspect(graph, "missing-create"), expectedError);
  await assert.rejects(expand(graph, "missing-create"), expectedError);
  await assert.rejects(loadSkill(graph, "missing-create"), expectedError);
});

test("expand returns the physics workflow as structured skills and edges", async () => {
  const capabilitiesPath = fileURLToPath(new URL("../capabilities/", import.meta.url));
  const graph = await loadGraph(capabilitiesPath);
  const result: ExpandResult = await expand(graph, "physics-object-create");

  assert.equal(result.root, "physics-object-create");
  assert.deepEqual(
    result.skills.map(({ skill, depth }) => ({ skill, depth })),
    [
      { skill: "object-create", depth: 1 },
      { skill: "rigid-body-add", depth: 1 },
      { skill: "collision-add", depth: 1 },
      { skill: "physics-object-create", depth: 0 },
      { skill: "physics-object-verify", depth: 1 },
    ],
  );
  assert.deepEqual(result.edges, [
    { from: "physics-object-create", to: "object-create", relation: "requires" },
    { from: "physics-object-create", to: "rigid-body-add", relation: "requires" },
    { from: "physics-object-create", to: "collision-add", relation: "requires" },
    {
      from: "physics-object-create",
      to: "physics-object-verify",
      relation: "verify_with",
    },
    { from: "rigid-body-add", to: "object-create", relation: "requires" },
    { from: "collision-add", to: "object-create", relation: "requires" },
  ]);
  for (const skill of result.skills) {
    assert.deepEqual(Object.keys(skill), ["skill", "depth"]);
  }
});

test("load returns one skill body without frontmatter or paths", async () => {
  const capabilitiesPath = fileURLToPath(new URL("../capabilities/", import.meta.url));
  const graph = await loadGraph(capabilitiesPath);
  const result: LoadResult = await loadSkill(graph, "physics-object-create");

  assert.equal(result.skill, "physics-object-create");
  assert.match(result.content, /^# Create Physics Object/);
  assert.doesNotMatch(result.content, /^---/);
  assert.deepEqual(Object.keys(result), ["skill", "content"]);
});

test("load honors an aborted read", async () => {
  const capabilitiesPath = fileURLToPath(new URL("../capabilities/", import.meta.url));
  const graph = await loadGraph(capabilitiesPath);
  const controller = new AbortController();
  const reason = new Error("Test cancellation.");
  controller.abort(reason);

  await assert.rejects(loadSkill(graph, "physics-object-create", { signal: controller.signal }), reason);
});

test("expand orders recursive dependencies once before the root and terminal skills", async () => {
  const root = parseExpandableSkill({
    name: "workflow-create",
    requires: "component-first component-second",
    verifyWith: "workflow-verify component-verify",
    recoverWith: "workflow-repair",
  });
  const first = parseExpandableSkill({
    name: "component-first",
    requires: "component-shared",
    verifyWith: "component-verify",
  });
  const second = parseExpandableSkill({
    name: "component-second",
    requires: "component-shared",
  });
  const shared = parseExpandableSkill({ name: "component-shared" });
  const verify = parseExpandableSkill({ name: "workflow-verify" });
  const componentVerify = parseExpandableSkill({ name: "component-verify" });
  const repair = parseExpandableSkill({ name: "workflow-repair" });
  const graph = buildGraph([root, first, second, shared, verify, componentVerify, repair]);

  const result = await expand(graph, "workflow-create");

  assert.deepEqual(
    result.skills.map(({ skill, depth }) => ({ skill, depth })),
    [
      { skill: "component-shared", depth: 2 },
      { skill: "component-first", depth: 1 },
      { skill: "component-second", depth: 1 },
      { skill: "workflow-create", depth: 0 },
      { skill: "workflow-verify", depth: 1 },
      { skill: "component-verify", depth: 1 },
      { skill: "workflow-repair", depth: 1 },
    ],
  );
  assert.equal(result.skills.filter(({ skill }) => skill === "component-shared").length, 1);
  assert.deepEqual(
    result.edges.filter(({ to }) => to === "component-shared"),
    [
      { from: "component-first", to: "component-shared", relation: "requires" },
      { from: "component-second", to: "component-shared", relation: "requires" },
    ],
  );
});

test("expand does not traverse outgoing relations from terminal skills", async () => {
  const root = parseExpandableSkill({
    name: "workflow-create",
    verifyWith: "workflow-verify",
    recoverWith: "workflow-repair",
  });
  const verify = parseExpandableSkill({
    name: "workflow-verify",
    requires: "terminal-hidden",
  });
  const repair = parseExpandableSkill({
    name: "workflow-repair",
    verifyWith: "terminal-hidden",
  });
  const hidden = parseExpandableSkill({ name: "terminal-hidden" });
  const graph = buildGraph([root, verify, repair, hidden]);

  const result = await expand(graph, "workflow-create");

  assert.deepEqual(
    result.skills.map(({ skill }) => skill),
    ["workflow-create", "workflow-verify", "workflow-repair"],
  );
  assert.deepEqual(result.edges, [
    { from: "workflow-create", to: "workflow-verify", relation: "verify_with" },
    { from: "workflow-create", to: "workflow-repair", relation: "recover_with" },
  ]);
});

test("parses standard string relation metadata", () => {
  const node = parseSkill({
    name: "workflow-create",
    requires: "object-create collision-add",
    verifyWith: "workflow-verify",
  });

  assert.equal(node.skill, "workflow-create");
  assert.deepEqual(node.requires, ["object-create", "collision-add"]);
  assert.deepEqual(node.verify_with, ["workflow-verify"]);
  assert.deepEqual(node.recover_with, []);
});

test("allows skills without metadata", () => {
  const node = parseSkill({ name: "object-create" });

  assert.deepEqual(node.requires, []);
  assert.deepEqual(node.verify_with, []);
  assert.deepEqual(node.recover_with, []);
});

test("rejects non-string metadata values", () => {
  const contents = `---
name: workflow-create
description: Creates a workflow. Use when testing invalid metadata.
metadata:
  capgraph-requires:
    - "object-create"
---
`;

  assert.throws(
    () => parseCapabilitySkill(contents, "workflow-create", "/skills/workflow-create/SKILL.md"),
    new GraphValidationError(
      'Skill "/skills/workflow-create/SKILL.md" metadata value "capgraph-requires" must be a string.',
    ),
  );
});

test("rejects the removed capgraph-id metadata", () => {
  const contents = `---
name: workflow-create
description: Creates a workflow. Use when testing obsolete metadata.
metadata:
  capgraph-id: "workflow.create"
---
`;

  assert.throws(
    () => parseCapabilitySkill(contents, "workflow-create", "/skills/workflow-create/SKILL.md"),
    new GraphValidationError(
      'Skill "/skills/workflow-create/SKILL.md" contains unknown graph metadata "capgraph-id".',
    ),
  );
});

test("rejects invalid relation skill names", () => {
  const contents = createSkill({ name: "workflow-create", requires: "object.create" });

  assert.throws(
    () => parseCapabilitySkill(contents, "workflow-create", "/skills/workflow-create/SKILL.md"),
    new GraphValidationError(
      'Skill "/skills/workflow-create/SKILL.md" metadata "capgraph-requires" contains invalid skill name "object.create".',
    ),
  );
});

test("rejects custom top-level graph fields", () => {
  const contents = `---
name: workflow-create
description: Creates a workflow. Use when testing invalid frontmatter.
graph:
  requires: object-create
---
`;

  assert.throws(
    () => parseCapabilitySkill(contents, "workflow-create", "/skills/workflow-create/SKILL.md"),
    new GraphValidationError(
      'Skill "/skills/workflow-create/SKILL.md" contains unsupported frontmatter field "graph".',
    ),
  );
});

test("rejects references to unknown skills", () => {
  const node = parseSkill({ name: "workflow-create", requires: "missing-create" });

  assert.throws(
    () => buildGraph([node]),
    new GraphValidationError(
      'Skill "workflow-create" field "requires" references unknown skill "missing-create".',
    ),
  );
});

test("rejects duplicate skill names", () => {
  const first = parseSkill({ name: "workflow-create" });
  const second = parseSkill({ name: "workflow-create" }, "/other/workflow-create/SKILL.md");

  assert.throws(
    () => buildGraph([first, second]),
    new GraphValidationError('Duplicate skill name "workflow-create".'),
  );
});

test("rejects reachable requires cycles", () => {
  const create = parseSkill({ name: "workflow-create", requires: "workflow-prepare" });
  const prepare = parseSkill({ name: "workflow-prepare", requires: "workflow-create" });
  const graph = buildGraph([create, prepare]);

  assert.throws(
    () => validateRequiresAcyclic(graph, "workflow-create"),
    new GraphValidationError(
      "Requires cycle detected: workflow-create -> workflow-prepare -> workflow-create.",
    ),
  );
});

test("allows cycles through verification and recovery relations", () => {
  const create = parseSkill({ name: "workflow-create", verifyWith: "workflow-verify" });
  const verify = parseSkill({ name: "workflow-verify", recoverWith: "workflow-create" });
  const graph = buildGraph([create, verify]);

  assert.doesNotThrow(() => validateRequiresAcyclic(graph, "workflow-create"));
});

test("ignores requires cycles outside the requested root closure", () => {
  const root = parseSkill({ name: "workflow-create" });
  const first = parseSkill({ name: "unrelated-first", requires: "unrelated-second" });
  const second = parseSkill({ name: "unrelated-second", requires: "unrelated-first" });
  const graph = buildGraph([root, first, second]);

  assert.doesNotThrow(() => validateRequiresAcyclic(graph, "workflow-create"));
  assert.throws(
    () => validateRequiresAcyclic(graph, "unrelated-first"),
    new GraphValidationError(
      "Requires cycle detected: unrelated-first -> unrelated-second -> unrelated-first.",
    ),
  );
});
