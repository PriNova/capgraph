# V1 Composition Benchmark Report

> Human-authored analysis. Deterministic measurements are regenerated from the canonical raw artifact in [V1 Generated Results](v1-generated-results.md).

## 1. Result

The formal V1 composition benchmark completed all eight scheduled runs:

- Flat: 4/4 independently verified success.
- Graph: 4/4 independently verified success.
- All eight runs followed the required benchmark protocol.
- All four Recovery runs observed the exact controlled collision-mask failure, used grounded recovery behavior, passed a second verification, and passed independent verification.
- All eight runs selected the correct `vehicle` verifier first.
- No tool, task, protocol, execution-behavior, infrastructure, or independent-verification failures occurred.
- Graph composition behavior was conformant in 4/4 runs.
- Flat composition behavior was conformant in 3/4 runs. One Flat Recovery run loaded two irrelevant alternative verifier bodies: `static-scene-verify` and `vehicle-static-verify`.

Reliability was equal. Graph avoided all irrelevant skill bodies. The tested Graph harness exposed 43.6% less median measured capability context. Graph also used fewer median turns, tool calls, output tokens, cache-read tokens, duration, and cost. Median provider input tokens were 1.0% higher for Graph. Much of the tool-call difference came from Graph Batch versus individual Flat reads, not graph reasoning alone.

The result supports a narrow mechanism-level conclusion:

> Explicit graph structure did not improve final reliability in this eight-run benchmark, but it made capability composition more deterministic: Graph loaded the exact normal closure, selected lazy recovery after the controlled failure, and avoided irrelevant verifier prose. Flat remained capable of full success and sometimes skipped relevant low-level prose safely, but one Flat run explored two irrelevant verifier bodies.

Four runs per condition are too few for statistical significance. This report does not claim that Graph generally wins.

## 2. Research Question

> Does explicit graph structure help capability composition when the relevant closure is materially smaller than the available capability library?

V1 tests composition from a supplied known root:

```text
Known root capability:
vehicle-create
```

It does not test natural-language root resolution, semantic search, embeddings, aliases, indexing, or a persistent graph database.

## 3. Configuration

| Item | Value |
|---|---|
| Benchmark | `v1-vehicle-composition` |
| Git commit | `7708761d316e05569dbda2e2712ba157f8a5dc6f` |
| Working tree | Clean in every run |
| pi | `0.83.0` |
| Model | `openai-codex/gpt-5.6-luna` |
| Reasoning level | `max` |
| UPBGE | `5.3.0 Alpha` |
| UPBGE build | `9a92b08bb47b` |
| Runs | 4 Flat, 4 Graph |
| Variants per condition | 2 Normal, 2 Recovery |
| Sessions | Fresh in-memory session per run |
| Scene reset | Reserved V1 fixture reset before every run |
| Compaction | Disabled |
| Automatic model retry | Disabled |
| Available capabilities | 24 |
| Total source catalog | 9,792 bytes |
| Normal expanded closure | 14 bodies including verifier |
| Recovery closure | 15 bodies after lazy recovery loading |
| Normal closure prose | 3,845 bytes |

Normal task prompt:

```text
Create one small controllable vehicle named CapgraphVehicle in the known empty UPBGE scene.

Known root capability:
vehicle-create

Complete the task and verify actual editor state. Stop after verification passes or completion is impossible.
```

Recovery adds this sentence after the first line:

```text
The fixture may report an observed runtime fault; preserve valid state while resolving it.
```

Canonical raw result artifact:

```text
benchmarks/artifacts/v1-formal.jsonl
```

SHA-256:

```text
d42aae57e84f7f35af7bc34b43a605be0127815cdfddb145c3f3596749723318
```

The canonical public artifact replaces absolute benchmark-machine paths with repository-relative paths. Measurements and classifications are unchanged.

## 4. Capability Topology

The frozen root topology was:

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

Graph expansion deduplicated shared `object-resolve` and returned this exact normal order:

