---
name: chassis-create
description: Creates the physical chassis portion of an UPBGE vehicle. Use when a vehicle needs persistent mesh and physics state.
metadata:
  capgraph-requires: "mesh-object-create rigid-body-add"
---

# Create Chassis

Create chassis `CapgraphVehicle` in `CapgraphVehicleCollection`. Use mesh `CapgraphVehicleMesh`, location `(0, 0, 1)`, rotation `(0, 0, 0)`, and scale `(2, 1, 0.5)`. Keep one stable object identity while physical properties are added.
