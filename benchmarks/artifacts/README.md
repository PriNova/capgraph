# Canonical Formal Benchmark Artifacts

These JSONL files are frozen repository evidence derived from the formal artifacts named in the original reports. Absolute benchmark-machine paths were deterministically rewritten to repository-relative paths. Measurements, classifications, and other record values are unchanged.

| Stage | Canonical file | Original runner filename | SHA-256 |
|---|---|---|---|
| V0 | `v0-formal.jsonl` | `v0-physics-object-pilot-2026-08-07T15-35-14-424Z.jsonl` | `55c5dd92082921f9cf0d911afef0579c16c283dc7d6ea2d11c9c8ebf5469921c` |
| V0.1 | `v0.1-formal.jsonl` | `v0.1-physics-object-loading-policy-2026-08-07T18-59-26-937Z.jsonl` | `b266d1babd451944417a1538d24c8ad4028412e2940d3dd943e29edefdafc881` |
| V1 | `v1-formal.jsonl` | `v1-vehicle-composition-formal-final-20260807-220247.jsonl` | `d42aae57e84f7f35af7bc34b43a605be0127815cdfddb145c3f3596749723318` |

Path sanitization uses forward-slash repository-relative values such as `benchmarks/.generated-v1-flat-skills/vehicle-create/SKILL.md`. Do not use this directory as benchmark runner output. Runners write temporary, smoke, and exploratory records to ignored `benchmarks/results/`. To replace a formal artifact, define and review a new benchmark stage rather than mutating an existing file.