1. `mesh-object-create`
2. `object-resolve`
3. `rigid-body-add`
4. `chassis-create`
5. `keyboard-input`
6. `input-map-create`
7. `vehicle-controls`
8. `collision-add`
9. `collision-mask-configure`
10. `vehicle-collision`
11. `camera-create`
12. `third-person-camera`
13. `vehicle-create`
14. `vehicle-verify`

`vehicle-collision-repair` remained terminal metadata and was loaded only after a relevant failure.

## 5. Compared Conditions

### Flat

- All 24 capability names and descriptions were present through normal skill discovery.
- Full generated `SKILL.md` files were available through sandboxed `read` calls.
- Generated fixtures removed only CapGraph metadata and preserved source Markdown bodies.
- Graph metadata and `skill_graph` were unavailable.

### Graph

- No Flat capability catalog was present.
- The agent expanded `vehicle-create` deterministically.
- One Graph Batch `load_many(vehicle-create)` returned the normal execution closure and verifier.
- Recovery prose was excluded from the batch and available through one post-failure `load` call.
- Direct `read` calls were blocked.

Both conditions received identical task prompts, Markdown bodies, built-in `read` and primitive `upbge_control` definitions, verifier logic, recovery logic, model settings, scene policy, and non-compositional guidance. Only capability-selection and composition support differed.

## 6. Integrity Controls

Automated and live fixture tests established before formal execution that:

- Flat and Graph Markdown bodies were identical.
- Flat fixtures contained no CapGraph metadata.
- Root prose did not list dependencies, verifier, recovery skill, or workflow order.
- Graph expansion order was deterministic.
- Shared `object-resolve` appeared once in the selected closure.
- Verification remained distinct from execution dependencies.
- Graph Batch omitted recovery prose.
- Unrelated skills remained outside the root closure.
- Both conditions exposed the same `read` and `upbge_control` tool definitions.
- Condition-aware read sandboxes prevented implementation and source-graph exploration.
- Execution-tool guidance did not prescribe graph relations, verifier choice, recovery path, or the complete vehicle recipe.
- Collision mutations required explicit 16-bit values rather than a hard-coded recovery mask.
- The controlled fault occurred once immediately before first complete agent-facing vehicle verification.
- Independent verification disabled fault injection.
- Recovery changed only the explicit collision mask in live fixture tests.

The runner classified benchmark protocol, composition behavior, execution behavior, and independent task success separately. This prevents redundant primitive calls from being misreported as direct capability-composition evidence.

## 7. Balanced Schedule

The frozen schedule balanced condition, variant, and run position:

| Block | Position 1 | Position 2 |
|---:|---|---|
| 1 | Flat Normal | Graph Recovery |
| 2 | Graph Normal | Flat Recovery |
| 3 | Flat Recovery | Graph Normal |
| 4 | Graph Recovery | Flat Normal |

Every slot completed on its first attempt. No infrastructure retry was required.

## 8. Aggregate Results

Values are medians across four runs per condition unless marked as totals.

| Metric | Flat | Graph | Graph difference |
|---|---:|---:|---:|
| Independently verified success | 4/4 | 4/4 | Equal |
| Benchmark protocol conformance | 4/4 | 4/4 | Equal |
| Composition-conformant runs | 3/4 | 4/4 | +1 run |
| Execution-behavior clean runs | 4/4 | 4/4 | Equal |
| Failed tool calls | 0 | 0 | Equal |
| Agent turns | 13 | 12 | -7.7% |
| Agent tool calls | 22.5 | 11 | -51.1% |
| Duration | 41.800 s | 38.422 s | -8.1% |
| Provider input tokens | 17,591 | 17,761 | +1.0% |
| Provider output tokens | 1,433 | 898 | -37.3% |
| Cache-read tokens | 48,384 | 25,344 | -47.6% |
| Cache-write tokens | 0 | 0 | Equal |
| Cost | $0.006181 | $0.005142 | -16.8% |
| Skill bodies loaded | 13.5 | 14.5 | +7.4% |
| Irrelevant bodies loaded | 0 median | 0 | Equal median |
| Measured capability context | 13,924 bytes | 7,855 bytes | -43.6% |

