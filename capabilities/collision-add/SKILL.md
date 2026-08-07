---
name: collision-add
description: Adds collision settings to an UPBGE editor object. Use when an object must collide during simulation.
metadata:
  capgraph-requires: "object-create"
---

# Add Collision

## WHEN TO USE

Use this skill for an existing UPBGE editor object that needs an explicit game-engine collision shape. Configure persistent settings through `obj.game`.

## PREFER

Enable explicit bounds and assign the requested shape directly:

```python
game = obj.game
game.use_collision_bounds = True
game.collision_bounds_type = collision_shape
game.use_ghost = False
```

Supported documented shapes are:

```text
BOX SPHERE CYLINDER CONE CONVEX_HULL TRIANGLE_MESH CAPSULE
```

Choose the least expensive shape that gives the required behavior:

- `BOX`: boxes and cubes.
- `SPHERE`: round objects; `game.radius` affects sphere bounds.
- `CYLINDER`, `CONE`, or `CAPSULE`: matching shapes aligned to the object's local axes.
- `CONVEX_HULL`: irregular convex objects.
- `TRIANGLE_MESH`: concave or exact surface collision only when primitive or convex bounds are insufficient.

Set `game.collision_margin` only when the task specifies it or testing shows a stability problem. Its documented range is 0.0 to 1.0 and its default is 0.04.

## AVOID

- Do not use `obj.rigid_body.collision_shape`; that belongs to Blender's separate rigid-body simulation.
- Do not choose `TRIANGLE_MESH` by default; it is the most expensive option.
- Do not set `use_collision_compound` unless child objects must contribute to a compound shape.
- Do not enable `use_ghost`; ghost objects do not react to collisions.
- Do not overwrite collision groups or masks unless the task defines them.
- Do not ignore object origin, rotation, or scale. UPBGE collision bounds are centered on the origin and oriented in local space.

## IMPLEMENTATION SCRIPT

Load [`scripts/add_collision.py`](scripts/add_collision.py) and call `add_collision(obj, ...)`. The function reads the collision-shape enum from the running UPBGE RNA API, validates optional settings, and returns the same object reference.

## EXECUTE

1. Require an existing object with `obj.game`.
2. Require a physics type that participates in collision; reject `NO_COLLISION`.
3. Check that the requested shape is supported and suitable for the object's geometry.
4. Assign `obj.game.use_collision_bounds = True`.
5. Assign `obj.game.collision_bounds_type`.
6. Assign optional margin, compound, group, mask, radius, or CCD settings only when requested.
7. Keep `obj.game.use_ghost = False` for a solid physics object.

For the first physics-cube workflow:

```python
obj.game.use_collision_bounds = True
obj.game.collision_bounds_type = "BOX"
obj.game.use_ghost = False
```

## VERIFY

At minimum:

```python
assert obj.game.physics_type != "NO_COLLISION"
assert obj.game.use_collision_bounds is True
assert obj.game.collision_bounds_type == collision_shape
assert obj.game.use_ghost is False
```

Also verify the requested margin, compound mode, collision group, and collision mask. Require finite transform values and non-zero scale. For a mesh-derived shape, require valid, non-empty mesh geometry.

## RECOVER

If the shape enum is rejected, inspect `obj.game.bl_rna.properties["collision_bounds_type"].enum_items` in the running UPBGE version and choose only a task-compatible supported value. If collisions are unstable, inspect scale, origin, margin, groups, and masks before changing shape. Fall back from `TRIANGLE_MESH` to `CONVEX_HULL`, then to the closest primitive only when reduced accuracy is acceptable.

## API REFERENCES

- [UPBGE `GameObjectSettings`](https://upbge.org/docs/latest/api/bpy.types.GameObjectSettings.html)
- [UPBGE collision-bounds manual](https://upbge.org/docs/latest/manual/manual/editors/properties/physics.html#collision-bounds)
- [UPBGE `Object.game`](https://upbge.org/docs/latest/api/bpy.types.Object.html)
