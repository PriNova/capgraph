---
name: rigid-body-add
description: Adds UPBGE rigid-body game physics to an existing mesh object. Use for dynamically simulated game objects.
metadata:
  capgraph-requires: "object-resolve"
---

# Add Rigid Body

Resolve the existing chassis and set `obj.game.physics_type` to `RIGID_BODY`, mass to `800.0`, damping to `0.2`, rotation damping to `0.4`, and friction to `0.8`. Do not use Blender rigid-body world settings.