The zero median for Flat irrelevant bodies hides one meaningful outlier: slot 4 loaded two irrelevant verifier bodies. Graph loaded none in any run.

Provider totals:

| Metric | Flat | Graph | Graph difference |
|---|---:|---:|---:|
| Input tokens | 77,287 | 68,770 | -11.0% |
| Output tokens | 6,125 | 3,678 | -40.0% |
| Cache-read tokens | 196,096 | 101,888 | -48.0% |
| Cache-write tokens | 0 | 0 | Equal |
| Cost | $0.026729 | $0.020205 | -24.4% |

Provider-reported token usage is separate from byte measurements. Byte categories do not support exact per-category token attribution.

## 9. Results by Task Variant

Values are medians across two runs per condition and variant.

### Normal

| Metric | Flat | Graph |
|---|---:|---:|
| Independent success | 2/2 | 2/2 |
| Composition conformance | 2/2 | 2/2 |
| Agent turns | 12 | 11 |
| Agent tool calls | 21.5 | 10 |
| Duration | 38.921 s | 35.018 s |
| Input tokens | 16,669 | 15,910 |
| Output tokens | 1,394 | 801 |
| Cache-read tokens | 42,752 | 20,736 |
| Cost | $0.005862 | $0.004558 |
| Skill bodies loaded | 13.5 | 14 |
| Irrelevant bodies loaded | 0 | 0 |

Normal reliability and composition were equal. Graph consistently loaded all 14 normal bodies. Flat loaded 13 bodies in slot 1 and all 14 in slot 8, showing that Flat could safely skip one low-level body in one run.

### Recovery

| Metric | Flat | Graph |
|---|---:|---:|
| Independent success | 2/2 | 2/2 |
| Composition conformance | 1/2 | 2/2 |
| Exact first controlled failure | 2/2 | 2/2 |
| Recovery prose loaded | 2/2 | 2/2 |
| Recovery operation called | 2/2 | 2/2 |
| Second verification passed | 2/2 | 2/2 |
| Agent turns | 14.5 | 13.5 |
| Agent tool calls | 25.5 | 12.5 |
| Duration | 49.020 s | 38.422 s |
| Input tokens | 21,974.5 | 18,475 |
| Output tokens | 1,668.5 | 1,038 |
| Cache-read tokens | 55,296 | 30,208 |
| Cost | $0.007503 | $0.005545 |
| Skill bodies loaded | 15 | 15 |
| Irrelevant bodies loaded | 1 median | 0 |

Both conditions recovered reliably. Graph loaded recovery prose only after the observed failure in both runs. Flat preloaded recovery prose during catalog exploration, which is permitted because Flat has no structural recovery relation. One Flat run also explored two irrelevant verifier bodies.

## 10. Per-Run Results

| Slot | Condition | Variant | Success | Protocol | Composition | Execution | Turns | Tools | Failed | Duration (s) | Input | Output | Cache read | Cost |
|---:|---|---|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | Flat | Normal | Yes | Yes | Yes | Yes | 12 | 21 | 0 | 39.878 | 16,173 | 1,436 | 43,008 | $0.005818 |
| 2 | Graph | Recovery | Yes | Yes | Yes | Yes | 14 | 13 | 0 | 40.074 | 17,793 | 968 | 32,256 | $0.005365 |
| 3 | Graph | Normal | Yes | Yes | Yes | Yes | 11 | 10 | 0 | 27.742 | 14,091 | 774 | 22,528 | $0.004198 |
| 4 | Flat | Recovery | Yes | Yes | No | Yes | 14 | 28 | 0 | 54.317 | 25,932 | 1,907 | 53,760 | $0.008550 |
| 5 | Flat | Recovery | Yes | Yes | Yes | Yes | 15 | 23 | 0 | 43.722 | 18,017 | 1,430 | 56,832 | $0.006456 |
| 6 | Graph | Normal | Yes | Yes | Yes | Yes | 11 | 10 | 0 | 42.294 | 17,729 | 828 | 18,944 | $0.004918 |
| 7 | Graph | Recovery | Yes | Yes | Yes | Yes | 13 | 12 | 0 | 36.769 | 19,157 | 1,108 | 28,160 | $0.005724 |
| 8 | Flat | Normal | Yes | Yes | Yes | Yes | 12 | 22 | 0 | 37.964 | 17,165 | 1,352 | 42,496 | $0.005905 |

