# V1 Generated Results

> Generated file. Do not edit measurements by hand. Human-authored interpretation is in [V1 Composition Benchmark Report](v1-composition-benchmark-report.md).

## Provenance

- Raw artifact: [`benchmarks/artifacts/v1-formal.jsonl`](../benchmarks/artifacts/v1-formal.jsonl)
- SHA-256: `d42aae57e84f7f35af7bc34b43a605be0127815cdfddb145c3f3596749723318`
- Records: 8
- Benchmark: `v1-vehicle-composition`
- Frozen commit: `7708761d316e05569dbda2e2712ba157f8a5dc6f`
- Working tree recorded clean: 8/8
- pi: `0.83.0`
- Model: `openai-codex/gpt-5.6-luna`
- Reasoning: `max`
- UPBGE: `5.3.0 Alpha` (build `9a92b08bb47b`)

## Aggregate measurements

Values are medians over four runs per condition unless shown as counts.

| Metric | Flat | Graph |
|---|---:|---:|
| Independently verified success | 4/4 | 4/4 |
| Benchmark protocol conformance | 4/4 | 4/4 |
| Composition-conformant runs | 3/4 | 4/4 |
| Execution-behavior clean runs | 4/4 | 4/4 |
| Agent turns | 13 | 12 |
| Agent tool calls | 22.50 | 11 |
| Failed tool calls | 0 | 0 |
| Duration (s) | 41.800 | 38.422 |
| Provider input tokens | 17591 | 17761 |
| Provider output tokens | 1433 | 898 |
| Cache-read tokens | 48384 | 25344 |
| Cache-write tokens | 0 | 0 |
| Provider cost | $0.006181 | $0.005142 |
| Skill bodies loaded | 13.50 | 14.50 |
| Irrelevant bodies loaded | 0 | 0 |
| Measured capability context (bytes) | 13924 | 7855 |

## Recovery measurements

| Mechanism | Flat | Graph |
|---|---:|---:|
| Correct first verifier selected | 2/2 | 2/2 |
| Controlled first verification failed | 2/2 | 2/2 |
| Recovery prose loaded | 2/2 | 2/2 |
| Recovery operation called | 2/2 | 2/2 |
| Second verification passed | 2/2 | 2/2 |

## Per-run measurements

| Slot | Condition | Variant | Success | Protocol | Composition | Execution | Turns | Tools | Failed | Duration (s) | Input | Output | Cache read | Cost | Context bytes | Bodies | Irrelevant |
|---:|---|---|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | flat | normal | Yes | Yes | Yes | Yes | 12 | 21 | 0 | 39.878 | 16173 | 1436 | 43008 | $0.005818 | 13660 | 13 | 0 |
| 2 | graph | recovery | Yes | Yes | Yes | Yes | 14 | 13 | 0 | 40.074 | 17793 | 968 | 32256 | $0.005365 | 8033 | 15 | 0 |
| 3 | graph | normal | Yes | Yes | Yes | Yes | 11 | 10 | 0 | 27.742 | 14091 | 774 | 22528 | $0.004198 | 7677 | 14 | 0 |
| 4 | flat | recovery | Yes | Yes | No | Yes | 14 | 28 | 0 | 54.317 | 25932 | 1907 | 53760 | $0.008550 | 15170 | 17 | 2 |
| 5 | flat | recovery | Yes | Yes | Yes | Yes | 15 | 23 | 0 | 43.722 | 18017 | 1430 | 56832 | $0.006456 | 13780 | 13 | 0 |
| 6 | graph | normal | Yes | Yes | Yes | Yes | 11 | 10 | 0 | 42.294 | 17729 | 828 | 18944 | $0.004918 | 7677 | 14 | 0 |
| 7 | graph | recovery | Yes | Yes | Yes | Yes | 13 | 12 | 0 | 36.769 | 19157 | 1108 | 28160 | $0.005724 | 8033 | 15 | 0 |
| 8 | flat | normal | Yes | Yes | Yes | Yes | 12 | 22 | 0 | 37.964 | 17165 | 1352 | 42496 | $0.005905 | 14068 | 14 | 0 |

## Measurement boundary

Context bytes are recorded harness payload measurements. They combine the Flat catalog or Graph metadata with loaded payloads and include frontmatter and serialization differences. They are not graph-edge compression or per-category token attribution. Tool-call differences also include Graph Batch versus individual Flat reads.
