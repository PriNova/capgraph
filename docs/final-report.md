# Capgraph Final Project Report

## 1. Executive Summary

Capgraph tested whether coding agents benefit from explicit capability relations in addition to flat `SKILL.md` discovery. The implementation used UPBGE as a measurable visual test domain while keeping the graph design domain-independent.

The project completed its planned known-root vertical slice, pi integration, controlled UPBGE execution, automated verification, and three formal benchmark stages. Across 36 formal model runs, every Flat and Graph run completed successfully. Final task reliability was therefore equal in all tested conditions.

The main result is narrower but positive:

> Explicit graph structure improved composition determinism and reduced irrelevant capability context in the larger V1 workflow, but it did not improve final task success.

Early tests showed that graph interaction design matters. One-skill-at-a-time loading added overhead in V0. V0.1 showed that one deterministic batch load removed most of this overhead. V1 then showed measurable benefits when the available catalog was larger than the relevant capability closure:

- the tested Graph harness exposed 43.6% less median measured capability context;
- 51.1% fewer median agent tool calls, largely influenced by Graph Batch versus individual Flat reads;
- 47.6% fewer median cache-read tokens;
- 16.8% lower median cost;
- no irrelevant skill bodies loaded in Graph runs;
- deterministic shared-dependency handling and lazy recovery selection.

These results are promising mechanism-level evidence, not proof of a general advantage. Sample sizes were small, one model configuration was used, and every task supplied the root capability.

## 2. Goal and Scope

The tested hypothesis was:

> Given a known root capability, does an explicit graph help an agent compose, verify, and recover capabilities more reliably or efficiently than normal flat skill discovery?

Capgraph deliberately did not test:

- natural-language intent-to-capability resolution;
- semantic or vector search;
- automatic graph learning or mutation;
- persistent trajectory learning;
- multi-agent orchestration;
- a graph database;
- unrestricted UPBGE or runtime `bge` control.

This scope kept the experiment focused on capability composition.

## 3. Implemented Architecture

Capgraph separates three concerns:

1. **Graph metadata** — `requires`, `verify_with`, and `recover_with` relations.
2. **Skill prose** — model-facing operational guidance in Agent Skills-compatible `SKILL.md` files.
3. **Execution code** — TypeScript tools and controlled Python scripts that mutate or verify UPBGE state.

The current V1 implementation uses the Agent Skills `name` as its canonical graph node ID. This is the tested V1 identity strategy, not a final universal identity design. Relations are stored as string values under `metadata` keys `capgraph-requires`, `capgraph-verify-with`, and `capgraph-recover-with`. Graph-managed skills remain outside normal pi skill discovery.

The complete graph is indexed outside model context. The model receives only:

- metadata for a requested local subgraph;
- explicitly loaded skill bodies;
- no unrelated graph metadata, prose, file paths, or internal index state.

The pi extension provides graph inspection, deterministic expansion, and on-demand loading. Later benchmark work added batch loading for the selected execution and verification closure while keeping recovery prose lazy.

## 4. Pi Compatibility and Safety

The documented V0 integration uses public pi surfaces only:

- pi extensions;
- pi custom tools;
- pi SDK benchmark sessions;
- Agent Skills `SKILL.md` files;
- pi package metadata.

The graph loader validates skill names, directory matching, metadata values, references, paths, duplicates, reachable dependency cycles, and output limits. Expansion recursively follows only `requires`; verification and recovery relations remain terminal.

UPBGE control uses the official Blender Lab MCP add-on only as a local TCP bridge. Capgraph bypasses the MCP server layer and sends null-delimited JSON requests directly to `127.0.0.1:9876`.

The `upbge_control` tool exposes fixed operations rather than arbitrary Python. It validates object names, constrains script resolution to the package, limits request and response sizes, and supports timeout and cancellation.

The bridge still has a material security risk: it accepts local arbitrary Python requests and has no authentication. Safe use requires localhost-only binding, no exposure to untrusted networks, trusted local processes, clean scenes, and saved work. Capgraph does not solve bridge security.

## 5. Benchmark Progression

### 5.1 V0: Flat Skills vs Progressive Graph Loading

V0 tested one shallow physics-object workflow with five Flat and five Graph runs.

| Metric | Flat | Graph Progressive |
|---|---:|---:|
| Verified success | 5/5 | 5/5 |
| Median turns | 8 | 12 |
| Median tool calls | 10 | 11 |
| Median duration | 25.286 s | 28.709 s |
| Median cost | $0.004673 | $0.005465 |
| Capability context | 21,188 bytes | 20,338 bytes |

Graph reduced unique capability-context bytes by 4.0% but increased turns, tool calls, duration, token use, and cost. Both conditions loaded all five bodies. The result showed no practical advantage for progressive graph loading on a small direct workflow.

### 5.2 V0.1: Loading-Policy Isolation

V0.1 compared Flat, Graph Progressive, and Graph Batch over 18 runs. All conditions succeeded 6/6.

