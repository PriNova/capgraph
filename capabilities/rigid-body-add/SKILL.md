---
name: rigid-body-add
description: Adds rigid-body physics to an UPBGE editor object. Use when an object must participate in physics simulation.
metadata:
  capgraph-requires: "object-create"
---

# Add Rigid Body

## WHEN TO USE

Use this skill for an existing editor object that must participate in physics simulation.

## PREFER

Use `bpy` and inspect the object type before changing physics settings.

## AVOID

Do not add duplicate rigid-body configuration.

## EXECUTE

Make the object active and apply the required rigid-body type and properties.

## VERIFY

Confirm that rigid-body settings exist and match the requested behavior.

## RECOVER

Restore valid active-object context, then apply the settings again.
