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

## INPUTS AND OUTPUT

Required inputs are the object name, geometry, target scene and collection, transform, physical properties, and collision shape. Use task values when supplied. The default benchmark object is a cube with mass `1.0` and collision shape `BOX`.

The capability returns one persistent editor object. Keep its identity stable for the complete operation. Blender can alter a requested name when a duplicate exists, so report the final object name.

## EXECUTION SEMANTICS

Use `bpy` for persistent editor-time state. Use the capability mechanism to resolve composition; the CapGraph metadata is the source of truth when graph metadata is available. Execute resolved requirements in dependency-first order, then use the declared verifier. Do not duplicate composition in this skill body.

All changes must target the same object and the intended scene and collection. Use the exact requested values. Verification must inspect final editor state, not selection state or an interactive simulation.

## AVOID

- Do not mix UPBGE game physics (`obj.game`) with Blender rigid-body world settings (`obj.rigid_body`).
- Do not use runtime `bge` APIs to create persistent editor configuration.
- Do not search for the object by display name between steps; Blender can alter duplicate names.
- Do not accept partially configured state as successful completion.
- Do not start an interactive game simulation before editor-state verification passes.

## VERIFY

Success requires the verifier to confirm all four state groups:

- object identity, mesh data, scene linkage, and collection linkage;
- requested transform and valid scale;
- `obj.game.physics_type == "RIGID_BODY"` and requested physical properties;
- explicit, non-ghost collision bounds with the requested shape.

For the first cube workflow, require collision shape `BOX` unless the task explicitly requests another shape.

## COMPLETION AND FAILURE

Completion requires the declared verifier to report no failures for object identity, linkage, transform, physics, and collision state. A partially configured object is not success.

If verification fails, preserve valid state and use only recovery behavior supplied by the capability mechanism or the failing capability. Never switch to Blender's separate rigid-body system as a fallback.

## API REFERENCES

- [Blender mesh primitive operators](https://docs.blender.org/api/current/bpy.ops.mesh.html)
- [UPBGE `Object.game`](https://upbge.org/docs/latest/api/bpy.types.Object.html)
- [UPBGE `GameObjectSettings`](https://upbge.org/docs/latest/api/bpy.types.GameObjectSettings.html)
