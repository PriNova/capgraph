---
name: physics-object-verify
description: Verifies a physics-enabled UPBGE object. Use after object, rigid-body, and collision configuration.
---

# Verify Physics Object

## WHEN TO USE

Use this skill after creating or repairing a physics-enabled UPBGE editor object. Verify persistent `bpy` state before starting the game engine.

Required inputs are the exact object reference, target scene, target collection, and expected object, transform, physics, and collision values.

## PREFER

Collect all failures in one pass instead of stopping at the first failed assertion. Use direct RNA properties from `bpy.types.Object` and UPBGE's `bpy.types.GameObjectSettings`.

Core checks use these APIs:

```python
bpy.data.objects.get(obj.name)
target_collection.objects.get(obj.name)
target_scene.objects.get(obj.name)
obj.users_collection
obj.type
obj.data
obj.location
obj.rotation_euler
obj.scale
obj.game.physics_type
obj.game.mass
obj.game.use_collision_bounds
obj.game.collision_bounds_type
obj.game.use_ghost
```

## AVOID

- Do not treat object existence as proof of correct scene linkage or physics state.
- Do not inspect `obj.rigid_body`; this workflow uses UPBGE game physics through `obj.game`.
- Do not use selection or active-object state as the result.
- Do not compare floating-point vectors or scalar properties with strict equality.
- Do not start interactive simulation merely to discover editor-state configuration errors.

## IMPLEMENTATION SCRIPT

Load [`scripts/verify_physics_object.py`](scripts/verify_physics_object.py) and call `verify_physics_object(obj, ...)`. It returns a JSON-compatible object with `ok` and capability-local `failures` fields. Pass changed expectations through `expected_game_settings`.

## EXECUTE

1. Verify object identity:

```python
bpy.data.objects.get(obj.name) is obj
```

2. Verify linkage:

```python
target_collection.objects.get(obj.name) is obj
target_scene.objects.get(obj.name) is obj
```

3. Verify the requested object type and data. For the first workflow, require `obj.type == "MESH"`, non-null mesh data, vertices, and polygons.
4. Verify every transform component is finite, scale has no zero component, and actual values match the request within tolerance.
5. Verify rigid-body game settings:

```python
obj.game.physics_type == "RIGID_BODY"
obj.game.mass > 0.0
```

6. Verify collision settings:

```python
obj.game.use_collision_bounds is True
obj.game.collision_bounds_type == expected_collision_shape
obj.game.use_ghost is False
```

7. Compare every additional requested property, including damping, friction, elasticity, margin, groups, masks, locks, sleeping, and CCD.
8. Return a structured list of failures. Identify each failure as `object-create`, `rigid-body-add`, or `collision-add`.

## VERIFY

Verification succeeds only when the failure list is empty. For the first physics-cube workflow, expected minimum state is:

```text
MESH object linked to target scene and collection
finite requested transform with non-zero scale
physics_type = RIGID_BODY
mass > 0
use_collision_bounds = true
collision_bounds_type = BOX
use_ghost = false
```

## RECOVER

Map failures locally:

- Missing object, mesh, or linkage → `object-create`.
- Wrong physics type, mass, damping, locks, or velocity settings → `rigid-body-add`.
- Wrong bounds, shape, ghost mode, margin, group, or mask → `collision-add`.

After repair, run the complete verifier again. If editor state passes but runtime behavior fails, report that as a separate simulation-level failure; do not weaken editor-state checks.

## API REFERENCES

- [Blender `bpy.types.Object`](https://docs.blender.org/api/current/bpy.types.Object.html)
- [Blender mesh API](https://docs.blender.org/api/current/bpy.types.Mesh.html)
- [UPBGE `Object.game`](https://upbge.org/docs/latest/api/bpy.types.Object.html)
- [UPBGE `GameObjectSettings`](https://upbge.org/docs/latest/api/bpy.types.GameObjectSettings.html)
