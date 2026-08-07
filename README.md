# Capgraph

Capgraph is a minimal capability-graph experiment for coding agents.

The project tests whether explicit skill dependencies, verification, recovery, and composition help an agent complete tasks more reliably and with less context than a flat skill library.

UPBGE is the first test domain. The graph implementation remains domain-independent.

## Core Model

Capgraph separates three layers:

1. **Graph metadata** describes capability relationships such as `requires`, `verify_with`, and `recover_with`.
2. **Skill prose** in `SKILL.md` provides model-facing decisions, API guidance, failure modes, and recovery instructions.
3. **Executable scripts** perform and verify domain operations.

The complete graph stays outside model context. The pi extension exposes only the local subgraph selected from a known root capability.

## First Vertical Slice

The initial workflow creates and verifies a physics-enabled cube in UPBGE:

```text
physics-object-create
├─ requires → object-create
├─ requires → rigid-body-add
├─ requires → collision-add
└─ verify_with → physics-object-verify
```

The capability implementations use Blender's `bpy` data API and UPBGE game settings through `Object.game`. They do not use Blender's separate animation rigid-body system.

## Repository Structure

```text
capabilities/              Graph-managed SKILL.md files and UPBGE scripts
extensions/skill-graph.ts  pi custom-tool integration
src/                       Graph loading, validation, and traversal
examples/                  Workflow contracts
tests/                     Unit and pi SDK integration tests
docs/                      Architecture and compatibility documents
```

Each implemented UPBGE capability keeps its Python code under its own `scripts/` directory. The composite `physics-object-create` skill references these implementations instead of duplicating them.

## Requirements

- Node.js 22.19 or newer
- npm
- pi-compatible runtime for extension use
- UPBGE for editor execution and runtime validation

Graph tests do not require UPBGE.

## Setup

```bash
npm install
```

## Validation

Run TypeScript checks and all automated tests:

```bash
npm run check
npm test
```

Run only the pi workflow integration test:

```bash
npm run test:workflow
```

The current workflow test loads the pi extension and validates graph inspection and expansion without a model, network connection, persistent session, or UPBGE process.

## pi Integration

Load the repository as a local pi package:

```bash
pi -e .
```

The extension registers the `skill_graph` custom tool with two operations:

- `inspect(skill)` returns one metadata-only graph node.
- `expand(skill)` returns the deterministic local dependency closure, selected skill prose, and explicit graph edges.

Example root capability:

```text
physics-object-create
```

## UPBGE Scripts

Current executable modules:

- `capabilities/object-create/scripts/create_cube.py`
- `capabilities/rigid-body-add/scripts/add_rigid_body.py`
- `capabilities/collision-add/scripts/add_collision.py`
- `capabilities/physics-object-verify/scripts/verify_physics_object.py`

These modules expose Python functions for one UPBGE process. An execution harness must load them and pass the same Blender object reference through creation, physics configuration, collision configuration, and verification.

UPBGE process control and end-to-end runtime validation are the next implementation step.

## Documentation

- [Project handoff](docs/skill-graph-project-handoff.md)
- [Pi compatibility contract](docs/pi-compatibility-contract.md)
- [Open questions](docs/open-questions.md)

## Project Scope

V0 tests graph-based capability composition from a known root skill. It intentionally does not include intent search, vector retrieval, graph learning, a database, or multi-agent orchestration.
