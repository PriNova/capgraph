# Capgraph

Capgraph is a small experimental capability-graph layer for Agent Skills. It tests known-root capability composition while keeping graph metadata, model-facing `SKILL.md` prose, and executable tools separate.

Capgraph is a completed V0 → V0.1 → V1 experiment, not a general agent framework. UPBGE is the test domain; graph traversal remains domain-independent.

## Core Architecture

```text
Agent Skills-compatible SKILL.md
        ↓
capgraph metadata
        ↓
external graph index
        ↓
known-root deterministic closure
        ↓
batch-loaded relevant prose
        ↓
execution
        ↓
verification / lazy recovery
```

The current V1 metadata keys are string values under Agent Skills `metadata`:

- `capgraph-requires` → `requires`
- `capgraph-verify-with` → `verify_with`
- `capgraph-recover-with` → `recover_with`

`requires` is traversed recursively in dependency-first order and shared dependencies are deduplicated. `verify_with` and `recover_with` are terminal associations: their outgoing relations are not traversed. Graph Batch loads the complete declared `requires` closure and verifier prose in one operation. Recovery prose remains unloaded until a relevant failure.

V1 uses the Agent Skills `name` as the canonical graph node identifier. The name must match its capability directory. This is the current V1 identity strategy, not a final namespace design; rename compatibility and cross-package identity remain open questions.

## Evidence

Final reliability was equal between Flat and Graph in every formal stage.

### V0

Progressive, one-skill-at-a-time graph loading added interaction overhead on a shallow five-skill workflow. Flat and Graph both achieved 5/5 verified success.

### V0.1

Graph Batch removed most mechanical loading overhead. Flat, Graph Progressive, and Graph Batch each achieved 6/6 verified success. Graph Batch became the preferred graph loading policy.

### V1

V1 exposed 24 capabilities while the normal relevant closure contained 14 bodies including the verifier. Across four runs per condition:

- Flat and Graph both achieved 4/4 independently verified success;
- Graph composition was more deterministic in this small sample;
- Graph loaded no irrelevant skill bodies;
- the tested Graph harness exposed 43.6% less median measured capability context;
- Graph loaded recovery prose only after the controlled failure;
- Flat sometimes omitted declared low-level prose and still succeeded;
- reliability remained equal.

Graph used substantially fewer tool calls, but much of this came from one Graph Batch operation replacing individual Flat reads. The context result also includes different Flat catalog, Graph metadata, frontmatter, and serialization payloads. Neither result alone proves superior graph reasoning.

> These are small known-root experiments and are not evidence that capability graphs generally improve agent reliability.

Evidence chain:

- [Final project report](docs/final-report.md)
- [V1 human-authored analysis](docs/v1-composition-benchmark-report.md)
- [V1 generated measurements](docs/v1-generated-results.md)
- [Frozen V1 specification](docs/v1-composition-benchmark-specification.md)
- [Canonical V1 raw artifact](benchmarks/artifacts/v1-formal.jsonl)

## Repository Structure

```text
capabilities/              V0/V0.1 graph-managed skills and scripts
capabilities-v1/           Frozen V1 capability catalog
benchmarks/artifacts/      Canonical formal JSONL evidence; never runner output
benchmarks/results/        Ignored temporary, smoke, and exploratory runs
extensions/                pi graph, read-sandbox, and UPBGE tools
src/                       Graph and benchmark logic
tests/                     Unit and pi SDK integration tests
docs/                      Specifications, generated results, and analysis
```

Canonical artifacts use deterministic repository-relative path sanitization. Their public artifact hashes are:

| Stage | Artifact | SHA-256 |
|---|---|---|
| V0 | [`benchmarks/artifacts/v0-formal.jsonl`](benchmarks/artifacts/v0-formal.jsonl) | `55c5dd92082921f9cf0d911afef0579c16c283dc7d6ea2d11c9c8ebf5469921c` |
| V0.1 | [`benchmarks/artifacts/v0.1-formal.jsonl`](benchmarks/artifacts/v0.1-formal.jsonl) | `b266d1babd451944417a1538d24c8ad4028412e2940d3dd943e29edefdafc881` |
| V1 | [`benchmarks/artifacts/v1-formal.jsonl`](benchmarks/artifacts/v1-formal.jsonl) | `d42aae57e84f7f35af7bc34b43a605be0127815cdfddb145c3f3596749723318` |

Benchmark runners write only to ignored `benchmarks/results/` by default. They do not overwrite canonical artifacts.

## Requirements

- Node.js 22.19 or newer
- npm
- pi-compatible runtime for extension use; formal benchmarks used pi 0.83.0
- UPBGE for live editor execution; tested with UPBGE 5.3.0 Alpha, build `9a92b08bb47b`

Automated tests do not require UPBGE. The live tool requires the official Blender Lab MCP add-on bridge at `127.0.0.1:9876`.

## Setup and Validation

```bash
npm install
npm run check
npm test
npm run test:workflow
npm run test:v1-upbge-fixture  # requires the local UPBGE bridge
```

The tests cover Flat fixture equivalence, graph expansion, shared dependency deduplication, cycle and reference validation, batch loading, lazy recovery classification, read sandboxes, transport limits, and workflow integration.

Regenerate deterministic V1 measurements from the canonical artifact:

```bash
npm run report:v1
```

Optional explicit paths:

```bash
npm run report:v1 -- <input.jsonl> <output.md>
```

Generation validates the frozen eight-slot schedule and required fields, fails on missing or malformed records, and embeds the input SHA-256. Human interpretation remains in the separate V1 report.

## Benchmark Runners

Historical runners remain available, but documentation work does not require rerunning them:

```bash
npm run benchmark:pilot -- --start 1 --end 2
npm run benchmark:loading-policy -- --start 1 --end 3 --auto-reset
npm run benchmark:v1 -- --start 1 --end 2
```

Formal runs used `openai-codex/gpt-5.6-luna` with `max` reasoning. Output defaults to ignored timestamped JSONL under `benchmarks/results/`. Use a dedicated scene and follow each frozen specification before collecting new evidence.

## pi Integration

Load the repository as a local pi package:

```bash
pi -e .
```

The package registers:

- `skill_graph`: inspect, expand, load one body, or `load_many` for a known root;
- `upbge_control`: execute fixed allowed editor operations through the local bridge.

The package manifest retains the historical V0 progressive-loading extension over `capabilities/`. `extensions/skill-graph-batch.ts` applies the preferred batch policy to that catalog, while the frozen V1 benchmark uses condition-specific extensions and `capabilities-v1/`. Tool output is limited to pi's default line and byte limits. The loader rejects invalid names, unknown references, duplicate names, escaping paths, and reachable `requires` cycles.

## Security

The agent-facing `upbge_control` tool does not accept arbitrary Python. It maps validated operations to fixed wrappers and repository scripts.

The underlying Blender Lab bridge is more powerful: it accepts arbitrary Python and has no authentication. Capgraph does not solve bridge security.

- Bind and use it only on `localhost` / `127.0.0.1`.
- Never expose port `9876` to a LAN or untrusted network.
- Run only in a trusted local environment with trusted local processes.
- Save important work before testing agent control.
- Prefer clean test scenes.

See [UPBGE Control Transport](docs/upbge-control-transport.md) for the full trust boundary.

## Scope

Capgraph tests deterministic composition from a supplied root. It does not implement intent resolution, semantic search, embeddings, databases, caching, graph mutation, learning, orchestration, subagent routing, namespaces, or stable-ID migration. See [Open Questions](docs/open-questions.md).

## License

No repository license has been selected. External redistribution or reuse requires permission until the project owner adds a license. This remains a public-release blocker, not an architectural task.
