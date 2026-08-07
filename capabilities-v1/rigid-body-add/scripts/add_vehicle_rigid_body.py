"""Add frozen UPBGE rigid-body settings to the V1 chassis."""

import bpy


def add_vehicle_rigid_body(obj: bpy.types.Object) -> bpy.types.Object:
    if obj is None or obj.type != "MESH" or not hasattr(obj, "game"):
        raise ValueError("an existing UPBGE mesh object is required")
    obj.game.physics_type = "RIGID_BODY"
    obj.game.mass = 800.0
    obj.game.damping = 0.2
    obj.game.rotation_damping = 0.4
    obj.game.friction = 0.8
    return obj
