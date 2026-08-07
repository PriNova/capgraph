# V0 Flat Skills vs Skill Graph Pilot Benchmark Report

## 1. Result

The formal progressive-disclosure pilot completed all ten scheduled runs.

For the tested physics-object workflow:

- Flat Skills succeeded in 5 of 5 runs.
- Skill Graph succeeded in 5 of 5 runs.
- All Skill Graph runs followed the required expansion and root-loading protocol.
- No task, protocol, tool, infrastructure, or independent-verification failures occurred.
- Skill Graph reduced unique capability-context bytes by 4.0%, but increased median turns, tool calls, duration, provider token usage, and cost.

The result does not support an efficiency or reliability advantage for Skill Graph on this single shallow workflow. It does not establish that Skill Graphs are ineffective for more complex workflows.

## 2. Research Question

> Given the known root capability `physics-object-create`, does explicit graph structure help the same coding agent complete and verify the workflow more reliably or with less exploration and context than flat skill discovery?

This pilot tested capability composition from a known root. It did not test natural-language root resolution.

## 3. Configuration

| Item | Value |
|---|---|
| Git commit | `4e55deb148cfed330bab6b8aaa3c8dd48129d10b` |
| Working tree | Clean in every run |
| pi | `0.83.0` |
| Model | `openai-codex/gpt-5.6-luna` |
| Reasoning level | `max` |
| UPBGE | `5.3.0 Alpha` |
| UPBGE build | `9a92b08bb47b` |
| Runs | 5 Flat, 5 Graph |
| Sessions | New in-memory session per run |
| Scene state | Manually reset and checked before each run |

Task prompt:

```text
Create a physics-enabled cube named CapgraphBenchmarkCube in UPBGE.

Known root capability:
physics-object-create

Complete the task and verify the result. Stop after verification passes or you determine that completion is impossible.
```

Raw result artifact:

```text
benchmarks/results/v0-physics-object-pilot-2026-08-07T15-35-14-424Z.jsonl
```

SHA-256:

```text
26dc1b9ce8a9bcf02aeb9acfa9b53687c68ac37bb8acdaa042c37048ca9142a3
```

The earlier eager-expansion exploratory pair is excluded from this report.

## 4. Compared Conditions

### Flat Skills

- Five skill names and descriptions were always present through normal pi skill discovery.
- Full `SKILL.md` files were loaded with `read` on demand.
- Graph metadata and `skill_graph` were unavailable.

### Skill Graph

- No skill catalog was always present.
- `expand("physics-object-create")` returned only local graph metadata.
- `load(skill)` returned one skill body at a time.
- A valid run had to expand the root and load its body before the first UPBGE mutation.

Both conditions used the same skill prose and `upbge_control` execution interface.

## 5. Aggregate Results

Values are medians across five runs per condition unless marked as totals.

| Metric | Flat Skills | Skill Graph | Graph difference |
|---|---:|---:|---:|
| Independently verified success | 5/5 | 5/5 | Equal |
| Protocol-conformant runs | 5/5 | 5/5 | Equal |
| Failed tool calls | 0 | 0 | Equal |
| Agent turns | 8 | 12 | +50.0% |
| Agent tool calls | 10 | 11 | +10.0% |
| Duration | 25.286 s | 28.709 s | +13.5% |
| Input tokens | 17,051 | 19,293 | +13.1% |
| Output tokens | 635 | 788 | +24.1% |
| Cache-read tokens | 24,064 | 32,256 | +34.0% |
| Cost | $0.004673 | $0.005465 | +17.0% |
| Unique capability context | 21,188 bytes | 20,338 bytes | -4.0% |
| Total input tokens | 85,583 | 93,553 | +9.3% |
| Total output tokens | 3,216 | 3,944 | +22.6% |
| Total cache-read tokens | 120,320 | 148,992 | +23.8% |
| Total cost | $0.023382 | $0.026423 | +13.0% |

Per-category capability context was constant across each condition:

| Context category | Flat Skills | Skill Graph |
|---|---:|---:|
| Always-present skill catalog | 1,868 bytes | 0 bytes |
| Skill prose loaded with `read` | 19,320 bytes | 0 bytes |
| Graph metadata | 0 bytes | 1,056 bytes |
| Skill prose loaded with `load` | 0 bytes | 19,282 bytes |
| Total | 21,188 bytes | 20,338 bytes |

