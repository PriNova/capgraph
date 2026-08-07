"""Generate the frozen V1 capability catalog."""

from pathlib import Path

ROOT = Path(__file__).parents[1] / "capabilities-v1"

SKILLS = {
    "vehicle-create": (
        "Creates one small controllable UPBGE vehicle with persistent editor state. Use for the frozen V1 vehicle task.",
        {"capgraph-requires": "chassis-create vehicle-controls vehicle-collision third-person-camera", "capgraph-verify-with": "vehicle-verify", "capgraph-recover-with": "vehicle-collision-repair"},
        """# Create Vehicle

## Purpose
Create one persistent, keyboard-controllable vehicle in the active UPBGE scene.

## Inputs and output
Use chassis name `CapgraphVehicle`, camera name `CapgraphVehicleCamera`, active scene, and collection `CapgraphVehicleCollection`. Return the stable chassis identity and final verification result.

## Execution semantics
Use persistent editor-time UPBGE state. Apply the exact frozen fixture values supplied by applicable capabilities. Preserve valid state when correcting a failure.

## Caveats
Do not use Blender rigid-body world settings or runtime-only objects. Do not treat selection state or an agent success claim as completion.

## Completion
Complete only when the actual scene contains the requested controllable vehicle and a full structured verification passes.""",
    ),
    "chassis-create": ("Creates the physical chassis portion of an UPBGE vehicle. Use when a vehicle needs persistent mesh and physics state.", {"capgraph-requires": "mesh-object-create rigid-body-add"}, """# Create Chassis

Create chassis `CapgraphVehicle` in `CapgraphVehicleCollection`. Use mesh `CapgraphVehicleMesh`, location `(0, 0, 1)`, rotation `(0, 0, 0)`, and scale `(2, 1, 0.5)`. Keep one stable object identity while physical properties are added."""),
    "mesh-object-create": ("Creates a persistent mesh object in a specified UPBGE scene collection. Use for editor-time geometric objects.", {}, """# Create Mesh Object

Create one unit cube mesh object with the requested object and mesh names. Link it only to the requested collection, which must belong to the active scene. Set the exact requested transform and do not rely on selection state."""),
    "rigid-body-add": ("Adds UPBGE rigid-body game physics to an existing mesh object. Use for dynamically simulated game objects.", {"capgraph-requires": "object-resolve"}, """# Add Rigid Body

Resolve the existing chassis and set `obj.game.physics_type` to `RIGID_BODY`, mass to `800.0`, damping to `0.2`, rotation damping to `0.4`, and friction to `0.8`. Do not use Blender rigid-body world settings."""),
    "object-resolve": ("Resolves an existing persistent UPBGE object by exact name and validates scene linkage. Use before mutating referenced objects.", {}, """# Resolve Object

Resolve by exact data-block name. Require one existing object linked to the active scene. Reject missing, renamed, or unlinked objects; do not substitute the selected object."""),
    "vehicle-controls": ("Configures keyboard control metadata for an UPBGE vehicle. Use when a vehicle requires explicit player input bindings.", {"capgraph-requires": "keyboard-input input-map-create"}, """# Configure Vehicle Controls

Configure persistent vehicle control metadata on `CapgraphVehicle`. The final mapping must contain forward, reverse, left, and right actions with the frozen keys and must be enabled."""),
    "keyboard-input": ("Defines exact keyboard bindings for UPBGE control actions. Use when editor state needs deterministic key assignments.", {}, """# Define Keyboard Input

Use `W` for forward, `S` for reverse, `A` for left, and `D` for right. Store canonical key identifiers exactly; do not infer locale-specific alternatives."""),
    "input-map-create": ("Creates persistent action-to-key mapping metadata on an UPBGE object. Use for deterministic benchmark controls.", {}, """# Create Input Map

Store the input map as object properties `control_forward`, `control_reverse`, `control_left`, and `control_right`. Set `controls_enabled` to true. Existing unrelated object properties must remain unchanged."""),
    "vehicle-collision": ("Configures complete collision participation for an UPBGE vehicle chassis. Use for solid vehicle collision behavior.", {"capgraph-requires": "collision-add collision-mask-configure"}, """# Configure Vehicle Collision

Configure solid BOX collision on `CapgraphVehicle` with margin `0.04`, no ghost behavior, and no compound collision. Apply the frozen collision group and mask values exactly."""),
    "collision-add": ("Adds explicit solid UPBGE collision bounds to an existing mesh object. Use when physics needs a defined collision shape.", {"capgraph-requires": "object-resolve"}, """# Add Collision

Resolve the chassis, enable collision bounds, use shape `BOX`, set margin `0.04`, disable ghost behavior, and disable compound collision. Preserve rigid-body settings."""),
    "collision-mask-configure": ("Sets UPBGE collision group and mask bits on an existing object. Use for explicit layer participation.", {}, """# Configure Collision Mask

Set 16 collision bits. Expected group is bit 1 only: `[true, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false]`. Expected mask is bits 1 and 2: `[true, true, false, false, false, false, false, false, false, false, false, false, false, false, false, false]`."""),
    "third-person-camera": ("Creates and targets an UPBGE third-person camera for an existing object. Use for an offset chase view.", {"capgraph-requires": "camera-create object-resolve"}, """# Configure Third-person Camera

Use camera `CapgraphVehicleCamera`. Place it at offset `(0, -8, 4)` from `CapgraphVehicle`, target that exact chassis, link it to `CapgraphVehicleCollection`, and make it the active scene camera."""),
    "camera-create": ("Creates a persistent camera object in an UPBGE scene collection. Use when a scene needs an editor-defined camera.", {}, """# Create Camera

Create one camera data-block named `CapgraphVehicleCameraData` and object `CapgraphVehicleCamera`. Link it only to the requested collection. Do not replace a camera with the same name."""),
    "vehicle-verify": ("Verifies the frozen controllable vehicle fixture in actual UPBGE editor state. Use for complete V1 vehicle verification.", {}, """# Verify Vehicle

Run the complete structured vehicle verifier against `CapgraphVehicle`. Success requires exact object, mesh, transform, rigid-body, collision group and mask, input map, camera target, scene, and collection state. Treat any returned failure as incomplete. Runtime failures include capability, property, expected, and actual values."""),
    "vehicle-collision-repair": ("Repairs an incorrect collision mask on an otherwise valid V1 vehicle. Use after observed vehicle collision-mask verification failure.", {}, """# Repair Vehicle Collision Mask

After structured verification reports only an incorrect `collision_mask`, set `CapgraphVehicle` mask to the expected 16-bit value. Change only `obj.game.collision_mask`. Do not recreate the object, collision bounds, controls, or camera. Verify again after repair."""),
    "light-create": ("Creates and links a persistent UPBGE light with explicit type, energy, and transform. Use for scene illumination.", {}, "# Create Light\n\nCreate a persistent light data-block and object in the requested scene collection. Apply explicit type, energy, color, and transform."),
    "audio-source-add": ("Adds persistent spatial audio-source settings to an existing UPBGE object. Use for positional scene sound.", {}, "# Add Audio Source\n\nAttach requested sound identity, volume, pitch, attenuation, and looping metadata to an existing scene object."),
    "navmesh-build": ("Builds a navigation mesh from selected walkable scene geometry. Use for pathfinding-ready static levels.", {}, "# Build Navmesh\n\nValidate walkable source meshes, create one navigation mesh, and link it to the requested scene collection."),
    "character-controller-add": ("Adds UPBGE character-controller physics and movement properties to an existing actor. Use for player or NPC actors.", {}, "# Add Character Controller\n\nConfigure character physics, step height, jump speed, fall speed, and slope limits on an existing actor."),
    "animation-state-machine-create": ("Creates persistent animation states and transitions for an existing rigged actor. Use for deterministic animation control.", {}, "# Create Animation State Machine\n\nStore named states, clips, transition conditions, and initial state on the requested rigged actor."),
    "first-person-camera": ("Creates a first-person camera attached to an actor viewpoint. Use for an eye-level actor-relative view.", {}, "# Create First-person Camera\n\nCreate a camera at the requested eye offset, bind its target actor metadata, and make it active when requested."),
    "static-scene-verify": ("Verifies persistent static scene geometry, linkage, transforms, and non-dynamic collision. Use for environment fixtures.", {}, "# Verify Static Scene\n\nInspect static geometry and report structured linkage, transform, mesh, and collision failures."),
    "character-verify": ("Verifies a controllable character fixture, including controller and animation state. Use for character tasks.", {}, "# Verify Character\n\nInspect actor mesh, character physics, controls, animation state, scene linkage, and camera requirements."),
    "vehicle-static-verify": ("Verifies a non-controllable static vehicle prop. Use for decorative vehicle scene assets without dynamic controls.", {}, "# Verify Static Vehicle\n\nInspect static vehicle mesh, transform, non-dynamic collision, materials, and scene linkage. This verifier does not require controls."),
}

if len(SKILLS) != 24:
    raise RuntimeError("V1 catalog must contain exactly 24 capabilities")

for name, (description, metadata, body) in SKILLS.items():
    directory = ROOT / name
    directory.mkdir(parents=True, exist_ok=True)
    lines = ["---", f"name: {name}", f"description: {description}"]
    if metadata:
        lines.append("metadata:")
        lines.extend(f'  {key}: "{value}"' for key, value in metadata.items())
    lines.extend(["---", "", body.strip(), ""])
    (directory / "SKILL.md").write_text("\n".join(lines), encoding="utf-8", newline="\n")
