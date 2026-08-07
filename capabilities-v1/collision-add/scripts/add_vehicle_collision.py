"""Add frozen solid collision bounds to the V1 chassis."""

import bpy


def add_vehicle_collision(obj: bpy.types.Object) -> bpy.types.Object:
    if obj is None or not hasattr(obj, "game"):
        raise ValueError("an existing UPBGE object is required")
    obj.game.use_collision_bounds = True
    obj.game.collision_bounds_type = "BOX"
    obj.game.collision_margin = 0.04
    obj.game.use_ghost = False
    obj.game.use_collision_compound = False
    return obj
