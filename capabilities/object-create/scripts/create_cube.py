"""Create a cube data-block and link it to an UPBGE scene collection."""

from __future__ import annotations

import math
from collections.abc import Sequence

import bpy


def _vector3(name: str, value: Sequence[float], *, nonzero: bool = False) -> tuple[float, float, float]:
    if len(value) != 3:
        raise ValueError(f"{name} must contain three values")
    result = tuple(float(component) for component in value)
    if not all(math.isfinite(component) for component in result):
        raise ValueError(f"{name} must contain only finite values")
    if nonzero and any(component == 0.0 for component in result):
        raise ValueError(f"{name} must not contain zero")
    return result


def _collection_belongs_to_scene(scene: bpy.types.Scene, target: bpy.types.Collection) -> bool:
    pending = [scene.collection]
    while pending:
        collection = pending.pop()
        if collection is target:
            return True
        pending.extend(collection.children)
    return False


def create_cube(
    name: str,
    *,
    scene: bpy.types.Scene | None = None,
    collection: bpy.types.Collection | None = None,
    size: float = 2.0,
    location: Sequence[float] = (0.0, 0.0, 0.0),
    rotation: Sequence[float] = (0.0, 0.0, 0.0),
    scale: Sequence[float] = (1.0, 1.0, 1.0),
) -> bpy.types.Object:
    """Create one cube without relying on selection, mode, or active-object state."""
    if not isinstance(name, str) or not name.strip():
        raise ValueError("name must be a non-empty string")
    if bpy.data.objects.get(name) is not None:
        raise ValueError(f"object already exists: {name}")

    cube_size = float(size)
    if not math.isfinite(cube_size) or cube_size <= 0.0:
        raise ValueError("size must be a finite value greater than zero")

    target_scene = scene or bpy.context.scene
    if target_scene is None:
        raise RuntimeError("no target scene is available")
    target_collection = collection or target_scene.collection
    if not _collection_belongs_to_scene(target_scene, target_collection):
        raise ValueError("target collection does not belong to the target scene")

    object_location = _vector3("location", location)
    object_rotation = _vector3("rotation", rotation)
    object_scale = _vector3("scale", scale, nonzero=True)
    half = cube_size / 2.0
    vertices = [
        (-half, -half, -half),
        (-half, -half, half),
        (-half, half, -half),
        (-half, half, half),
        (half, -half, -half),
        (half, -half, half),
        (half, half, -half),
        (half, half, half),
    ]
    faces = [
        (0, 2, 6, 4),
        (1, 5, 7, 3),
        (0, 4, 5, 1),
        (2, 3, 7, 6),
        (0, 1, 3, 2),
        (4, 6, 7, 5),
    ]

    mesh = bpy.data.meshes.new(f"{name}Mesh")
    obj = None
    try:
        mesh.from_pydata(vertices, [], faces)
        if mesh.validate():
            raise RuntimeError("generated cube mesh required validation repair")
        mesh.update()

        obj = bpy.data.objects.new(name, mesh)
        target_collection.objects.link(obj)
        obj.location = object_location
        obj.rotation_euler = object_rotation
        obj.scale = object_scale
        return obj
    except Exception:
        if obj is not None:
            bpy.data.objects.remove(obj, do_unlink=True)
        if mesh.users == 0:
            bpy.data.meshes.remove(mesh)
        raise
