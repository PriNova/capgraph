"""Deterministically verify the frozen V1 vehicle in UPBGE editor state."""

import math
import bpy

EXPECTED_GROUP = [True] + [False] * 15
EXPECTED_MASK = [True, True] + [False] * 14


def _plain(value):
    if value is None or isinstance(value, (bool, int, float, str)):
        return value
    try:
        return [_plain(item) for item in value]
    except TypeError:
        return repr(value)


def verify_vehicle(object_name: str = "CapgraphVehicle"):
    failures = []

    def check(capability, property_name, expected, actual, matches=None):
        okay = matches(actual, expected) if matches else actual == expected
        if not okay:
            failures.append({"capability": capability, "property": property_name, "expected": _plain(expected), "actual": _plain(actual)})

    scene = bpy.context.scene
    obj = bpy.data.objects.get(object_name)
    collection = bpy.data.collections.get("CapgraphVehicleCollection")
    if obj is None:
        check("mesh-object-create", "object", object_name, None)
        return {"ok": False, "failures": failures}

    check("mesh-object-create", "type", "MESH", obj.type)
    check("mesh-object-create", "mesh_name", "CapgraphVehicleMesh", obj.data.name if obj.data else None)
    check("mesh-object-create", "location", [0.0, 0.0, 1.0], list(obj.location), lambda a, e: all(math.isclose(float(x), y, abs_tol=1e-6) for x, y in zip(a, e)))
    check("mesh-object-create", "rotation", [0.0, 0.0, 0.0], list(obj.rotation_euler), lambda a, e: all(math.isclose(float(x), y, abs_tol=1e-6) for x, y in zip(a, e)))
    check("mesh-object-create", "scale", [2.0, 1.0, 0.5], list(obj.scale), lambda a, e: all(math.isclose(float(x), y, abs_tol=1e-6) for x, y in zip(a, e)))
    check("mesh-object-create", "scene_linkage", True, scene.objects.get(object_name) is obj)
    check("mesh-object-create", "collection_linkage", True, collection is not None and collection.objects.get(object_name) is obj)

    game = getattr(obj, "game", None)
    if game is None:
        check("rigid-body-add", "game", "UPBGE settings", None)
    else:
        check("rigid-body-add", "physics_type", "RIGID_BODY", game.physics_type)
        for prop, expected in (("mass", 800.0), ("damping", 0.2), ("rotation_damping", 0.4), ("friction", 0.8)):
            check("rigid-body-add", prop, expected, getattr(game, prop), lambda a, e: math.isclose(float(a), e, abs_tol=1e-6))
        check("vehicle-collision", "use_collision_bounds", True, game.use_collision_bounds)
        check("vehicle-collision", "collision_bounds_type", "BOX", game.collision_bounds_type)
        check("vehicle-collision", "collision_margin", 0.04, game.collision_margin, lambda a, e: math.isclose(float(a), e, abs_tol=1e-6))
        check("vehicle-collision", "use_ghost", False, game.use_ghost)
        check("vehicle-collision", "use_collision_compound", False, game.use_collision_compound)
        check("vehicle-collision", "collision_group", EXPECTED_GROUP, list(game.collision_group))
        check("vehicle-collision", "collision_mask", EXPECTED_MASK, list(game.collision_mask))

    for prop, expected in (("control_forward", "W"), ("control_reverse", "S"), ("control_left", "A"), ("control_right", "D"), ("controls_enabled", True)):
        check("vehicle-controls", prop, expected, obj.get(prop))

    camera = bpy.data.objects.get("CapgraphVehicleCamera")
    if camera is None:
        check("third-person-camera", "camera", "CapgraphVehicleCamera", None)
    else:
        check("third-person-camera", "type", "CAMERA", camera.type)
        check("third-person-camera", "collection_linkage", True, collection is not None and collection.objects.get(camera.name) is camera)
        check("third-person-camera", "scene_camera", camera.name, scene.camera.name if scene.camera else None)
        check("third-person-camera", "target_object", object_name, camera.get("target_object"))
        expected_location = [obj.location.x, obj.location.y - 8.0, obj.location.z + 4.0]
        check("third-person-camera", "location", expected_location, list(camera.location), lambda a, e: all(math.isclose(float(x), y, abs_tol=1e-6) for x, y in zip(a, e)))

    return {"ok": not failures, "failures": failures}