Slot 4's composition issue was limited to irrelevant prose exploration. It still selected `vehicle` first, observed the exact controlled failure, grounded recovery in `vehicle-collision-repair`, repaired the mask, passed its second verification, and passed independent verification.

## 11. Capability Context

Median byte categories:

| Context category | Flat | Graph |
|---|---:|---:|
| Always-present Flat catalog | 7,954 | 0 |
| Graph expansion metadata | 0 | 2,768 |
| Loaded skill payload | 5,970 | 5,087 |
| Total measured capability context | 13,924 | 7,855 |

Graph used 43.6% fewer median measured capability-context bytes. The mechanism was not fewer loaded bodies: Graph loaded a higher median body count because it deterministically loaded the full relevant closure. The reduction came from avoiding the complete Flat catalog and from loading body-only graph results rather than generated Flat files with frontmatter and different serialization overhead.

Flat showed a potential countervailing advantage: it sometimes skipped relevant low-level bodies without harming success. Graph Batch always loaded the complete declared closure.

## 12. Verifier and Recovery Behavior

All eight runs selected `vehicle` as the first verifier profile.

Each Recovery run observed exactly this first failure:

```json
{
  "capability": "vehicle-collision",
  "property": "collision_mask",
  "expected": [true, true, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
  "actual": [true, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false]
}
```

Every Recovery run then followed:

```text
verify_state fails
→ load grounded recovery prose
→ set_collision_mask with 16 explicit expected bits
→ verify_state passes
→ independent verification passes with injection disabled
```

Graph used its `recover_with` metadata and loaded `vehicle-collision-repair` after the failure. Flat found the same body through normal catalog discovery. No harness-controlled automatic recovery occurred.

## 13. Shared Dependency Handling

Graph expansion selected shared `object-resolve` exactly once while retaining all three incoming dependency edges from rigid body, collision, and camera branches. Every Graph batch result used the same deterministic order.

Flat loaded `object-resolve` in three of four runs and never loaded it more than once in a run. Flat therefore did not exhibit duplicate body loading, but it had no structural guarantee that the shared dependency would be selected or deduplicated.

No reliability difference resulted from shared-dependency handling in this sample.

## 14. Failures and Recovery Accounting

- Expected controlled first-verifier failures: 4
- Successful recovery attempts: 4
- Unexpected task failures: 0
- Benchmark protocol failures: 0
- Execution-behavior failures: 0
- Failed tool calls: 0
- Infrastructure failures: 0
- Independent-verification failures: 0
- Composition-selection failures: 1 Flat run

The four controlled verifier failures are expected runtime evidence, not failed tool calls or failed benchmark runs.

## 15. Interpretation by Mechanism

### Reliability difference

None observed. Flat and Graph both achieved 4/4 independent success.

### Irrelevant-skill avoidance

Graph loaded zero irrelevant bodies in all four runs. Flat loaded zero in three runs and two plausible but incorrect verifier bodies in one Recovery run. This is direct support for the narrow composition hypothesis, although the sample is small.

### Shared-dependency handling

Graph deterministically deduplicated `object-resolve`. Flat did not duplicate it in practice, so no measured reliability or body-count advantage arose from this mechanism.

### Verifier selection

Every run selected the correct verifier first. Graph structure produced no observed reliability advantage for verifier choice, but one Flat run still read two alternative verifier bodies before completing the correct path.

### Recovery selection

All Recovery runs succeeded. Graph withheld recovery prose until the controlled failure and then loaded the structurally related recovery body in both runs. Flat found recovery prose through catalog exploration and also succeeded. The difference was selection timing and exploration, not recovery reliability.

### Agent-operation count

