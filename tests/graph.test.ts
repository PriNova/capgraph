import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { GraphValidationError, loadGraph, parseGraph } from "../src/graph.ts";

const validGraph = {
  "workflow.create": {
    skill: "workflow-create",
    requires: ["object.create"],
    verify_with: ["workflow.verify"],
  },
  "object.create": {
    skill: "object-create",
  },
  "workflow.verify": {
    skill: "workflow-verify",
  },
};

test("loads and normalizes the project graph", async () => {
  const graphPath = fileURLToPath(new URL("../graph.json", import.meta.url));
  const graph = await loadGraph(graphPath);

  assert.equal(Object.keys(graph).length, 5);
  assert.deepEqual(graph["object.create"], {
    skill: "object-create",
    requires: [],
    verify_with: [],
    recover_with: [],
  });
});

test("parses a valid graph", () => {
  const graph = parseGraph(validGraph);

  assert.deepEqual(graph["workflow.create"]?.requires, ["object.create"]);
  assert.deepEqual(graph["workflow.create"]?.recover_with, []);
});

test("rejects references to unknown nodes", () => {
  assert.throws(
    () =>
      parseGraph({
        "workflow.create": {
          skill: "workflow-create",
          requires: ["missing.create"],
        },
      }),
    new GraphValidationError(
      'Node "workflow.create" field "requires" references unknown node "missing.create".',
    ),
  );
});

test("rejects unknown node fields", () => {
  assert.throws(
    () =>
      parseGraph({
        "object.create": {
          skill: "object-create",
          enables: [],
        },
      }),
    new GraphValidationError('Node "object.create" contains unknown field "enables".'),
  );
});

test("rejects duplicate skill assignments", () => {
  assert.throws(
    () =>
      parseGraph({
        "object.create": { skill: "shared-skill" },
        "object.verify": { skill: "shared-skill" },
      }),
    new GraphValidationError(
      'Skill "shared-skill" is assigned to both "object.create" and "object.verify".',
    ),
  );
});

test("rejects cycles across graph relations", () => {
  assert.throws(
    () =>
      parseGraph({
        "workflow.create": {
          skill: "workflow-create",
          verify_with: ["workflow.verify"],
        },
        "workflow.verify": {
          skill: "workflow-verify",
          recover_with: ["workflow.create"],
        },
      }),
    new GraphValidationError(
      "Cycle detected: workflow.create -> workflow.verify -> workflow.create.",
    ),
  );
});
