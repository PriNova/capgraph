"""Verify persistent editor state for an UPBGE physics object."""

from __future__ import annotations

import math
from collections.abc import Mapping, Sequence
from typing import Any

import bpy


def _plain(value: Any) -> Any:
    if value is None or isinstance(value, (bool, int, float, str)):
        return value
    try:
        return [_plain(item) for item in value]
    except TypeError:
        return repr(value)


def _matches(actual: Any, expected: Any, tolerance: float) -> bool:
    if isinstance(expected, float) or isinstance(actual, float):
        try:
            return math.isclose(float(actual), float(expected), rel_tol=tolerance, abs_tol=tolerance)
        except (TypeError, ValueError):
            return False
    if isinstance(expected, Sequence) and not isinstance(expected, (str, bytes)):
        try:
            actual_values = list(actual)
        except TypeError:
            return False
        return len(actual_values) == len(expected) and all(
            _matches(actual_item, expected_item, tolerance)
            for actual_item, expected_item in zip(actual_values, expected, strict=True)
        )
    return actual == expected


def verify_physics_object(
    obj: bpy.types.Object,
    *,
    scene: bpy.types.Scene,
    collection: bpy.types.Collection,
    expected_location: Sequence[float] = (0.0, 0.0, 0.0),
    expected_rotation: Sequence[float] = (0.0, 0.0, 0.0),
    expected_scale: Sequence[float] = (1.0, 1.0, 1.0),
    expected_game_settings: Mapping[str, Any] | None = None,
    tolerance: float = 1e-6,
) -> dict[str, Any]:
    """Return JSON-compatible verification status and capability-local failures."""
    failures: list[dict[str, Any]] = []

    def fail(capability: str, property_name: str, expected: Any, actual: Any) -> None:
        failures.append(
            {
                "capability": capability,
                "property": property_name,
                "expected": _plain(expected),
                "actual": _plain(actual),
            }
        )

    if obj is None:
        fail("object-create", "object", "existing object", None)
        return {"ok": False, "failures": failures}

    if bpy.data.objects.get(obj.name) is not obj:
        fail("object-create", "bpy.data.objects", obj.name, "missing or different object")
    if collection.objects.get(obj.name) is not obj:
        fail("object-create", "collection", collection.name, list(collection.objects.keys()))
    if scene.objects.get(obj.name) is not obj:
        fail("object-create", "scene", scene.name, "object is not linked")
    if obj.type != "MESH":
        fail("object-create", "type", "MESH", obj.type)
    elif obj.data is None or len(obj.data.vertices) == 0 or len(obj.data.polygons) == 0:
        fail("object-create", "mesh", "non-empty mesh", None)

    transform_checks = {
        "location": (obj.location, expected_location),
        "rotation_euler": (obj.rotation_euler, expected_rotation),
        "scale": (obj.scale, expected_scale),
    }
    for property_name, (actual, expected) in transform_checks.items():
        if not all(math.isfinite(float(component)) for component in actual):
            fail("object-create", property_name, "finite values", actual)
        elif property_name == "scale" and any(float(component) == 0.0 for component in actual):
            fail("object-create", property_name, "non-zero values", actual)
        elif not _matches(actual, expected, tolerance):
            fail("object-create", property_name, expected, actual)

    if not hasattr(obj, "game"):
        fail("rigid-body-add", "Object.game", "UPBGE game settings", None)
        return {"ok": False, "failures": failures}

    settings: dict[str, Any] = {
        "physics_type": "RIGID_BODY",
        "mass": 1.0,
        "use_collision_bounds": True,
        "collision_bounds_type": "BOX",
        "use_ghost": False,
    }
    if expected_game_settings is not None:
        settings.update(expected_game_settings)

    collision_properties = {
        "use_collision_bounds",
        "collision_bounds_type",
        "use_ghost",
        "collision_margin",
        "use_collision_compound",
        "collision_group",
        "collision_mask",
    }
    for property_name, expected in settings.items():
        capability = "collision-add" if property_name in collision_properties else "rigid-body-add"
        if not hasattr(obj.game, property_name):
            fail(capability, property_name, expected, "property unavailable")
            continue
        actual = getattr(obj.game, property_name)
        if not _matches(actual, expected, tolerance):
            fail(capability, property_name, expected, actual)

    return {"ok": not failures, "failures": failures}
