"""Configure explicit collision group and mask bits on an UPBGE object."""

from collections.abc import Sequence

import bpy


def _bits(value: Sequence[bool], name: str) -> tuple[bool, ...]:
    if len(value) != 16 or any(type(bit) is not bool for bit in value):
        raise ValueError(f"{name} must contain exactly 16 boolean values")
    return tuple(value)


def configure_vehicle_collision_mask(
    obj: bpy.types.Object,
    *,
    collision_group: Sequence[bool],
    collision_mask: Sequence[bool],
) -> bpy.types.Object:
    obj.game.collision_group = _bits(collision_group, "collision_group")
    obj.game.collision_mask = _bits(collision_mask, "collision_mask")
    return obj
