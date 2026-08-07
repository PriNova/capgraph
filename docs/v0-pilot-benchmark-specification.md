# V0 Flat Skills vs Skill Graph Pilot Benchmark

## 1. Purpose

This pilot validates the benchmark harness and produces the first controlled comparison between flat skill discovery and Skill Graph expansion.

Research question:

> Given the known root capability `physics-object-create`, does explicit graph expansion help the same coding agent complete and verify the workflow more reliably or with less exploration and context than flat skill discovery?

This is a harness pilot, not broad evidence for or against Skill Graphs. It uses one simple workflow and ten model runs.

## 2. Fixed Task

Use this exact prompt in every run:

```text
Create a physics-enabled cube named CapgraphBenchmarkCube in UPBGE.

Known root capability:
physics-object-create

Complete the task and verify the result. Stop after verification passes or you determine that completion is impossible.
```

The benchmark does not test natural-language root resolution.

## 3. Compared Conditions

### Flat condition

- Expose the five benchmark skills through normal pi skill discovery.
- Put all five skill names and descriptions in the system prompt.
- Let the agent load complete `SKILL.md` bodies on demand with `read`.
- Do not register the `skill_graph` tool.
- Register the same `upbge_control` tool used by the graph condition.

Create the flat fixture from the graph-managed capability files before the run:

- preserve each `name` and `description`;
- preserve each skill body exactly;
- remove `metadata.capgraph-*` relations;
- place the fixture in an isolated skill discovery directory.

The five skills are:

1. `object-create`
2. `rigid-body-add`
3. `collision-add`
4. `physics-object-create`
5. `physics-object-verify`

### Graph condition

- Do not expose graph-managed capabilities through normal pi skill discovery.
- Register `skill_graph` and `upbge_control`.
- Require the agent to call `expand` for the supplied root capability before the first UPBGE mutation.
- Reserve `inspect` for direct metadata questions; it does not satisfy the execution benchmark protocol.
- Expose only skill bodies selected by graph expansion.

Expected expansion:

```text
physics-object-create
├─ requires → object-create
├─ requires → rigid-body-add
├─ requires → collision-add
└─ verify_with → physics-object-verify
```

### Allowed difference

Only capability selection and composition support may differ. The skill prose and execution interface must remain equivalent.

## 4. Controlled Configuration

Freeze and record these values before the first run:

- Git commit;
- pi version;
- package version;
- model provider and model ID;
- reasoning level;
- UPBGE version and build hash;
- benchmark prompt;
- system prompt template;
- enabled built-in tools;
- extension paths;
- capability file hashes.

Both conditions must use:

- the same model and reasoning level;
- the same pi version;
- the same prompt;
- the same base system instructions;
- the same built-in tools;
- the same `upbge_control` implementation and non-compositional safety guidance;
- in-memory sessions with no prior messages;
- disabled global and project resource discovery except for explicit benchmark resources;
- no compaction during a run;
- equivalent clean UPBGE state.

Do not modify capability prose, tool descriptions, or benchmark configuration between runs.

## 5. Run Schedule

Run five paired comparisons, for ten model runs total. Alternate which condition runs first within each pair:

| Sequence | Pair | Condition |
|---:|---:|---|
| 1 | 1 | Flat |
| 2 | 1 | Graph |
| 3 | 2 | Graph |
| 4 | 2 | Flat |
| 5 | 3 | Flat |
| 6 | 3 | Graph |
| 7 | 4 | Graph |
| 8 | 4 | Flat |
| 9 | 5 | Flat |
| 10 | 5 | Graph |

Create a new pi in-memory session for every run. Do not reuse conversation state.

## 6. UPBGE State Control

Before every run, the harness must:

1. confirm that the official bridge responds at `127.0.0.1:9876`;
2. restore a known empty benchmark scene or remove only the reserved object `CapgraphBenchmarkCube` and its unused mesh data;
3. confirm that `CapgraphBenchmarkCube` does not exist;
4. confirm that the active scene and target collection are available.

State preparation is a harness operation. It must not be exposed to the model and must not count as an agent tool call.

After every run, preserve measurements before resetting the scene.

## 7. Independent Success Check

The harness must verify final state after the agent stops, even when the agent reports success or already called the verifier.

Call the existing verifier outside the model session for `CapgraphBenchmarkCube`. The run succeeds only when the independent result is:

```json
{
  "ok": true,
  "failures": []
}
```

A missing object, bridge error, invalid scene linkage, wrong physics configuration, wrong collision configuration, or failed verifier result means task failure unless classified as an infrastructure failure.

The independent verifier call does not count toward agent tool calls or agent context.

## 8. Limits and Failure Classification

Apply the same limits to both conditions:

- maximum run duration: 5 minutes;
- maximum agent tool calls: 12;
- no human steering after the prompt;
- no manual repair during a run.

Classify outcomes as:

- `success`: independent verification passes and the graph condition satisfies its expansion protocol;
- `task_failure`: agent stops, exceeds a limit, or leaves invalid UPBGE state;
- `protocol_failure`: a graph run does not successfully call `expand("physics-object-create")` before its first UPBGE mutation;
- `infrastructure_failure`: model service, pi runtime, benchmark harness, UPBGE process, or bridge fails independently of agent behavior.

An infrastructure failure does not consume its scheduled slot. Restore clean state and repeat that slot with the same condition. Record both the invalid attempt and its reason.

## 9. Measurements

### Primary metric

- independently verified success count per condition.

### Secondary metrics

- total agent tool calls;
- failed agent tool calls;
- LLM turns;
- wall-clock duration;
- provider-reported input, output, cache-read, and cache-write tokens;
- provider-reported cost when available;
- operation sequence;
- whether the agent called verification;
- whether the graph run expanded the root before mutation;
- skill files loaded with `read`;
- bytes of full skill prose returned by `read`;
- bytes returned by `skill_graph`;
- bytes of always-present skill catalog entries.

Keep context categories separate:

1. always-present skill names and descriptions;
2. full skill prose loaded on demand;
3. graph tool results;
4. total provider-reported token usage.

Do not claim exact per-category token counts when only byte counts are available.

## 10. Event Collection

Use pi SDK session events and final message state to record:

- `turn_start` and `turn_end` for turn count;
- `tool_execution_start` and `tool_execution_end` for tool names, parameters, order, duration, and error state;
- assistant messages for provider usage;
- final agent status and error message.

Do not include model reasoning text in the published report. Raw local records must not contain credentials or unrelated environment data.

## 11. Run Record

Write one JSON record per attempt. Minimum shape:

```json
{
  "benchmark": "v0-physics-object-pilot",
  "sequence": 1,
  "pair": 1,
  "condition": "flat",
  "status": "success",
  "gitCommit": "<commit>",
  "piVersion": "<version>",
  "model": "<provider>/<model>",
  "thinkingLevel": "<level>",
  "startedAt": "<ISO-8601>",
  "durationMs": 0,
  "turns": 0,
  "toolCalls": [],
  "usage": {
    "input": 0,
    "output": 0,
    "cacheRead": 0,
    "cacheWrite": 0,
    "cost": 0
  },
  "contextBytes": {
    "skillCatalog": 0,
    "skillBodiesRead": 0,
    "graphResults": 0
  },
  "independentVerification": {
    "ok": true,
    "failures": []
  },
  "protocol": {
    "conformant": true,
    "reason": null
  },
  "failureReason": null
}
```

Store raw run records as JSON Lines so interrupted benchmark execution does not lose completed runs.

## 12. Report

Report counts and medians. Do not infer statistical significance from ten runs.

Minimum table:

| Metric | Flat | Skill Graph |
|---|---:|---:|
| Verified success | x/5 | x/5 |
| Median tool calls | x | x |
| Median failed tool calls | x | x |
| Median turns | x | x |
| Median duration | x | x |
| Median input tokens | x | x |
| Median output tokens | x | x |
| Skill catalog bytes | x | x |
| Median skill body bytes | x | x |
| Median graph result bytes | x | x |

Also list:

- every task failure and its verifier output;
- every infrastructure failure and rerun;
- every graph protocol failure;
- observed operation-order differences;
- capability files read in the flat condition;
- known benchmark limitations.

## 13. Pilot Acceptance

The pilot is complete when:

1. all ten valid scheduled runs finish;
2. every run starts from verified clean state;
3. all graph runs successfully expand the supplied root before their first UPBGE mutation;
4. all run records contain configuration, event, usage, context, protocol, and independent verification data;
5. no condition receives unplanned resources or human steering;
6. summary metrics are generated from raw records;
7. results and limitations are recorded without a favorable-result assumption.

## 14. Runner

The SDK runner is available at `benchmarks/pilot.ts`:

```bash
npm run benchmark:pilot -- --model <provider/model> --thinking medium
```

Use `--start <1-10>` and `--end <1-10>` to execute or resume part of the fixed schedule. Use `--output <path>` to append records to a specific JSON Lines file. Local JSON Lines results under `benchmarks/results/` are ignored by Git so they do not change the recorded dirty-worktree state during resumed runs.

A graph attempt is marked `protocol_failure` unless it successfully expands `physics-object-create` before its first UPBGE mutation. Independent scene verification alone is not enough for graph-condition success.

The current runner uses a manual reset gate. It checks bridge availability and confirms that `CapgraphBenchmarkCube` is absent, but it does not mutate the scene during setup. When the object exists, restore the empty scene manually and press Enter to check again.

## 15. Known Limitations

- Only one workflow is tested.
- The workflow has shallow, direct dependencies.
- Allowed `upbge_control` operation names remain visible to both conditions, but its prompt guidance does not state the workflow recipe.
- The composite skill prose also describes the sequence.
- No recovery capability is present, so recovery success is not measured.
- Five runs per condition are enough to validate the harness, not to establish general effectiveness.

If the pilot harness works, the next evaluation should add multiple tasks with shared or transitive dependencies before increasing architectural scope.