| Metric | Flat | Graph Progressive | Graph Batch |
|---|---:|---:|---:|
| Median turns | 7.5 | 8 | 7 |
| Median tool calls | 9.5 | 10 | 6 |
| Median duration | 21.433 s | 21.851 s | 18.029 s |
| Median input tokens | 9,414.5 | 14,973.5 | 13,173.5 |
| Median cost | $0.003231 | $0.004269 | $0.003523 |
| Skill bodies loaded | 5 | 5 | 5 |

Compared with Graph Progressive, Graph Batch reduced median load calls from five to one, tool calls by 40.0%, duration by 17.5%, input tokens by 12.0%, and cost by 17.5%.

This established Graph Batch as the better loading policy. Flat remained slightly cheaper and used fewer input tokens, while Batch required fewer agent operations and less time.

### 5.3 V1: Larger Composition and Controlled Recovery

V1 used a 24-capability catalog and a vehicle workflow with transitive dependencies, one shared dependency, plausible unrelated skills, verifier alternatives, and a controlled recovery path. Four Flat and four Graph runs completed successfully.

| Metric | Flat | Graph |
|---|---:|---:|
| Verified success | 4/4 | 4/4 |
| Composition-conformant runs | 3/4 | 4/4 |
| Median turns | 13 | 12 |
| Median tool calls | 22.5 | 11 |
| Median duration | 41.800 s | 38.422 s |
| Median input tokens | 17,591 | 17,761 |
| Median output tokens | 1,433 | 898 |
| Median cache-read tokens | 48,384 | 25,344 |
| Median cost | $0.006181 | $0.005142 |
| Capability context | 13,924 bytes | 7,855 bytes |

Graph loaded the exact declared closure, deduplicated shared `object-resolve`, selected the correct verifier, withheld recovery prose until failure, and loaded no irrelevant bodies. One Flat recovery run loaded two irrelevant verifier bodies but still completed successfully.

All four Recovery runs observed the exact injected collision-mask failure, applied grounded recovery, passed a second agent-facing verification, and passed independent verification.

V1 therefore supports composition determinism and irrelevant-prose avoidance. It does not show a reliability improvement because both conditions achieved 100% success.

## 6. Consolidated Findings

### Supported by evidence

- The graph can remain outside model context and expose only a relevant local closure.
- Standard Agent Skills metadata is sufficient for the tested relation model.
- Public pi extension and SDK interfaces support the workflow.
- Direct, controlled UPBGE editor automation works against the tested UPBGE 5.3.0 Alpha build.
- Progressive one-body loading creates avoidable interaction overhead.
- Batch loading is the preferred graph loading policy for known-root composition benchmarks.
- A larger catalog creates conditions where graph structure can reduce irrelevant context and make composition deterministic.
- Lazy `recover_with` selection works after a structured verification failure.

### Not supported by current evidence

- Graph improves final task success.
- Graph is always cheaper or more token-efficient.
- Full declared closures are always better than adaptive omission; Flat sometimes skipped low-level prose safely.
- Results generalize across models, domains, tasks, or unknown roots.
- Graph metadata solves intent resolution.

## 7. Limitations

- Formal samples were small: 10 V0, 18 V0.1, and 8 V1 runs.
- Only `openai-codex/gpt-5.6-luna` at `max` reasoning was tested.
- Each stage used one primary workflow.
- Every prompt supplied a known root capability.
- UPBGE support is experimentally verified, not officially guaranteed by Blender Lab.
- Runtime `bge` control was not tested; only editor-time `bpy` and UPBGE object settings were used.
- Context-byte categories differ by serialization and cannot be converted directly into provider token attribution.
- Wall-clock measurements include provider and local runtime variance.
- The graph batch policy may load low-level prose that an adaptive Flat agent can safely omit.

## 8. Documentation Status

The project handoff, compatibility contract, transport research, benchmark specifications, benchmark reports, generated V1 measurements, canonical raw artifacts, and smoke report form a traceable evidence chain. `docs/open-questions.md` records unresolved context-dependency, stable-identity, and Flat Batch ablation questions.

The V1 specification is marked completed and frozen and links to the formal benchmark report. Its experimental design remains preserved as the historical benchmark contract.

The V1 recovery smoke report is correctly marked temporary and non-formal. Its two runs must remain excluded from formal benchmark totals.

## 9. Final Assessment

Capgraph completed its stated V0-to-V1 experimental program successfully. It produced a working pi-compatible capability graph, a controlled UPBGE execution path, independent verification, reproducible benchmark protocols, and measured results that changed the implementation policy.

The evidence does not justify claiming that capability graphs improve agent reliability. It does justify this narrower claim:

> For a known-root task with a larger capability catalog, explicit dependency, verification, and recovery relations can reduce irrelevant capability exposure and make composition more deterministic. Batch loading is necessary to avoid excessive graph interaction overhead.

The project should stop architecture expansion at this point. No database, semantic search, self-learning, graph mutation, cache layer, or orchestration system is justified by current evidence. Canonical formal artifacts are preserved under `benchmarks/artifacts/`; deterministic V1 measurements are separated from human-authored analysis.

## 10. Publication Boundary

Publication hardening should preserve and reproduce the existing evidence before any new benchmark or architecture work. Further evaluation, if separately approved later, must remain a new frozen stage and must not mutate V0, V0.1, or V1 evidence.
