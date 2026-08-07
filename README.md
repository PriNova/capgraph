# Capgraph

Capgraph is a minimal capability-graph experiment for coding agents.

The project tests whether explicit skill dependencies, verification, recovery, and composition help an agent complete tasks more reliably and with less context than a flat skill library.

UPBGE is the first test domain. The graph implementation remains domain-independent.

## V0 Status

The technical V0 vertical slice is complete and marked by the Git tag `v0-vertical-slice`. It includes graph expansion from a known root capability, pi tool integration, direct UPBGE editor control, capability-script execution, verification, automated tests, and a successful live workflow.

The V0 research evaluation is not complete. The next step is to run and record the flat-skills versus Skill Graph benchmark. General natural-language root selection and unrestricted UPBGE control remain outside V0.

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
extensions/               pi graph and UPBGE control tools
src/                       Graph logic and direct UPBGE TCP transport
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

Automated tests do not require UPBGE. The live control tool requires the official MCP add-on bridge at `127.0.0.1:9876`.

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

The package registers two custom tools:

- `skill_graph` inspects or expands a known root capability.
- `upbge_control` executes an allowed editor operation through the bridge at `127.0.0.1:9876`.

Allowed UPBGE operations are `status`, `create_cube`, `add_rigid_body`, `add_collision`, and `verify_physics_object`. The tool builds fixed Python wrappers and loads only the repository capability scripts. It does not accept model-authored Python or configurable script paths.

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

These modules expose Python functions for the UPBGE editor process. `upbge_control` resolves objects by validated names between TCP requests.

The direct transport and complete create/configure/verify workflow have been validated against UPBGE 5.3.0 Alpha. Automated transport tests use a local mock server and do not require UPBGE.

## Documentation

- [Project handoff](docs/skill-graph-project-handoff.md)
- [Pi compatibility contract](docs/pi-compatibility-contract.md)
- [UPBGE control transport](docs/upbge-control-transport.md)
- [Open questions](docs/open-questions.md)

## Project Scope

V0 tests graph-based capability composition from a known root skill. Its technical vertical slice is complete; comparative benchmark evaluation remains pending. V0 intentionally does not include intent search, vector retrieval, graph learning, a database, or multi-agent orchestration.
