---
name: vehicle-verify
description: Verifies the frozen controllable vehicle fixture in actual UPBGE editor state. Use for complete V1 vehicle verification.
---

# Verify Vehicle

Run the complete structured vehicle verifier against `CapgraphVehicle`. Success requires exact object, mesh, transform, rigid-body, collision group and mask, input map, camera target, scene, and collection state. Treat any returned failure as incomplete. Runtime failures include capability, property, expected, and actual values.
