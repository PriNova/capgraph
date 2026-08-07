# V1 Expected-Failure Recovery Smoke Report

Status: temporary, non-formal fixture-validation report.

## 1. Result

The V1 expected-failure recovery smoke completed one Graph run and one Flat run:

- Flat: 1/1 independently verified success.
- Graph: 1/1 independently verified success.
- Both runs followed their required protocols.
- Both first complete verifier calls observed the same injected collision-mask failure.
- Both agents selected the available recovery behavior, changed the mask, and passed a second verification.
- Independent post-session verification passed with fault injection disabled.
- No tool, task, protocol, infrastructure, or independent-verification failures occurred.

Graph loaded recovery prose only after the observed failure. Flat loaded the same recovery prose during pre-execution catalog exploration. Both conditions recovered successfully.

This two-run smoke validates fixture and harness mechanics. It is not formal benchmark evidence and does not establish statistical significance or a general condition advantage.

## 2. Research Question

> Can both V1 conditions observe the same deterministic one-shot collision-mask fault, select available recovery behavior, repair only the intended mask through the fixed operation, and pass agent-facing and independent verification?

This smoke tests expected-failure recovery from the known root `vehicle-create`. It does not test natural-language root resolution.

## 3. Configuration

| Item | Value |
|---|---|
| Benchmark | `v1-vehicle-composition` recovery variant |
| Git commit | `9a18d03a8090e936d1cf99f637f0d192cea072cf` |
| Working tree | Clean in both runs |
| pi | `0.83.0` |
| Model | `openai-codex/gpt-5.6-luna` |
| Reasoning level | `max` |
| UPBGE | `5.3.0 Alpha` |
| UPBGE build | `9a92b08bb47b` |
| Runs | 1 Flat, 1 Graph |
| Sessions | Fresh in-memory session per run |
| Scene reset | Reserved V1 fixture reset before each run |
| Compaction | Disabled |
| Automatic model retry | Disabled |
| Available capabilities | 24 |
| Normal closure | 14 bodies including verifier |

Task prompt:

```text
Create one small controllable vehicle named CapgraphVehicle in the known empty UPBGE scene. The fixture may report an observed runtime fault; preserve valid state while resolving it.

Known root capability:
vehicle-create

Complete the task and verify actual editor state. Stop after verification passes or completion is impossible.
```

Raw result artifact:

```text
benchmarks/results/v1-recovery-smoke-20260807-212129.jsonl
```

SHA-256:

```text
fce0406ed4261f2f04d5f591a3dd634228b358db3077f5090a11e855b43ddeb1
```

## 4. Compared Conditions

### Flat

- All 24 names and descriptions were available through normal skill discovery.
- Full generated `SKILL.md` fixtures were available through sandboxed `read` calls.
- Graph metadata and `skill_graph` were unavailable.
- Repository implementation, source-graph, harness, and unrelated filesystem reads were blocked.

### Graph

- No flat capability catalog was present.
- The agent expanded `vehicle-create` and batch-loaded the normal execution closure plus verifier.
- Batch loading omitted recovery prose.
- After the structured collision failure, the agent loaded `vehicle-collision-repair` with one individual graph load.
- Direct `read` calls were blocked by the condition-aware sandbox.

Both conditions used identical task prompts, Markdown bodies, `read` and `upbge_control` tool definitions, primitive UPBGE operations, verifier implementation, recovery implementation, initial scene policy, model, and reasoning level. Capability-selection and composition support differed.

## 5. Controlled Failure Evidence

Both first complete `vehicle` verifier calls returned exactly one structured failure:

```json
{
  "capability": "vehicle-collision",
  "property": "collision_mask",
  "expected": [true, true, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
  "actual": [true, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false]
}
```

The expected mask enables collision bits 1 and 2. The injected mask enabled only bit 1. The fault state recorded:

```json
{
  "enabled": false,
  "injected": true
}
```

`injected: true` confirms that the one-shot fixture activated. `enabled: false` confirms that the runner disabled injection before independent verification. Independent verification then passed in both runs.

Separate live fixture tests established that:

- injection occurs once;
- recovery changes only `obj.game.collision_mask`;
- valid vehicle state is preserved;
- the fault does not reapply after repair;
- independent verification does not inject a fault.

## 6. Aggregate Results

Each value represents one run, not a median across repeated samples.

| Metric | Flat | Graph |
|---|---:|---:|
| Independently verified success | 1/1 | 1/1 |
| Protocol-conformant runs | 1/1 | 1/1 |
| Correct first verifier selected | 1/1 | 1/1 |
| Controlled first verification failed | 1/1 | 1/1 |
| Recovery prose loaded | 1/1 | 1/1 |
| Recovery operation called | 1/1 | 1/1 |
| Second verification passed | 1/1 | 1/1 |
| Failed tool calls | 0 | 0 |
| Agent turns | 15 | 14 |
| Agent tool calls | 24 | 13 |
| Duration | 52.773 s | 34.215 s |
| Provider input tokens | 19,558 | 16,672 |
| Provider output tokens | 1,951 | 920 |
| Cache-read tokens | 59,904 | 32,256 |
| Cache-write tokens | 0 | 0 |
| Cost | $0.007451 | $0.005084 |
| Always-present Flat catalog | 7,954 bytes | 0 bytes |
| Graph metadata | 0 bytes | 2,768 bytes |
| Loaded skill payload | 6,192 bytes | 5,265 bytes |
| Total measured capability context | 14,146 bytes | 8,033 bytes |
| Irrelevant bodies loaded | 0 | 0 |

