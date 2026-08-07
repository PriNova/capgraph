"""Set only an explicit collision mask on an existing UPBGE object."""

from collections.abc import Sequence


def _bits(value: Sequence[bool]) -> tuple[bool, ...]:
    if len(value) != 16 or any(type(bit) is not bool for bit in value):
        raise ValueError("collision_mask must contain exactly 16 boolean values")
    return tuple(value)


def repair_vehicle_collision_mask(obj, *, collision_mask: Sequence[bool]):
    before = tuple(obj.game.collision_mask)
    obj.game.collision_mask = _bits(collision_mask)
    return {
        "object": obj.name,
        "property": "collision_mask",
        "before": list(before),
        "after": list(obj.game.collision_mask),
    }
