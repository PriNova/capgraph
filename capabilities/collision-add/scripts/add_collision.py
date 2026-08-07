"""Configure explicit UPBGE collision bounds on an editor object."""

from __future__ import annotations

import math
from collections.abc import Sequence

import bpy


def _collision_bits(name: str, value: Sequence[bool]) -> tuple[bool, ...]:
    if len(value) != 16 or any(type(item) is not bool for item in value):
        raise ValueError(f"{name} must contain exactly 16 boolean values")
    return tuple(value)


def add_collision(
    obj: bpy.types.Object,
    *,
    collision_shape: str = "BOX",
    margin: float | None = None,
    compound: bool | None = None,
    collision_group: Sequence[bool] | None = None,
    collision_mask: Sequence[bool] | None = None,
) -> bpy.types.Object:
    """Enable solid game collision and set an explicit collision shape."""
    if obj is None or bpy.data.objects.get(obj.name) is not obj:
        raise ValueError("obj must be an existing Blender object")
    if not hasattr(obj, "game"):
        raise RuntimeError("Object.game is unavailable; run this script in UPBGE")
    if obj.type != "MESH" or obj.data is None:
        raise ValueError("collision object must be a mesh with mesh data")

    game = obj.game
    if game.physics_type == "NO_COLLISION":
        raise ValueError("object physics_type must participate in collision")

    enum_items = game.bl_rna.properties["collision_bounds_type"].enum_items
    valid_shapes = {item.identifier for item in enum_items}
    if collision_shape not in valid_shapes:
        expected = ", ".join(sorted(valid_shapes))
        raise ValueError(f"unsupported collision_shape {collision_shape!r}; expected one of: {expected}")

    collision_margin = None
    if margin is not None:
        collision_margin = float(margin)
        if not math.isfinite(collision_margin) or not 0.0 <= collision_margin <= 1.0:
            raise ValueError("margin must be finite and in the range 0.0 to 1.0")
    if compound is not None and type(compound) is not bool:
        raise ValueError("compound must be a boolean")

    groups = None if collision_group is None else _collision_bits("collision_group", collision_group)
    masks = None if collision_mask is None else _collision_bits("collision_mask", collision_mask)

    game.use_collision_bounds = True
    game.collision_bounds_type = collision_shape
    game.use_ghost = False
    if collision_margin is not None:
        game.collision_margin = collision_margin
    if compound is not None:
        game.use_collision_compound = compound
    if groups is not None:
        game.collision_group = groups
    if masks is not None:
        game.collision_mask = masks
    return obj
