---
name: third-person-camera
description: Creates and targets an UPBGE third-person camera for an existing object. Use for an offset chase view.
metadata:
  capgraph-requires: "camera-create object-resolve"
---

# Configure Third-person Camera

Use camera `CapgraphVehicleCamera`. Place it at offset `(0, -8, 4)` from `CapgraphVehicle`, target that exact chassis, link it to `CapgraphVehicleCollection`, and make it the active scene camera.
