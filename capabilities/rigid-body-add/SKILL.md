---
name: rigid-body-add
description: Adds rigid-body physics to an UPBGE editor object. Use when an object must participate in physics simulation.
metadata:
  capgraph-requires: "object-create"
---

# Add Rigid Body

## WHEN TO USE

Use this skill for an existing UPBGE editor object that needs linear and angular game-engine physics. Configure persistent editor state with `bpy.types.Object.game`.

This capability targets **UPBGE game physics**. It does not target Blender's animation rigid-body world.

## PREFER

Modify the exact object returned by object creation. UPBGE exposes its game settings as `obj.game`, a `bpy.types.GameObjectSettings` instance.

Required API call:

```python
game = obj.game
game.physics_type = "RIGID_BODY"
```

Set requested physical properties directly after the type:

```python
game.mass = mass                  # 0.01 to 1,000,000; default 1.0
game.damping = damping            # 0.0 to 1.0; default 0.04
game.rotation_damping = rotation_damping  # 0.0 to 1.0; default 0.1
game.friction = friction          # 0.0 or greater; default 0.5
game.elasticity = elasticity      # 0.0 or greater; default 0.0
```

Only set optional axis locks, velocity limits, sleeping, or continuous collision detection when requested.

## AVOID

- Do not call `bpy.ops.rigidbody.object_add()`. That operator configures Blender rigid-body simulation through `obj.rigid_body`; it is a different system from UPBGE's `obj.game.physics_type`.
- Do not use runtime `bge` APIs for persistent editor configuration.
- Do not require selection or active-object context; direct `obj.game` properties do not need it.
- Do not overwrite mass, damping, locks, or velocity limits that the task did not specify.
- Do not confuse `DYNAMIC` with `RIGID_BODY`: `DYNAMIC` has linear physics, while `RIGID_BODY` has linear and angular physics.

## IMPLEMENTATION SCRIPT

Load [`scripts/add_rigid_body.py`](scripts/add_rigid_body.py) and call `add_rigid_body(obj, ...)`. The function validates documented property ranges, configures `obj.game`, and returns the same object reference.

## EXECUTE

1. Require an existing object linked to the intended scene.
2. Confirm UPBGE support with `hasattr(obj, "game")`.
3. Require a geometry-bearing object suitable for the requested simulation; the first workflow requires `obj.type == "MESH"`.
4. Assign `obj.game.physics_type = "RIGID_BODY"`.
5. Assign each explicitly requested physical property through `obj.game`.
6. Pass the same object reference to collision configuration.

## VERIFY

At minimum:

```python
assert obj.game.physics_type == "RIGID_BODY"
assert obj.game.mass > 0.0
```

Compare every requested property with its actual `obj.game` value. For floating-point values, use a small tolerance rather than exact equality. Confirm that no requested movement or rotation axis is accidentally locked.

## RECOVER

If `obj.game` is unavailable, stop: the process is not exposing the required UPBGE editor API. If assignment fails, report the rejected property and value. Correct invalid values to the documented range only when the task permits a default; otherwise request a valid value. Do not fall back to Blender's separate `obj.rigid_body` system.

## API REFERENCES

- [UPBGE `Object.game`](https://upbge.org/docs/latest/api/bpy.types.Object.html)
- [UPBGE `GameObjectSettings`](https://upbge.org/docs/latest/api/bpy.types.GameObjectSettings.html)
- [UPBGE physics types](https://upbge.org/docs/latest/manual/manual/editors/properties/physics.html)
