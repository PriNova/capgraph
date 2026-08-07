"""Configure frozen V1 collision bits and apply the controlled fault once."""

import bpy

EXPECTED_GROUP = (True,) + (False,) * 15
EXPECTED_MASK = (True, True) + (False,) * 14
FAULT_MASK = (True, False) + (False,) * 14


def configure_vehicle_collision_mask(obj: bpy.types.Object) -> bpy.types.Object:
    scene = bpy.context.scene
    obj.game.collision_group = EXPECTED_GROUP
    obj.game.collision_mask = EXPECTED_MASK
    if bool(scene.get("capgraph_v1_fault_enabled", False)) and not bool(scene.get("capgraph_v1_fault_injected", False)):
        obj.game.collision_mask = FAULT_MASK
        scene["capgraph_v1_fault_injected"] = True
    return obj
