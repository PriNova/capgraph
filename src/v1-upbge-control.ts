import { fileURLToPath } from "node:url";

import { sendUpbgeCode, type UpbgeConnectionOptions } from "./upbge-control.ts";

const ROOT = fileURLToPath(new URL("../capabilities-v1/", import.meta.url)).replaceAll("\\", "/");
const OBJECT_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;

export const V1_UPBGE_OPERATIONS = [
  "status",
  "create_mesh",
  "set_game_physics",
  "set_collision_bounds",
  "set_collision_layers",
  "set_input_properties",
  "create_camera",
  "verify_state",
  "set_collision_mask",
] as const;
export const V1_VERIFICATION_PROFILES = ["vehicle", "static_scene", "character", "vehicle_static"] as const;

export type V1UpbgeOperation = (typeof V1_UPBGE_OPERATIONS)[number];
export type V1VerificationProfile = (typeof V1_VERIFICATION_PROFILES)[number];

export interface V1UpbgeControlInput {
  readonly operation: V1UpbgeOperation;
  readonly objectName?: string;
  readonly profile?: V1VerificationProfile;
}

function requireObjectName(input: V1UpbgeControlInput): string {
  if (input.objectName === undefined || !OBJECT_NAME_PATTERN.test(input.objectName)) {
    throw new Error(`${input.operation} requires a valid object_name.`);
  }
  return input.objectName;
}

function quoted(value: string): string {
  return JSON.stringify(value);
}

export function buildV1UpbgeCode(input: V1UpbgeControlInput): string {
  if (input.operation === "status") {
    return 'import bpy\nresult = {"version": bpy.app.version_string, "scene": bpy.context.scene.name}';
  }
  const name = requireObjectName(input);
  const prefix = ["import bpy", "import runpy", `root = ${quoted(ROOT)}`];
  if (input.operation === "create_mesh") {
    return [...prefix, 'fn = runpy.run_path(root + "mesh-object-create/scripts/create_vehicle_mesh.py")["create_vehicle_mesh"]', `obj = fn(${quoted(name)})`, 'result = {"object": obj.name, "type": obj.type}'].join("\n");
  }
  const resolve = [`obj = bpy.data.objects.get(${quoted(name)})`, `if obj is None: raise ValueError("object does not exist: " + ${quoted(name)})`];
  const scripts: Partial<Record<V1UpbgeOperation, readonly [string, string]>> = {
    set_game_physics: ["rigid-body-add/scripts/add_vehicle_rigid_body.py", "add_vehicle_rigid_body"],
    set_collision_bounds: ["collision-add/scripts/add_vehicle_collision.py", "add_vehicle_collision"],
    set_collision_layers: ["collision-mask-configure/scripts/configure_vehicle_collision_mask.py", "configure_vehicle_collision_mask"],
    set_input_properties: ["input-map-create/scripts/create_vehicle_input_map.py", "create_vehicle_input_map"],
    create_camera: ["camera-create/scripts/create_vehicle_camera.py", "create_vehicle_camera"],
  };
  const script = scripts[input.operation];
  if (script !== undefined) {
    return [...prefix, ...resolve, `fn = runpy.run_path(root + ${quoted(script[0])})[${quoted(script[1])}]`, "changed = fn(obj)", 'result = {"object": changed.name, "operation": ' + quoted(input.operation) + "}"].join("\n");
  }
  if (input.operation === "set_collision_mask") {
    return [...prefix, ...resolve, 'fn = runpy.run_path(root + "vehicle-collision-repair/scripts/repair_vehicle_collision_mask.py")["repair_vehicle_collision_mask"]', "result = fn(obj)"].join("\n");
  }
  if (input.profile === undefined) throw new Error("verify_state requires profile.");
  if (input.profile !== "vehicle") {
    return `result = {"ok": false, "failures": [{"capability": ${quoted(input.profile + "-verify")}, "property": "fixture", "expected": "configured fixture", "actual": "not present"}]}`;
  }
  return [...prefix, 'fn = runpy.run_path(root + "vehicle-verify/scripts/verify_vehicle.py")["verify_vehicle"]', `result = fn(${quoted(name)})`].join("\n");
}

export async function executeV1UpbgeOperation(input: V1UpbgeControlInput, options: UpbgeConnectionOptions = {}): Promise<unknown> {
  return sendUpbgeCode(buildV1UpbgeCode(input), options);
}

export function buildV1ResetCode(): string {
  return [
    "import bpy",
    'reserved_objects = ["CapgraphVehicle", "CapgraphVehicleCamera"]',
    "for name in reserved_objects:",
    "    obj = bpy.data.objects.get(name)",
    "    if obj is not None:",
    "        data = obj.data",
    "        object_type = obj.type",
    "        bpy.data.objects.remove(obj, do_unlink=True)",
    "        if data is not None and data.users == 0:",
    "            if object_type == 'MESH': bpy.data.meshes.remove(data)",
    "            elif object_type == 'CAMERA': bpy.data.cameras.remove(data)",
    'for mesh in list(bpy.data.meshes):',
    '    if mesh.users == 0 and (mesh.name == "CapgraphVehicleMesh" or mesh.name.startswith("CapgraphVehicleMesh.")): bpy.data.meshes.remove(mesh)',
    'for camera in list(bpy.data.cameras):',
    '    if camera.users == 0 and (camera.name == "CapgraphVehicleCameraData" or camera.name.startswith("CapgraphVehicleCameraData.")): bpy.data.cameras.remove(camera)',
    'collection = bpy.data.collections.get("CapgraphVehicleCollection")',
    "if collection is not None and len(collection.objects) == 0: bpy.data.collections.remove(collection)",
    "scene = bpy.context.scene",
    'scene["capgraph_v1_fault_enabled"] = False',
    'scene["capgraph_v1_fault_injected"] = False',
    'result = {"clean": all(bpy.data.objects.get(name) is None for name in reserved_objects), "mesh_clean": not any(mesh.name.startswith("CapgraphVehicleMesh") for mesh in bpy.data.meshes)}',
  ].join("\n");
}

export function buildV1FaultControlCode(enabled: boolean, resetInjected = false): string {
  return [
    "import bpy",
    "scene = bpy.context.scene",
    `scene["capgraph_v1_fault_enabled"] = ${enabled ? "True" : "False"}`,
    ...(resetInjected ? ['scene["capgraph_v1_fault_injected"] = False'] : []),
    'result = {"enabled": bool(scene.get("capgraph_v1_fault_enabled", False)), "injected": bool(scene.get("capgraph_v1_fault_injected", False))}',
  ].join("\n");
}
