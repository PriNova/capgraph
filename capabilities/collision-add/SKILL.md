---
name: collision-add
description: Adds collision settings to an UPBGE editor object. Use when an object must collide during simulation.
metadata:
  capgraph-id: "collision.add"
  capgraph-requires: "object.create"
---

# Add Collision

## WHEN TO USE

Use this skill for an existing object that needs a collision shape.

## PREFER

Choose the simplest collision shape that matches the object and required accuracy.

## AVOID

Avoid expensive mesh collision when a primitive shape is sufficient.

## EXECUTE

Use `bpy` to assign the collision shape and related editor properties.

## VERIFY

Confirm that collision is enabled and the selected shape is valid for the object.

## RECOVER

Select a supported fallback shape and verify the object transform before retrying.
