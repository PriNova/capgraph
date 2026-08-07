---
name: physics-object-verify
description: Verifies a physics-enabled UPBGE object. Use after object, rigid-body, and collision configuration.
metadata:
  capgraph-id: "physics_object.verify"
---

# Verify Physics Object

## WHEN TO USE

Use this skill after creating or repairing a physics-enabled object.

## PREFER

Inspect editor state with `bpy` before running an interactive simulation.

## AVOID

Do not treat object existence alone as successful physics configuration.

## EXECUTE

Inspect the object, scene linkage, rigid-body settings, collision settings, and transform.

## VERIFY

Require all expected properties to exist and match the requested configuration.

## RECOVER

Report the failed capability so the agent can apply a local repair.
