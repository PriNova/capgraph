---
name: vehicle-create
description: Creates one small controllable UPBGE vehicle with persistent editor state. Use for the frozen V1 vehicle task.
metadata:
  capgraph-requires: "chassis-create vehicle-controls vehicle-collision third-person-camera"
  capgraph-verify-with: "vehicle-verify"
  capgraph-recover-with: "vehicle-collision-repair"
---

# Create Vehicle

## Purpose
Create one persistent, keyboard-controllable vehicle in the active UPBGE scene.

## Inputs and output
Use chassis name `CapgraphVehicle`, camera name `CapgraphVehicleCamera`, active scene, and collection `CapgraphVehicleCollection`. Return the stable chassis identity and final verification result.

## Execution semantics
Use persistent editor-time UPBGE state. Apply the exact frozen fixture values supplied by applicable capabilities. Preserve valid state when correcting a failure.

## Caveats
Do not use Blender rigid-body world settings or runtime-only objects. Do not treat selection state or an agent success claim as completion.

## Completion
Complete only when the actual scene contains the requested controllable vehicle and a full structured verification passes.