Provider-reported token usage is separate from byte measurements. Returned payload bytes do not provide exact per-category token attribution. Graph serialization and Flat frontmatter also make body-payload byte totals different even when source Markdown bodies are identical.

## 7. Per-Run Results

| Slot | Condition | Success | Protocol | Turns | Tools | Failed | Duration (s) | Input | Output | Cache read | Cost |
|---:|---|---|---|---:|---:|---:|---:|---:|---:|---:|
| 2 | Graph | Yes | Yes | 14 | 13 | 0 | 34.215 | 16,672 | 920 | 32,256 | $0.005084 |
| 4 | Flat | Yes | Yes | 15 | 24 | 0 | 52.773 | 19,558 | 1,951 | 59,904 | $0.007451 |

These slots were selected from the frozen balanced schedule only to exercise one Recovery run per condition. The complete schedule was not run.

## 8. Loaded Capabilities

Graph batch-loaded the complete normal closure in deterministic dependency-first order:

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

After the first verification failure, Graph loaded:

15. `vehicle-collision-repair`

Flat loaded 14 bodies during pre-execution exploration. It included `vehicle-collision-repair` but omitted `mesh-object-create`. This omission did not prevent success because the loaded chassis prose and shared primitive operation supplied enough execution information. Neither run loaded a capability outside the Recovery variant's relevant set.

## 9. Observed Sequences

Both conditions used the same editor-operation sequence:

```text
status
create_mesh
set_game_physics
set_collision_bounds
set_collision_layers
set_input_properties
create_camera
```

Both conditions then followed the expected verification and recovery sequence:

```text
verify_state
→ collision_mask failure
→ set_collision_mask
→ verify_state passes
→ independent verify_state passes with injection disabled
```

Graph's graph interaction sequence was:

```text
expand(vehicle-create)
→ load_many(vehicle-create)
→ execute
→ verify_state fails
→ load(vehicle-collision-repair)
→ set_collision_mask
→ verify_state passes
```

Flat loaded recovery prose before execution, but did not call the recovery operation until after observing the verifier failure. The harness did not automatically orchestrate recovery in either condition.

## 10. Failures and Recovery

- Expected controlled verifier failures: 2
- Unexpected task failures: 0
- Protocol failures: 0
- Tool failures: 0
- Infrastructure failures: 0
- Independent-verification failures: 0
- Successful recovery attempts: 2

The two first-verifier failures are expected task evidence, not failed tool calls or failed benchmark runs.

## 11. Interpretation

### Reliability

Both conditions completed the expected recovery path and passed independent verification. This smoke therefore identifies no reliability difference.

### Recovery selection

Flat found and preloaded the recovery body from the complete catalog. Graph did not receive recovery prose during normal batch loading; it used the graph's `recover_with` relation after observing the relevant failure. Both selected the same fixed mask-only recovery operation.

### Agent operations and provider usage

In these two runs, Graph used fewer turns, tool calls, provider tokens, cache reads, wall-clock time, and provider cost. Graph also used fewer measured capability-context bytes despite loading one more body, partly because Flat reads include generated frontmatter and the two loading paths have different serialization overhead.

These are single-run observations. They do not establish that Graph generally improves recovery efficiency.

### Mechanism-level conclusion

The defensible smoke conclusion is:

> The controlled recovery fixture worked equally reliably in one Flat and one Graph run. Flat discovered recovery prose before execution, while Graph withheld it until the observed collision failure and then selected it through explicit recovery metadata. Graph required fewer measured agent operations and provider resources in this pair, but the sample is too small for a benchmark conclusion.

## 12. Limitations

- One run per condition cannot establish statistical significance or stable medians.
- Only the Recovery task variant was exercised.
- Both runs used one model and reasoning configuration.
- The known root removes intent-resolution difficulty.
- Flat loaded recovery prose eagerly, so this pair does not compare two lazy recovery-selection mechanisms.
- Returned byte categories differ in serialization structure and cannot be translated into exact provider-token attribution.
- Wall-clock duration includes provider and local runtime variability.
- The complete balanced schedule was not run.

## 13. Decision

The expected-failure fixture, lazy Graph recovery path, mask-only repair, second verification, independent verification, read sandbox, and measurement recording are ready for the balanced V1 schedule.

Do not treat this smoke pair as formal evidence that Graph wins. Preserve the frozen V1 conditions and run schedule before drawing mechanism-level conclusions from repeated runs.
