"""Repair only the frozen V1 vehicle collision mask."""

EXPECTED_MASK = (True, True) + (False,) * 14


def repair_vehicle_collision_mask(obj):
    before = tuple(obj.game.collision_mask)
    obj.game.collision_mask = EXPECTED_MASK
    return {"object": obj.name, "property": "collision_mask", "before": list(before), "after": list(obj.game.collision_mask)}
