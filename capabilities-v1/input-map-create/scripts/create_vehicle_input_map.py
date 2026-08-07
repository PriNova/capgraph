"""Create frozen V1 keyboard-control metadata."""

import bpy


def create_vehicle_input_map(obj: bpy.types.Object) -> bpy.types.Object:
    obj["control_forward"] = "W"
    obj["control_reverse"] = "S"
    obj["control_left"] = "A"
    obj["control_right"] = "D"
    obj["controls_enabled"] = True
    return obj
