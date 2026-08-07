---
name: physics-object-create
description: Creates a physics-enabled object in the UPBGE editor. Use when an object needs rigid-body simulation and collision.
metadata:
  capgraph-requires: "object-create rigid-body-add collision-add"
  capgraph-verify-with: "physics-object-verify"
---

# Create Physics Object

## WHEN TO USE

Use this workflow to create one persistent UPBGE editor object with rigid-body game physics and explicit collision bounds.

## PREFER

Use `bpy` for all editor-time changes. Keep one object reference through the complete workflow. Apply capabilities in this order:

```text
create object → configure rigid body → configure collision → verify
```

The first vertical slice creates a cube with these core calls:

```python
import bpy

bpy.ops.mesh.primitive_cube_add(
    size=2.0,
    enter_editmode=False,
    align="WORLD",
    location=(0.0, 0.0, 0.0),
    rotation=(0.0, 0.0, 0.0),
)
obj = bpy.context.object
obj.name = "PhysicsCube"

obj.game.physics_type = "RIGID_BODY"
obj.game.mass = 1.0
obj.game.use_collision_bounds = True
obj.game.collision_bounds_type = "BOX"
obj.game.use_ghost = False
```

Use the exact values from the task when name, transform, size, mass, or collision shape differ.

## AVOID

- Do not mix UPBGE game physics (`obj.game`) with Blender rigid-body world settings (`obj.rigid_body`).
- Do not use runtime `bge` APIs to create persistent editor configuration.
- Do not search for the object by display name between steps; Blender can alter duplicate names.
- Do not run verification after only object creation. All required capabilities must finish first.
- Do not start an interactive game simulation before editor-state verification passes.

## IMPLEMENTATION SCRIPTS

Execute these capability scripts in one UPBGE Python process so the same object reference passes through all steps:

1. [`../object-create/scripts/create_cube.py`](../object-create/scripts/create_cube.py): `create_cube(...)`
2. [`../rigid-body-add/scripts/add_rigid_body.py`](../rigid-body-add/scripts/add_rigid_body.py): `add_rigid_body(obj, ...)`
3. [`../collision-add/scripts/add_collision.py`](../collision-add/scripts/add_collision.py): `add_collision(obj, ...)`
4. [`../physics-object-verify/scripts/verify_physics_object.py`](../physics-object-verify/scripts/verify_physics_object.py): `verify_physics_object(obj, ...)`

The graph or execution harness owns composition. This skill does not duplicate those implementations.

## EXECUTE

1. Inspect the current scene, active collection, mode, and existing object names.
2. Run `object-create` and retain its returned `obj` reference.
3. Run `rigid-body-add` on `obj` with the requested physics properties.
4. Run `collision-add` on the same `obj` with the requested collision properties.
5. Run `physics-object-verify` with `obj`, target scene, target collection, and expected values.
6. Report the final Blender object name because Blender can resolve name collisions.

## VERIFY

Success requires the verifier to confirm all four state groups:

- object identity, mesh data, scene linkage, and collection linkage;
- requested transform and valid scale;
- `obj.game.physics_type == "RIGID_BODY"` and requested physical properties;
- explicit, non-ghost collision bounds with the requested shape.

For the first cube workflow, require collision shape `BOX` unless the task explicitly requests another shape.

## RECOVER

Use verifier output to repeat only the failed capability. Recreate the object only when creation or linkage is invalid. Preserve a valid object while repairing physics or collision properties. Never switch to Blender's separate rigid-body system as a fallback.

## API REFERENCES

- [Blender mesh primitive operators](https://docs.blender.org/api/current/bpy.ops.mesh.html)
- [UPBGE `Object.game`](https://upbge.org/docs/latest/api/bpy.types.Object.html)
- [UPBGE `GameObjectSettings`](https://upbge.org/docs/latest/api/bpy.types.GameObjectSettings.html)