Provider-reported token usage is reported separately from byte measurements. The benchmark does not claim exact token attribution to individual context categories.

## 6. Per-Run Results

| Slot | Condition | Success | Protocol | Turns | Tools | Duration (s) | Input | Output | Cache read | Cost |
|---:|---|---|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | Flat | Yes | Yes | 8 | 10 | 25.286 | 22,499 | 605 | 18,432 | $0.005594 |
| 2 | Graph | Yes | Yes | 12 | 11 | 25.525 | 17,462 | 675 | 32,768 | $0.004958 |
| 3 | Graph | Yes | Yes | 12 | 11 | 34.533 | 19,293 | 871 | 32,256 | $0.005549 |
| 4 | Flat | Yes | Yes | 8 | 10 | 21.260 | 17,051 | 651 | 24,064 | $0.004673 |
| 5 | Flat | Yes | Yes | 8 | 10 | 20.868 | 11,481 | 635 | 29,696 | $0.003652 |
| 6 | Graph | Yes | Yes | 9 | 11 | 30.129 | 19,750 | 879 | 26,112 | $0.005527 |
| 7 | Graph | Yes | Yes | 9 | 11 | 27.869 | 20,090 | 788 | 25,088 | $0.005465 |
| 8 | Flat | Yes | Yes | 8 | 10 | 26.244 | 17,033 | 621 | 24,064 | $0.004633 |
| 9 | Flat | Yes | Yes | 8 | 10 | 29.021 | 17,519 | 704 | 24,064 | $0.004830 |
| 10 | Graph | Yes | Yes | 12 | 11 | 28.709 | 16,958 | 731 | 32,768 | $0.004924 |

## 7. Observed Behavior

Every Flat run loaded the same five skill files:

1. `physics-object-create`
2. `object-create`
3. `rigid-body-add`
4. `collision-add`
5. `physics-object-verify`

Every Graph run expanded the root and progressively loaded the same five skill bodies. The graph sequence was consistently:

```text
expand root metadata
load root
load object-create
create cube
load rigid-body-add
add rigid body
load collision-add
add collision
load physics-object-verify
verify object
```

Both conditions used the same UPBGE operation order:

```text
status
create_cube
add_rigid_body
add_collision
verify_physics_object
```

Flat loaded all prose before execution. Graph interleaved loading and execution. Progressive loading did not omit any skill body in this task, so its small unique-context reduction did not compensate for additional model turns and context replay.

## 8. Failures and Recovery

- Task failures: 0
- Protocol failures: 0
- Tool failures: 0
- Infrastructure failures: 0
- Independent verification failures: 0
- Recovery attempts: 0

Recovery effectiveness was not measured because the graph contains no recovery skill for this workflow and no failure was introduced.

## 9. Interpretation

This workflow has shallow direct dependencies, a known root, explicit operation names, and a composite root skill that describes the sequence. Both variants therefore found and loaded the same complete skill set.

The graph supplied correct structure and supported deterministic just-in-time loading, but it did not improve success because Flat already achieved 100%. It also did not reduce the number of loaded skill bodies. The extra graph expansion and sequential loading interactions increased total work.

The most defensible conclusion is:

> For this simple known-root physics-object workflow, Skill Graph and Flat Skills were equally reliable, while Flat Skills were more efficient on measured agent steps, provider usage, duration, and cost.

The result should not be generalized to tasks with:

- deeper or shared dependencies;
- optional branches;
- irrelevant skills in a larger catalog;
- verifier selection ambiguity;
- failure-triggered recovery;
- multiple possible capability compositions.

## 10. Limitations

- Five samples per condition are too few for statistical significance.
- Only one task and one model configuration were tested.
- The task is simple and has no optional or recovery branch.
- The known root removes intent-resolution difficulty.
- `upbge_control` operation names remain visible to both conditions.
- The root skill itself describes the workflow sequence.
- Manual scene reset may introduce small environmental variation, although every run passed the clean-state gate.
- Wall-clock duration includes provider and local runtime variability.

## 11. Decision

V0 produced a measurable result and should not add more infrastructure to this same simple workflow.

Before claiming a general Skill Graph benefit, a later benchmark should use a task where graph structure can avoid exploration or unnecessary prose. A suitable next test would include shared or transitive dependencies and an optional recovery path while preserving the same controlled A/B design.
