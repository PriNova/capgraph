import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { expand, loadGraph, loadMany } from "../src/graph.ts";
import { buildV1FaultControlCode, buildV1ResetCode, buildV1UpbgeCode, V1_UPBGE_OPERATIONS } from "../src/v1-upbge-control.ts";
import {
  createV1FlatSkillContents, evaluateV1Protocol, isCompleteV1VerifierCall,
  V1_EXPECTED_ORDER, V1_NORMAL_LOADED_SKILLS, V1_SCHEDULE, V1_UNRELATED_SKILLS,
  v1IrrelevantLoadedSkills, v1SessionToolNames,
} from "../src/v1-composition-benchmark.ts";
import { V1_UPBGE_PARAMETER_DESCRIPTIONS, V1_UPBGE_PROMPT_GUIDELINES, V1_UPBGE_PROMPT_SNIPPET, V1_UPBGE_TOOL_DESCRIPTION } from "../extensions/v1-upbge-control.ts";
import { isAllowedV1FlatRead } from "../extensions/v1-flat-read-gate.ts";

const directory = fileURLToPath(new URL("../capabilities-v1/", import.meta.url));
function body(source: string): string { return source.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n+/, ""); }

test("V1 catalog and balanced schedule are frozen", async () => {
  const names = (await readdir(directory, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  assert.equal(names.length, 24);
  assert.equal(V1_SCHEDULE.length, 8);
  for (const condition of ["flat", "graph"] as const) {
    for (const variant of ["normal", "recovery"] as const) {
      assert.equal(V1_SCHEDULE.filter((slot) => slot.condition === condition && slot.variant === variant).length, 2);
    }
    assert.equal(V1_SCHEDULE.filter((slot) => slot.condition === condition && slot.position === 1).length, 2);
    assert.equal(V1_SCHEDULE.filter((slot) => slot.condition === condition && slot.position === 2).length, 2);
  }
});

test("V1 expansion freezes dependency-first order, shared deduplication, and terminal separation", async () => {
  const graph = await loadGraph(directory);
  const result = await expand(graph, "vehicle-create");
  assert.deepEqual(result.skills.map(({ skill }) => skill), V1_EXPECTED_ORDER);
  assert.equal(result.skills.filter(({ skill }) => skill === "object-resolve").length, 1);
  assert.equal(result.edges.filter(({ to, relation }) => to === "object-resolve" && relation === "requires").length, 3);
  const loaded = await loadMany(graph, "vehicle-create");
  assert.deepEqual([...loaded.execution, ...loaded.verification].map(({ skill }) => skill), V1_NORMAL_LOADED_SKILLS);
  assert.deepEqual(loaded.verification.map(({ skill }) => skill), ["vehicle-verify"]);
  assert.ok(![...loaded.execution, ...loaded.verification].some(({ skill }) => skill === "vehicle-collision-repair"));
  for (const unrelated of V1_UNRELATED_SKILLS) assert.ok(!result.skills.some(({ skill }) => skill === unrelated));
});

test("generated Flat fixtures remove only graph metadata and preserve Markdown bodies", async () => {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const source = await readFile(`${directory}/${entry.name}/SKILL.md`, "utf8");
    const flat = createV1FlatSkillContents(source);
    assert.doesNotMatch(flat, /capgraph-(?:requires|verify-with|recover-with)/);
    assert.equal(body(flat), body(source), entry.name);
  }
});

test("vehicle root prose does not duplicate graph relations", async () => {
  const source = await readFile(`${directory}/vehicle-create/SKILL.md`, "utf8");
  const prose = body(source);
  for (const related of ["chassis-create", "vehicle-controls", "vehicle-collision", "third-person-camera", "vehicle-verify", "vehicle-collision-repair", "object-resolve"]) {
    assert.ok(!prose.includes(related), `root prose leaks ${related}`);
  }
});

test("shared execution interface is primitive and contains no composition guidance", () => {
  assert.deepEqual(V1_UPBGE_OPERATIONS, ["status", "create_mesh", "set_game_physics", "set_collision_bounds", "set_collision_layers", "set_input_properties", "create_camera", "verify_state", "set_collision_mask"]);
  const guidance = [V1_UPBGE_TOOL_DESCRIPTION, V1_UPBGE_PROMPT_SNIPPET, ...V1_UPBGE_PROMPT_GUIDELINES, ...Object.values(V1_UPBGE_PARAMETER_DESCRIPTIONS)].join(" ").toLowerCase();
  for (const leak of ["vehicle-create", "requires", "verify_with", "recover_with", "object-resolve", "vehicle-collision-repair", "after collision", "dependency graph"]) assert.ok(!guidance.includes(leak), `tool guidance leaks ${leak}`);
  assert.doesNotMatch(guidance, /create.*physics.*collision.*controls.*camera.*verif/);
});

test("condition read access cannot expose benchmark implementation", () => {
  assert.deepEqual(v1SessionToolNames("flat"), ["read", "upbge_control"]);
  assert.deepEqual(v1SessionToolNames("graph"), ["skill_graph", "upbge_control"]);
  assert.ok(isAllowedV1FlatRead(`${directory}/../benchmarks/.generated-v1-flat-skills/vehicle-create/SKILL.md`));
  assert.ok(!isAllowedV1FlatRead(`${directory}/../benchmarks/v1-composition.ts`));
  assert.ok(!isAllowedV1FlatRead(`${directory}/vehicle-create/SKILL.md`));
  assert.ok(!isAllowedV1FlatRead(`${directory}/../package.json`));
  assert.deepEqual(v1SessionToolNames("flat").filter((name) => name === "upbge_control"), v1SessionToolNames("graph").filter((name) => name === "upbge_control"));
  assert.equal(evaluateV1Protocol("flat", "normal", [{ name: "read", args: { path: "package.json" }, isError: true }]).conformant, false);
  assert.equal(evaluateV1Protocol("graph", "normal", [{ name: "read", args: { path: "anything" }, isError: false }]).conformant, false);
});

test("classifies only successful complete vehicle verifier calls", () => {
  assert.equal(isCompleteV1VerifierCall({
    name: "upbge_control",
    args: { operation: "verify_state", profile: "vehicle" },
    isError: true,
  }), false);
  assert.equal(isCompleteV1VerifierCall({
    name: "upbge_control",
    args: { operation: "verify_state", object_name: "CapgraphVehicle", profile: "vehicle" },
    isError: false,
  }), true);
  assert.equal(isCompleteV1VerifierCall({
    name: "upbge_control",
    args: { operation: "verify_state", object_name: "CapgraphVehicle", profile: "static_scene" },
    isError: false,
  }), false);
});

test("classifies recovery prose by task variant", () => {
  const loaded = ["vehicle-create", "vehicle-verify", "vehicle-collision-repair", "light-create", "light-create"];
  assert.deepEqual(v1IrrelevantLoadedSkills("normal", loaded), ["vehicle-collision-repair", "light-create"]);
  assert.deepEqual(v1IrrelevantLoadedSkills("recovery", loaded), ["light-create"]);
});

test("fixed wrappers expose no model-authored code and verification does not inject faults", () => {
  const verify = buildV1UpbgeCode({ operation: "verify_state", objectName: "CapgraphVehicle", profile: "vehicle" });
  assert.match(verify, /verify_vehicle\.py/);
  assert.doesNotMatch(verify, /fault_enabled|fault_injected/);
  assert.match(buildV1FaultControlCode(true, true), /fault_injected.*False/);
  assert.doesNotMatch(buildV1FaultControlCode(false), /scene\["capgraph_v1_fault_injected"\]\s*=\s*False/);
  const reset = buildV1ResetCode();
  assert.match(reset, /object_type == 'MESH'/);
  assert.match(reset, /CapgraphVehicleMesh\./);
});

test("fault and recovery scripts enforce one-shot mask-only behavior", async () => {
  const inject = await readFile(`${directory}/collision-mask-configure/scripts/configure_vehicle_collision_mask.py`, "utf8");
  const repair = await readFile(`${directory}/vehicle-collision-repair/scripts/repair_vehicle_collision_mask.py`, "utf8");
  const verifier = await readFile(`${directory}/vehicle-verify/scripts/verify_vehicle.py`, "utf8");
  assert.match(inject, /not bool\(scene\.get\("capgraph_v1_fault_injected"/);
  assert.match(inject, /scene\["capgraph_v1_fault_injected"\] = True/);
  assert.equal((repair.match(/obj\.game\.[a-z_]+\s*=/g) ?? []).join(""), "obj.game.collision_mask =");
  for (const key of ["capability", "property", "expected", "actual"]) assert.match(verifier, new RegExp(`"${key}"`));
  assert.match(verifier, /"vehicle-collision", "collision_mask", EXPECTED_MASK/);
  assert.doesNotMatch(verifier, /capgraph_v1_fault/);
});