Graph used 51.1% fewer median tool calls. Much of this difference is mechanical: one batch graph load replaced many individual Flat `read` calls. This is a measured interaction advantage, not independent proof of better reasoning.

### Provider usage and cost

Graph reduced median output, cache-read usage, and cost, while median input tokens were 1.0% higher. Graph totals were lower in every provider category except cache writes, which were zero for both conditions. Provider usage therefore did not move uniformly at the median level.

### Capability context

Graph avoided the complete Flat catalog and reduced median measured capability context by 43.6%. It did not reduce loaded body count; it loaded the full declared closure consistently. Flat occasionally used less prose by omitting relevant low-level skills.

## 16. Limitations

- Four runs per condition and two per condition/variant are too few for statistical significance.
- Only one model and reasoning configuration were tested.
- Only one vehicle workflow and one controlled fault were tested.
- The known root removes intent-resolution difficulty.
- Graph Batch always loads the declared normal closure, even when Flat can succeed without every low-level body.
- Flat's one composition-selection failure may be sampling variation.
- Tool names remain visible equally to both conditions, although descriptions and parameters contain no composition recipe or recovery mapping.
- Wall-clock duration includes provider and local runtime variability.
- Byte categories differ in frontmatter and serialization structure and cannot be converted into exact provider token attribution.
- This benchmark supports or falsifies only the narrow V1 hypothesis; it cannot prove a general Skill Graph architecture.

## 17. Historical Preservation and Included Evidence

V0 and V0.1 remain historical baselines. Their specifications, reports, and raw records were not modified for V1.

V1 used a new capability directory, task fixture, runner fields, schedule, raw artifact, and report. Only this canonical artifact is included in the formal V1 result:

```text
benchmarks/artifacts/v1-formal.jsonl
```

The following classes of records are excluded from formal interpretation:

- Normal and Recovery smoke runs used to validate fixture mechanics;
- classification-split smoke runs;
- the earlier eight-slot exploratory schedule recorded before fault timing and primitive mask mutation were corrected;
- any temporary result produced while the working tree was dirty.

The excluded exploratory schedule demonstrated why this separation matters: a parameterless mask operation could suppress the intended first failure and the old classifier combined protocol, composition, and execution behavior. V1 was frozen again at commit `7708761d316e05569dbda2e2712ba157f8a5dc6f` only after these issues were corrected, tested, and smoke-validated.

## 18. Complete Capability Catalog

The 24-capability source catalog was:

### Relevant root expansion and terminals

1. `vehicle-create`
2. `chassis-create`
3. `mesh-object-create`
4. `rigid-body-add`
5. `object-resolve`
6. `vehicle-controls`
7. `keyboard-input`
8. `input-map-create`
9. `vehicle-collision`
10. `collision-add`
11. `collision-mask-configure`
12. `third-person-camera`
13. `camera-create`
14. `vehicle-verify`
15. `vehicle-collision-repair`

The Normal variant uses 13 execution bodies plus `vehicle-verify`. The Recovery variant can additionally use `vehicle-collision-repair` after failure.

### Plausible unrelated capabilities

1. `light-create`
2. `audio-source-add`
3. `navmesh-build`
4. `character-controller-add`
5. `animation-state-machine-create`
6. `first-person-camera`
7. `static-scene-verify`
8. `character-verify`
9. `vehicle-static-verify`

These skills were normal-looking alternatives, not nonsense decoys. In particular, the three unrelated verifier bodies were plausible for other scene, character, or static-vehicle tasks.

## 19. Per-Run Capability Loading and Context

