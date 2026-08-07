# V1 Composition Benchmark Specification

Status: design only. The V1 capability domain and recovery injection are not implemented.

## 1. Purpose

V1 tests whether graph structure helps capability composition when the relevant closure is materially smaller than the available library.

V1 does not test intent resolution. Every task supplies:

```text
Known root capability:
vehicle-create
```

The completed V0.1 result fixes Graph Batch as the V1 graph loading policy. Do not change the policy based on V1 outcomes.

## 2. Conditions

### Flat

- Expose the complete V1 skill catalog through normal flat discovery.
- Allow exact source-equivalent skill bodies to be loaded with `read`.
- Scope benchmark `read` access to discovered generated V1 `SKILL.md` fixtures. Block implementation, harness, source-graph, and unrelated filesystem reads so tool-error exploration cannot contaminate the condition.
- Remove only CapGraph metadata from generated fixtures.

### Graph

- Expose no graph-managed skill catalog through flat discovery and do not provide the Flat `read` path.
- Expand the supplied root deterministically.
- Use Graph Batch, as selected by V0.1.
- Load recovery prose only after a relevant verification failure.

Both conditions use identical Markdown bodies, task prompts, execution tools, verifier implementations, scene state, model, and reasoning level.

### Execution-tool leakage control

Flat and Graph must receive exactly the same UPBGE execution interface. Tool names, descriptions, schemas, examples, parameter descriptions, prompt snippets, and system guidance must not encode the capability composition under test. They must not prescribe or reveal the dependency graph, workflow order, verifier choice, recovery path, irrelevant capabilities, shared transitive dependencies, or complete vehicle recipe.

The interface may expose primitive UPBGE mutations. Structured verifier failures may report observed runtime faults, including expected and actual values. This runtime evidence is not composition guidance. The interface must not explain which recovery capability addresses a failure.

Fixture tests must compare the execution tool exposed to both conditions and inspect shared and condition-specific tool guidance for accidental graph-only relationship leakage. Do not redesign the execution interface unless such a test identifies concrete leakage.

## 3. Proposed Relevant Topology

```text
vehicle-create
├── requires → chassis-create
│   ├── requires → mesh-object-create
│   └── requires → rigid-body-add
│       └── requires → object-resolve
├── requires → vehicle-controls
│   ├── requires → keyboard-input
│   └── requires → input-map-create
├── requires → vehicle-collision
│   ├── requires → collision-add
│   │   └── requires → object-resolve
│   └── requires → collision-mask-configure
├── requires → third-person-camera
│   ├── requires → camera-create
│   └── requires → object-resolve
├── verify_with → vehicle-verify
└── recover_with → vehicle-collision-repair
```

`object-resolve` is a shared transitive dependency and must appear once in the expanded execution order. `vehicle-verify` is distinct from execution requirements. `vehicle-collision-repair` is visible in expansion metadata but its prose is not loaded before a relevant failure.

Exact dependency-first order is frozen in the fixture after all V1 skills exist. The test must assert that order and deduplication.

## 4. Larger Catalog

Target 20 to 24 capabilities. Keep the relevant normal execution closure near 12 bodies. Add plausible unrelated skills, for example:

- `light-create`;
- `audio-source-add`;
- `particle-emitter-add`;
- `navmesh-build`;
- `character-controller-add`;
- `animation-state-machine-create`;
- `first-person-camera`;
- `static-scene-verify`;
- `character-verify`;
- `vehicle-static-verify`.

Descriptions must be realistic and similarly specific. Do not add nonsense skills or misleading prose only to make Flat fail.

The verifier catalog deliberately contains plausible but incorrect alternatives. `vehicle-verify` is the correct structural verifier. Flat receives equivalent access to all verifier prose and may select it from names and descriptions.

## 5. Task

Create one small controllable vehicle in a known empty UPBGE scene. Required final state includes:

- persistent chassis mesh;
- UPBGE rigid-body physics;
- explicit vehicle collision settings;
- keyboard control mapping;
- third-person camera targeting the vehicle;
- expected scene and collection linkage;
- successful vehicle verifier result.

Freeze exact object names, transforms, masses, collision groups and masks, input keys, and camera offsets in the task fixture before the first run.

The root body states purpose, inputs, outputs, execution semantics, caveats, and completion criteria. It must not list dependency names or workflow order.

## 6. Controlled Recovery Case

One predefined benchmark variant injects a wrong vehicle collision mask after normal execution and before the first vehicle verification.

Injection requirements:

1. The harness enables the fault before the session starts.
2. The UPBGE execution fixture applies the wrong mask deterministically after collision setup. The model cannot choose or fabricate the fault.
3. The first complete `vehicle-verify` call reports a structured `vehicle-collision` failure containing expected and actual mask values.
4. `vehicle-collision-repair` sets the expected mask without recreating valid vehicle state.
5. A second complete `vehicle-verify` call can pass.
6. The injection is one-shot. It must not reapply after recovery.
7. Independent verification runs after the model session and does not inject a fault.

Expected logical path:

```text
execute
→ vehicle-verify fails for injected collision mask
→ vehicle-collision-repair
→ vehicle-verify passes
```

The Flat catalog includes the exact same recovery body. Only graph relations differ.

Do not add learning, trajectory persistence, graph mutation, or automatic recovery orchestration.

## 7. Task Set

Use at least two frozen task variants:

1. normal vehicle creation with no injected fault;
2. identical vehicle creation with the controlled one-shot collision-mask fault.

If multiple vehicle compositions are included, define them as genuine product variants, such as keyboard-controlled versus autonomous control, with separate known roots or explicit task inputs. Do not create arbitrary branches to favor Graph.

## 8. Measurements

Record the V0.1 metrics plus:

- total available capability count and catalog bytes;
- relevant expanded closure count and bytes;
- irrelevant skill bodies loaded;
- selected verifier;
- first verifier failure details;
- recovery skill loaded and called;
- second verification result;
- deduplicated shared dependencies;
- exact execution, verification, and recovery sequence.

Primary metrics remain independently verified success and protocol conformance. Secondary metrics include turns, tool calls, failures, duration, provider usage, cost, and context bytes.

Do not infer statistical significance from a small pilot.

## 9. Integrity and Schedule

Use fresh sessions, identical prompts, identical initial scenes, independent verification, no steering, and alternating order.

Choose a balanced schedule after the final number of conditions and task variants is frozen. Each condition must appear equally often in each run position and with each task variant. Infrastructure failures repeat the same slot and do not consume it.

Fixture tests must prove:

- Flat and Graph Markdown bodies are identical;
- graph metadata is absent from Flat fixtures;
- deterministic topological order;
- shared dependency deduplication;
- verifier separation;
- recovery prose is not eagerly batch-loaded;
- unrelated skills are outside the root closure;
- controlled fault occurs once and is independently observable.

## 10. Stop Boundary

V0.1 is complete and its Graph Batch policy is frozen. V1 implementation should add only the specified capability fixtures, deterministic UPBGE operations, verifier, one-shot fault injection, recovery operation, tests, runner, and report. No semantic search, database, index, cache layer, agent orchestrator, or self-modifying graph is required.
