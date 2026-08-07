---
name: object-create
description: Creates an object in the UPBGE editor. Use when a workflow requires a new scene object.
metadata:
  capgraph-id: "object.create"
---

# Create Object

## WHEN TO USE

Use this skill when the scene needs a new editor object.

## PREFER

Use `bpy` and confirm the target scene and collection before creation.

## AVOID

Avoid relying on selection state when a direct data API is available.

## EXECUTE

Create the object and link it to the intended collection.

## VERIFY

Confirm that the object exists and belongs to the intended scene collection.

## RECOVER

Remove only a partially created duplicate, then retry with explicit scene and collection references.
