---
name: object-create
description: Creates an object in the UPBGE editor. Use when a workflow requires a new scene object.
---

# Create Object

## WHEN TO USE

Use this skill when the current Blender/UPBGE scene needs a persistent editor object. Use `bpy`, not the runtime `bge` module.

Required inputs are an object name, object kind or data-block, target collection, and transform. Keep the returned object reference for later capabilities. Do not recover it from selection state.

## PREFER

Prefer Blender's direct data API when object data already exists or context must not affect the operation:

```python
obj = bpy.data.objects.new(name, object_data)
target_collection.objects.link(obj)
obj.location = location
obj.rotation_euler = rotation
obj.scale = scale
```

- Use `None` as `object_data` only for an Empty.
- For a mesh, create or supply a `bpy.types.Mesh`, for example with `bpy.data.meshes.new(name)` and `mesh.from_pydata(vertices, edges, faces)`.
- Call `mesh.validate()` when input geometry is not trusted, then call `mesh.update()`.
- Confirm that `target_collection` belongs to the intended scene before linking.

For one standard primitive, the matching operator is simpler. A cube uses:

```python
bpy.ops.mesh.primitive_cube_add(
    size=size,
    calc_uvs=True,
    enter_editmode=False,
    align="WORLD",
    location=location,
    rotation=rotation,
)
obj = bpy.context.object
obj.name = name
```

The primitive operator creates the mesh, creates and links the object, selects it, and makes it active. Use it only when its context is valid and the target collection is the active collection.

## AVOID

- Do not use `bpy.context.object` before an operator has succeeded.
- Do not depend on the previous selection or active object.
- Do not call `Collection.objects.link(obj)` twice for the same collection.
- Do not assume Blender accepted the requested name unchanged; duplicate names can receive a numeric suffix.
- Do not leave a mesh object with empty or invalid geometry when physics needs a collision volume.

## IMPLEMENTATION SCRIPT

Load [`scripts/create_cube.py`](scripts/create_cube.py) and call `create_cube(...)` for the V0 cube workflow. The function uses `bpy.data.meshes.new`, `Mesh.from_pydata`, `bpy.data.objects.new`, and `Collection.objects.link` without relying on editor selection. It returns the created `bpy.types.Object`.

## EXECUTE

1. Resolve the intended scene and collection explicitly.
2. Reject or deliberately reuse an existing object according to the task. Do not silently create a duplicate.
3. Create the data-block and object with the direct API, or call the primitive operator for a requested standard primitive.
4. Link a direct-created object with `target_collection.objects.link(obj)`.
5. Set `obj.location`, `obj.rotation_euler`, and `obj.scale` from the request.
6. Return or retain `obj`; dependent skills must modify this exact object.

## VERIFY

Require all applicable checks:

```python
assert bpy.data.objects.get(obj.name) is obj
assert target_collection.objects.get(obj.name) is obj
assert target_scene.objects.get(obj.name) is obj
assert all(abs(value) > 0.0 for value in obj.scale)
```

For a mesh object, also require `obj.type == "MESH"`, `obj.data is not None`, and enough valid geometry for the requested shape. Compare the actual transform with the requested transform.

## RECOVER

If an operator used the wrong context, switch to Object Mode, set the intended collection active, and retry once. Prefer the direct data API when operator context remains unreliable. Remove only a partial object or orphan data-block created by the failed attempt; never remove a pre-existing object with the same requested name.

## API REFERENCES

- [Blender `bpy.types.Object` and basic object operations](https://docs.blender.org/api/current/bpy.types.Object.html)
- [Blender `BlendDataObjects.new`](https://docs.blender.org/api/current/bpy.types.BlendDataObjects.html)
- [Blender `CollectionObjects.link`](https://docs.blender.org/api/current/bpy.types.CollectionObjects.html)
- [Blender mesh API](https://docs.blender.org/api/current/bpy.types.Mesh.html)
- [Blender mesh primitive operators](https://docs.blender.org/api/current/bpy.ops.mesh.html)
