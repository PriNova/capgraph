import assert from "node:assert/strict";

import { buildV1FaultControlCode, buildV1ResetCode, executeV1UpbgeOperation } from "../src/v1-upbge-control.ts";
import { sendUpbgeCode } from "../src/upbge-control.ts";

const OBJECT = "CapgraphVehicle";
const EXECUTION_OPERATIONS = [
  "create_mesh",
  "set_game_physics",
  "set_collision_bounds",
  "set_collision_layers",
  "set_input_properties",
  "create_camera",
] as const;

interface Verification { readonly ok: boolean; readonly failures: readonly Record<string, unknown>[] }
function verification(value: unknown): Verification {
  assert.ok(typeof value === "object" && value !== null);
  const result = value as Partial<Verification>;
  assert.equal(typeof result.ok, "boolean");
  assert.ok(Array.isArray(result.failures));
  return result as Verification;
}

async function reset(): Promise<void> {
  const result = await sendUpbgeCode(buildV1ResetCode()) as { clean?: unknown; mesh_clean?: unknown };
  assert.equal(result.clean, true);
  assert.equal(result.mesh_clean, true);
}

async function executeFixture(): Promise<void> {
  for (const operation of EXECUTION_OPERATIONS) {
    await executeV1UpbgeOperation({ operation, objectName: OBJECT });
  }
}

async function inspectPreservedState(): Promise<unknown> {
  return sendUpbgeCode([
    "import bpy",
    'obj = bpy.data.objects.get("CapgraphVehicle")',
    'camera = bpy.data.objects.get("CapgraphVehicleCamera")',
    "result = {",
    '  "object": obj.name, "mesh": obj.data.name, "location": list(obj.location), "scale": list(obj.scale),',
    '  "physics_type": obj.game.physics_type, "mass": obj.game.mass, "collision_group": list(obj.game.collision_group),',
    '  "collision_bounds": obj.game.use_collision_bounds, "controls": [obj.get("control_forward"), obj.get("control_reverse"), obj.get("control_left"), obj.get("control_right"), obj.get("controls_enabled")],',
    '  "camera": camera.name, "camera_target": camera.get("target_object"), "camera_location": list(camera.location),',
    "}",
  ].join("\n"));
}

try {
  await reset();
  await sendUpbgeCode(buildV1FaultControlCode(false, true));
  await executeFixture();
  assert.deepEqual(verification(await executeV1UpbgeOperation({ operation: "verify_state", objectName: OBJECT, profile: "vehicle" })), { ok: true, failures: [] });

  await reset();
  await sendUpbgeCode(buildV1FaultControlCode(true, true));
  await executeFixture();
  const first = verification(await executeV1UpbgeOperation({ operation: "verify_state", objectName: OBJECT, profile: "vehicle" }));
  assert.equal(first.ok, false);
  assert.deepEqual(first.failures, [{
    capability: "vehicle-collision",
    property: "collision_mask",
    expected: [true, true, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
    actual: [true, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
  }]);
  const before = await inspectPreservedState();
  const repair = await executeV1UpbgeOperation({ operation: "set_collision_mask", objectName: OBJECT }) as { property?: unknown };
  assert.equal(repair.property, "collision_mask");
  assert.deepEqual(await inspectPreservedState(), before);
  assert.equal(verification(await executeV1UpbgeOperation({ operation: "verify_state", objectName: OBJECT, profile: "vehicle" })).ok, true);

  await executeV1UpbgeOperation({ operation: "set_collision_layers", objectName: OBJECT });
  assert.equal(verification(await executeV1UpbgeOperation({ operation: "verify_state", objectName: OBJECT, profile: "vehicle" })).ok, true);

  const fault = await sendUpbgeCode(buildV1FaultControlCode(false)) as { injected?: unknown };
  assert.equal(fault.injected, true);
  assert.equal(verification(await executeV1UpbgeOperation({ operation: "verify_state", objectName: OBJECT, profile: "vehicle" })).ok, true);
  console.log("V1 UPBGE fixture tests passed.");
} finally {
  await reset();
}
