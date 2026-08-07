import assert from "node:assert/strict";
import test from "node:test";

import {
  BENCHMARK_MODEL,
  BENCHMARK_SCHEDULE,
  BENCHMARK_SKILLS,
  BENCHMARK_THINKING_LEVEL,
  createFlatSkillContents,
  evaluateBenchmarkProtocol,
} from "../src/pilot-benchmark.ts";

test("defines five balanced flat and graph pilot pairs", () => {
  assert.equal(BENCHMARK_SCHEDULE.length, 10);
  assert.equal(BENCHMARK_SCHEDULE.filter((slot) => slot.condition === "flat").length, 5);
  assert.equal(BENCHMARK_SCHEDULE.filter((slot) => slot.condition === "graph").length, 5);
  assert.deepEqual(
    BENCHMARK_SCHEDULE.map((slot) => slot.pair),
    [1, 1, 2, 2, 3, 3, 4, 4, 5, 5],
  );
  assert.equal(new Set(BENCHMARK_SCHEDULE.map((slot) => slot.sequence)).size, 10);
  assert.equal(BENCHMARK_SKILLS.length, 5);
  assert.equal(BENCHMARK_MODEL, "openai-codex/gpt-5.6-luna");
  assert.equal(BENCHMARK_THINKING_LEVEL, "max");
});

test("requires graph expansion and root loading before mutation", () => {
  assert.deepEqual(evaluateBenchmarkProtocol("flat", []), { conformant: true, reason: null });
  assert.deepEqual(
    evaluateBenchmarkProtocol("graph", [
      {
        name: "skill_graph",
        args: { operation: "inspect", skill: "physics-object-create" },
        isError: false,
      },
    ]),
    {
      conformant: false,
      reason: "Graph run did not successfully expand physics-object-create.",
    },
  );
  assert.deepEqual(
    evaluateBenchmarkProtocol("graph", [
      {
        name: "skill_graph",
        args: { operation: "expand", skill: "physics-object-create" },
        isError: false,
      },
    ]),
    {
      conformant: false,
      reason: "Graph run did not successfully load physics-object-create after expansion.",
    },
  );
  assert.deepEqual(
    evaluateBenchmarkProtocol("graph", [
      {
        name: "skill_graph",
        args: { operation: "expand", skill: "physics-object-create" },
        isError: false,
      },
      {
        name: "skill_graph",
        args: { operation: "load", skill: "physics-object-create" },
        isError: false,
      },
      { name: "upbge_control", args: { operation: "create_cube" }, isError: false },
    ]),
    { conformant: true, reason: null },
  );
  assert.deepEqual(
    evaluateBenchmarkProtocol("graph", [
      { name: "upbge_control", args: { operation: "create_cube" }, isError: false },
      {
        name: "skill_graph",
        args: { operation: "expand", skill: "physics-object-create" },
        isError: false,
      },
      {
        name: "skill_graph",
        args: { operation: "load", skill: "physics-object-create" },
        isError: false,
      },
    ]),
    {
      conformant: false,
      reason: "Graph run expanded the root capability only after UPBGE mutation started.",
    },
  );
});

test("creates flat skill prose without graph metadata", () => {
  const source = `---
name: composite-skill
description: Uses dependency skills.
compatibility: Requires an editor.
metadata:
  capgraph-requires: "dependency-skill"
  capgraph-verify-with: "verify-skill"
---

# Composite Skill

Keep this prose exactly.
`;

  const flat = createFlatSkillContents(source);

  assert.match(flat, /^---\nname: composite-skill\n/);
  assert.match(flat, /description: Uses dependency skills\./);
  assert.match(flat, /compatibility: Requires an editor\./);
  assert.doesNotMatch(flat, /metadata|capgraph-/);
  assert.match(flat, /# Composite Skill\n\nKeep this prose exactly\.\n$/);
});
