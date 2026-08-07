import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateLoadingPolicyProtocol,
  graphLoadingPolicy,
  LOADING_POLICY_BENCHMARK_SCHEDULE,
} from "../src/loading-policy-benchmark.ts";

const expand = {
  name: "skill_graph",
  args: { operation: "expand", skill: "physics-object-create" },
  isError: false,
} as const;
const mutate = {
  name: "upbge_control",
  args: { operation: "create_cube" },
  isError: false,
} as const;

test("uses all six condition orders with balanced positions", () => {
  assert.equal(LOADING_POLICY_BENCHMARK_SCHEDULE.length, 18);
  assert.equal(
    new Set(LOADING_POLICY_BENCHMARK_SCHEDULE.map(({ sequence }) => sequence)).size,
    18,
  );

  for (const condition of ["flat", "graph_progressive", "graph_batch"] as const) {
    const slots = LOADING_POLICY_BENCHMARK_SCHEDULE.filter(
      (slot) => slot.condition === condition,
    );
    assert.equal(slots.length, 6);
    assert.deepEqual(
      [1, 2, 3].map(
        (position) => slots.filter((slot) => slot.position === position).length,
      ),
      [2, 2, 2],
    );
  }

  const orders = new Set(
    [1, 2, 3, 4, 5, 6].map((block) =>
      LOADING_POLICY_BENCHMARK_SCHEDULE.filter((slot) => slot.block === block)
        .map((slot) => slot.condition)
        .join(","),
    ),
  );
  assert.equal(orders.size, 6);
});

test("maps each condition to its recorded loading policy", () => {
  assert.equal(graphLoadingPolicy("flat"), "none");
  assert.equal(graphLoadingPolicy("graph_progressive"), "progressive");
  assert.equal(graphLoadingPolicy("graph_batch"), "batch");
});

test("enforces progressive graph expansion and individual root loading", () => {
  const rootLoad = {
    name: "skill_graph",
    args: { operation: "load", skill: "physics-object-create" },
    isError: false,
  } as const;

  assert.deepEqual(
    evaluateLoadingPolicyProtocol("graph_progressive", [expand, rootLoad, mutate]),
    { conformant: true, reason: null },
  );
  assert.equal(
    evaluateLoadingPolicyProtocol("graph_progressive", [
      expand,
      {
        name: "skill_graph",
        args: { operation: "load_many", skill: "physics-object-create" },
        isError: false,
      },
    ]).conformant,
    false,
  );
  assert.equal(
    evaluateLoadingPolicyProtocol("graph_progressive", [mutate, expand, rootLoad]).conformant,
    false,
  );
});

test("enforces one batch graph load after expansion and before mutation", () => {
  const batchLoad = {
    name: "skill_graph",
    args: { operation: "load_many", skill: "physics-object-create" },
    isError: false,
  } as const;

  assert.deepEqual(
    evaluateLoadingPolicyProtocol("graph_batch", [expand, batchLoad, mutate]),
    { conformant: true, reason: null },
  );
  assert.equal(
    evaluateLoadingPolicyProtocol("graph_batch", [expand, batchLoad, batchLoad]).conformant,
    false,
  );
  assert.equal(
    evaluateLoadingPolicyProtocol("graph_batch", [
      expand,
      {
        name: "skill_graph",
        args: { operation: "load", skill: "object-create" },
        isError: false,
      },
      batchLoad,
    ]).conformant,
    false,
  );
});
