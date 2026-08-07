---
name: vehicle-collision-repair
description: Repairs an incorrect collision mask on an otherwise valid V1 vehicle. Use after observed vehicle collision-mask verification failure.
---

# Repair Vehicle Collision Mask

After structured verification reports only an incorrect `collision_mask`, set `CapgraphVehicle` mask to the expected 16-bit value. Change only `obj.game.collision_mask`. Do not recreate the object, collision bounds, controls, or camera. Verify again after repair.