| Slot | Condition | Variant | Catalog bytes | Graph metadata | Loaded payload | Total context | Bodies | Irrelevant | Expand | Batch | Recovery load | Verify calls | Repair calls |
|---:|---|---|---:|---:|---:|---:|---:|---|---:|---:|---:|---:|---:|
| 1 | Flat | Normal | 7,954 | 0 | 5,706 | 13,660 | 13 | — | 0 | 0 | 0 | 1 | 0 |
| 2 | Graph | Recovery | 0 | 2,768 | 5,265 | 8,033 | 15 | — | 1 | 1 | 1 | 2 | 1 |
| 3 | Graph | Normal | 0 | 2,768 | 4,909 | 7,677 | 14 | — | 1 | 1 | 0 | 1 | 0 |
| 4 | Flat | Recovery | 7,954 | 0 | 7,216 | 15,170 | 17 | `static-scene-verify`, `vehicle-static-verify` | 0 | 0 | 0 | 2 | 1 |
| 5 | Flat | Recovery | 7,954 | 0 | 5,826 | 13,780 | 13 | — | 0 | 0 | 0 | 2 | 1 |
| 6 | Graph | Normal | 0 | 2,768 | 4,909 | 7,677 | 14 | — | 1 | 1 | 0 | 1 | 0 |
| 7 | Graph | Recovery | 0 | 2,768 | 5,265 | 8,033 | 15 | — | 1 | 1 | 1 | 2 | 1 |
| 8 | Flat | Normal | 7,954 | 0 | 6,114 | 14,068 | 14 | — | 0 | 0 | 0 | 1 | 0 |

For Flat, `Recovery load` is zero because recovery prose arrives through normal `read`, not `skill_graph load`. Both Flat Recovery runs loaded `vehicle-collision-repair` before calling the repair operation.

Graph payload values were constant by variant: 4,909 bytes for Normal and 5,265 bytes after lazy Recovery loading. Flat payload varied with model-selected reads.

## 20. Exact Skill Selections

### Slot 1 — Flat Normal

```text
vehicle-create
collision-add
rigid-body-add
vehicle-verify
vehicle-controls
third-person-camera
camera-create
vehicle-collision
chassis-create
keyboard-input
collision-mask-configure
input-map-create
object-resolve
```

Flat omitted `mesh-object-create` and still succeeded.

### Slot 2 — Graph Recovery

```text
mesh-object-create
object-resolve
rigid-body-add
chassis-create
keyboard-input
input-map-create
vehicle-controls
collision-add
collision-mask-configure
vehicle-collision
camera-create
third-person-camera
vehicle-create
vehicle-verify
vehicle-collision-repair
```

### Slot 3 — Graph Normal

```text
mesh-object-create
object-resolve
rigid-body-add
chassis-create
keyboard-input
input-map-create
vehicle-controls
collision-add
collision-mask-configure
vehicle-collision
camera-create
third-person-camera
vehicle-create
vehicle-verify
```

### Slot 4 — Flat Recovery

```text
vehicle-create
collision-add
vehicle-controls
vehicle-collision
chassis-create
vehicle-verify
rigid-body-add
object-resolve
third-person-camera
mesh-object-create
keyboard-input
camera-create
input-map-create
static-scene-verify
vehicle-static-verify
vehicle-collision-repair
collision-mask-configure
```

This was the only composition-nonconformant run because it loaded two irrelevant verifier bodies.

### Slot 5 — Flat Recovery

```text
vehicle-create
vehicle-verify
input-map-create
chassis-create
rigid-body-add
third-person-camera
collision-add
vehicle-controls
camera-create
keyboard-input
vehicle-collision
collision-mask-configure
vehicle-collision-repair
```

Flat omitted `mesh-object-create` and `object-resolve` and still succeeded.

### Slot 6 — Graph Normal

The selection was byte-for-byte and order-for-order equivalent to slot 3's 14-body Graph Normal closure.

### Slot 7 — Graph Recovery

The selection was order-for-order equivalent to slot 2's 15-body Graph Recovery closure, including post-failure `vehicle-collision-repair`.

### Slot 8 — Flat Normal

```text
vehicle-create
collision-add
vehicle-controls
collision-mask-configure
chassis-create
camera-create
rigid-body-add
vehicle-collision
third-person-camera
vehicle-verify
keyboard-input
input-map-create
object-resolve
mesh-object-create
```

## 21. Measurement and Classification Definitions

### Independent task success

After each agent session, the harness disabled fault injection and invoked the vehicle verifier independently. Agent-reported success did not count. This is the primary reliability measurement.

### Benchmark protocol

Protocol conformance measured controlled condition mechanics:

