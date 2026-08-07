"""Configure UPBGE rigid-body game physics on an editor object."""

from __future__ import annotations

import math

import bpy


def _number(name: str, value: float, minimum: float, maximum: float | None = None) -> float:
    result = float(value)
    if not math.isfinite(result) or result < minimum or (maximum is not None and result > maximum):
        limit = f"{minimum} to {maximum}" if maximum is not None else f"at least {minimum}"
        raise ValueError(f"{name} must be finite and in the range {limit}")
    return result


def add_rigid_body(
    obj: bpy.types.Object,
    *,
    mass: float = 1.0,
    damping: float | None = None,
    rotation_damping: float | None = None,
    friction: float | None = None,
    elasticity: float | None = None,
) -> bpy.types.Object:
    """Set UPBGE linear and angular physics without Blender rigid-body operators."""
    if obj is None or bpy.data.objects.get(obj.name) is not obj:
        raise ValueError("obj must be an existing Blender object")
    if not hasattr(obj, "game"):
        raise RuntimeError("Object.game is unavailable; run this script in UPBGE")
    if obj.type != "MESH" or obj.data is None:
        raise ValueError("rigid-body object must be a mesh with mesh data")

    values = {
        "mass": _number("mass", mass, 0.01, 1_000_000.0),
        "damping": None if damping is None else _number("damping", damping, 0.0, 1.0),
        "rotation_damping": None
        if rotation_damping is None
        else _number("rotation_damping", rotation_damping, 0.0, 1.0),
        "friction": None if friction is None else _number("friction", friction, 0.0, 100.0),
        "elasticity": None if elasticity is None else _number("elasticity", elasticity, 0.0),
    }

    game = obj.game
    game.physics_type = "RIGID_BODY"
    for property_name, value in values.items():
        if value is not None:
            setattr(game, property_name, value)
    return obj
