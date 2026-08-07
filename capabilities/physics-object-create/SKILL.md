---
name: physics-object-create
description: Creates a physics-enabled object in the UPBGE editor. Use when an object needs rigid-body simulation and collision.
metadata:
  capgraph-id: "physics_object.create"
  capgraph-requires: "object.create rigid_body.add collision.add"
  capgraph-verify-with: "physics_object.verify"
---

# Create Physics Object

## WHEN TO USE

Use this skill to compose object creation, rigid-body configuration, and collision configuration in the UPBGE editor.

## PREFER

Use `bpy` for editor state. Inspect the active scene and object before mutation.

## AVOID

Do not use runtime `bge` APIs to configure persistent editor properties.

## EXECUTE

Create the object, add rigid-body settings, and configure collision in dependency order.

## VERIFY

Run the physics-object verifier after all required capabilities complete.

## RECOVER

Inspect the failed component and repeat only that capability.