- Graph expanded `vehicle-create` before mutation;
- Graph used exactly one normal `load_many` batch;
- Graph did not use individual non-recovery loads;
- Flat and Graph remained inside their read and loading interfaces.

Protocol is not a score for every model decision.

### Composition behavior

Composition conformance measured evidence directly related to the hypothesis:

- first verifier selection;
- irrelevant skill-body loading;
- exact controlled recovery observation;
- recovery-prose grounding;
- explicit expected repair mask;
- post-repair verification;
- lazy Graph recovery timing.

A run can be independently successful while composition-nonconformant, as slot 4 demonstrates.

### Execution behavior

Execution behavior measured secondary model operation quality:

- failed or malformed tool calls;
- unnecessary collision-mask mutation during Normal work;
- pre-failure recovery mutation;
- repeated recovery mutation.

These signals remain interesting but are not automatically attributed to graph composition. All formal runs were execution-clean.

### Context bytes

The runner kept these byte categories separate:

- always-present Flat catalog formatting;
- metadata-only Graph expansion output;
- payload returned by Flat reads or Graph loading.

These are UTF-8 payload measurements, not provider token counts. Flat and Graph serialization differs, so byte comparisons describe actual returned context rather than pure Markdown-only size.

### Provider usage

Input, output, cache-read, cache-write, and cost values came from provider-reported session statistics. No exact token attribution was inferred from byte categories.

## 22. Detailed Sequence and State Evidence

Every successful vehicle used the same set of six primitive mutations. Independent control and collision branches were allowed to interleave, producing three valid orders:

```text
create_mesh → set_game_physics → set_collision_bounds → set_collision_layers → set_input_properties → create_camera
create_mesh → set_game_physics → set_input_properties → set_collision_bounds → set_collision_layers → create_camera
create_mesh → set_game_physics → set_collision_bounds → set_input_properties → set_collision_layers → create_camera
```

Seven runs also used non-mutating `status` inspection; slot 4 used it twice. Status variation was retained as agent-operation data and was not treated as composition evidence.

`set_collision_layers` required explicit 16-bit group and mask arrays. `set_collision_mask` required an explicit 16-bit mask and did not hide the expected V1 value behind the operation.

Every Normal run then used one complete `vehicle` verification and no recovery mutation.

Every Recovery run used:

```text
first complete verify_state
→ exact injected collision_mask failure
→ grounded vehicle-collision-repair prose
→ set_collision_mask with explicit expected bits
→ second verify_state pass
→ independent verify_state pass with injection disabled
```

The recorded fault state was:

- Normal runs: `enabled: false`, `injected: false`;
- Recovery runs after the session: `enabled: false`, `injected: true`.

This proves that the controlled hook activated in every Recovery run, remained absent from Normal runs, and was disabled before every independent verification.

All formal records shared:

- commit `7708761d316e05569dbda2e2712ba157f8a5dc6f`;
- clean working tree;
- 24-capability catalog;
- model `openai-codex/gpt-5.6-luna` at `max` reasoning;
- UPBGE build `9a92b08bb47b`;
- first-attempt completion with no infrastructure retries.

## 23. Decision

V1 provides limited positive evidence for explicit capability relations as composition support:

- reliability remained equal;
- Graph avoided irrelevant prose in every run;
- Graph handled the shared closure deterministically;
- Graph selected recovery lazily and correctly after every controlled failure;
- Graph reduced measured capability context and most interaction/provider metrics;
- Flat still completed every task, selected the correct verifier, recovered every fault, and sometimes skipped relevant low-level prose safely.

The appropriate conclusion is not `Graph wins`. It is:

> In this small known-root vehicle benchmark, explicit graph structure improved composition determinism and irrelevant-prose avoidance without improving final reliability. Graph's context and operation reductions were measurable, while Flat retained adaptive omission of some relevant low-level bodies. More repeated tasks are required before generalizing.

Stop here and analyze these mechanisms before changing CapGraph architecture. Do not add intent resolution, semantic search, databases, caching, self-learning, graph mutation, or orchestration based on this result alone.
