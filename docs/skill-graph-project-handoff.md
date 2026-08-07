# Skill Graph for Coding Agents — Project Handoff

## Companion Documents

- [Pi Compatibility Contract](pi-compatibility-contract.md) — mandatory integration and acceptance requirements for pi-compatible implementations.
- [UPBGE Control Transport](upbge-control-transport.md) — researched editor-control protocol, required official add-on, security constraints, and pending compatibility test.

## 1. Project Goal

Build and test a minimal **Skill/Capability Graph** for coding agents.

The hypothesis is:

> Agent skills may work better when they are not only represented as flat `SKILL.md` files, but additionally as a structured capability graph encoding dependencies, verification, recovery, and composition.

UPBGE is the first test domain because it provides:
- a programmable Python environment,
- composable editor/runtime capabilities,
- objectively verifiable scene state,
- visually compelling demos.

The project itself should remain **domain-independent**.

---

## 2. Core Idea

Separate three layers:

### Graph metadata
Machine-readable structure describing relationships between capabilities.

V0 relations:
- `requires`
- `verify_with`
- `recover_with`

Possible later relations, not supported in V0:
- `decomposes_into`
- `enables`
- `conflicts_with`
- `compatible_with`
- cost and reliability metadata

### Skill prose
`SKILL.md` contains model-facing operational knowledge:
- when to use the skill,
- heuristics,
- preferred approaches,
- failure modes,
- examples,
- context-sensitive advice.

### Executable implementation
TypeScript tools and domain-specific scripts used to perform or verify an operation, including Python where required by UPBGE.

Conceptually:

```text
Graph metadata
    ↓
What is related to what?

SKILL.md
    ↓
How should the capability be used?

Executable code/tools
    ↓
What is actually executed?
```

---

## 3. Important Architectural Constraint

The full graph MUST NOT enter the LLM context.

Pi's normal flat-skill discovery already uses progressive disclosure: it puts only discovered skill names and descriptions from frontmatter into the system prompt, then the agent loads a full `SKILL.md` with `read` when needed. The flat baseline must preserve this behavior; it must not preload every skill body.

The Skill Graph belongs to the **agent harness / external state**.

Only a relevant local subgraph and selected full `SKILL.md` contents should be exposed to the agent by the graph extension.

Example:

```text
ALL SKILLS / CAPABILITIES
        │
        │ never loaded wholesale
        ▼
   Graph / Index
        │
        ▼
 selected entry node
        │
        ▼
 dependency expansion
        │
        ▼
 small local subgraph
        │
        ▼
 selected SKILL.md prose
        │
        ▼
       LLM
```

---

## 4. What We Are NOT Solving in V0

Do NOT build these yet:

- universal natural-language intent resolver
- semantic codebase search
- Sourcegraph-like indexing
- vector database
- self-learning graph
- automatic staleness / invalidation
- persistent trajectory learning
- multi-agent orchestration
- skill marketplace
- complete UPBGE coverage
- complex graph database infrastructure
- custom top-level `SKILL.md` frontmatter fields or nested/non-string Agent Skills metadata

Avoid overengineering.

The goal is to test **one narrow hypothesis first**.

---

## 5. V0 Hypothesis

Test:

> Given a known root capability, does explicit graph structure help a coding agent compose skills more reliably and with less context/exploration than a flat skill library?

This deliberately avoids solving the Intent → Capability problem yet.

For benchmark tasks, the root skill may be explicitly supplied. The Agent Skills `name` is the canonical graph node ID.

Example:

```text
Task:
Create a playable character.

Root skill:
character-create
```

This isolates the graph-composition question.

---

## 6. Baseline vs Experiment

### Baseline: Flat Skills

```text
skills/
├── mesh-create/SKILL.md
├── material/SKILL.md
├── collision/SKILL.md
├── character/SKILL.md
├── input/SKILL.md
└── ...
```

Pi discovers the skills and includes only their frontmatter names and descriptions in the system prompt. The agent selects and reads full `SKILL.md` files on demand, then determines relationships itself.

### Experiment: Skill Graph

Same skill prose and the same on-demand principle, but graph metadata additionally provides relationships. Given a known root skill, the extension expands the local subgraph and returns only the selected full skill contents.

```text
character-create
 ├─ requires → mesh-create
 ├─ requires → collision-add
 ├─ requires → controls-character
 ├─ verify_with → character-verify
 └─ recover_with → character-repair
```

---

## 7. Minimal Repository Shape

Start as a pi-compatible package.

```text
skill-graph/
├── package.json
├── capabilities/
│   ├── scene-create/
│   │   └── SKILL.md
│   ├── object-create/
│   │   └── SKILL.md
│   ├── rigid-body-add/
│   │   └── SKILL.md
│   ├── collision-add/
│   │   └── SKILL.md
│   └── ...
├── extensions/
│   └── skill-graph.ts
├── src/
│   └── graph.ts
├── tests/
└── examples/
```

Keep graph loading and traversal in TypeScript so the pi extension can use them directly. Keep later UPBGE execution and verification scripts in Python where required by UPBGE.

Store graph-managed skills under `capabilities/`, not a pi auto-discovered `skills/` package resource. This prevents the graph variant from adding every capability's frontmatter to the system prompt. The extension must load only the full skill files selected by graph expansion. This differs from normal pi discovery, which exposes all discovered names and descriptions but still loads full skill bodies only on demand.

Do not introduce a database until distributed skill metadata becomes a real limitation.

---

## 8. Initial Graph Metadata Format

Store each node's outgoing relationships in its own `SKILL.md`. Do not maintain a separate `graph.json`.

The Agent Skills specification permits only defined top-level frontmatter fields. Custom data belongs under `metadata`, which must be a map from string keys to string values. Therefore, relation lists use whitespace-separated skill names rather than YAML arrays or nested objects.

Example:

```yaml
---
name: character-create
description: Creates a playable character. Use when a scene needs a controllable character.
metadata:
  capgraph-requires: "mesh-create collision-add controls-character"
  capgraph-verify-with: "character-verify"
  capgraph-recover-with: "character-repair"
---
```

Requirements:

- `name` is the canonical graph node ID, must be a valid Agent Skills name, and must match its parent directory.
- A separate `capgraph-id` is not supported.
- `capgraph-requires`, `capgraph-verify-with`, and `capgraph-recover-with` are optional strings.
- Each relation string contains whitespace-separated Agent Skills names.
- Skills without outgoing graph relations may omit `metadata`.
- All declared `metadata` keys and values remain strings.
- The extension scans capability frontmatter and builds the in-memory graph outside model context.
- The `SKILL.md` path is derived from the discovered file; no identifier mapping is required.

Keep the schema intentionally small.

Do not add additional relation keys before a concrete use case requires them.

---

## 9. Minimal Harness API

Expose only these operations through the pi `skill_graph` custom tool:

```text
inspect(skill)
expand(skill)
```

`inspect(skill)` returns exactly one node without skill prose or internal file paths:

```json
{
  "skill": "physics-object-create",
  "requires": ["object-create", "rigid-body-add", "collision-add"],
  "verify_with": ["physics-object-verify"],
  "recover_with": []
}
```

`expand(skill)` resolves the transitive dependency closure of one root skill and returns the minimal skill set needed to execute and verify it. Recovery skills are included as terminal nodes but are not traversed. The result separates selected skills from explicit graph edges:

```json
{
  "root": "physics-object-create",
  "skills": [
    {
      "skill": "object-create",
      "depth": 1,
      "content": "# Create Object\n\n..."
    },
    {
      "skill": "physics-object-create",
      "depth": 0,
      "content": "# Create Physics Object\n\n..."
    },
    {
      "skill": "physics-object-verify",
      "depth": 1,
      "content": "# Verify Physics Object\n\n..."
    }
  ],
  "edges": [
    {
      "from": "physics-object-create",
      "to": "object-create",
      "relation": "requires"
    },
    {
      "from": "physics-object-create",
      "to": "physics-object-verify",
      "relation": "verify_with"
    }
  ]
}
```

Dependencies use deterministic dependency-first order, followed by the root, verification skills, and recovery skills. `depth` is the shortest selected-edge distance from the root. Each selected skill appears once even when multiple edges reference it. Skill `content` excludes YAML frontmatter. Explicit edges preserve relationship source and target for shared or transitive dependencies. The canonical TypeScript output contracts are `InspectResult` and `ExpandResult` in `src/types/graph.ts`.

Defer `list()` and `search()` until a benchmark or workflow requires them. The important part is graph traversal, not search sophistication.

---

## 10. Initial UPBGE Skill Set

Target roughly 10–15 skills.

Suggested starting nodes:

```text
scene-create
scene-save

object-create
object-transform

mesh-create

material-create
material-assign

light-create
camera-create

rigid-body-add
collision-add

input-keyboard

character-create
character-verify
character-repair
```

Potential small workflows:

```text
create_lit_scene
create_physics_object
create_playable_character
```

---

## 11. UPBGE Domain Model

Keep the editor/runtime split explicit.

```text
UPBGE
├── EDITOR
│   └── bpy
├── RUNTIME
│   └── bge
└── WORKFLOWS
    └── combinations of both
```

A root UPBGE skill should teach the agent:

1. Determine whether the operation is editor-time or runtime.
2. Use `bpy` for Blender/UPBGE editor state.
3. Use `bge` for game runtime logic.
4. Prefer inspection before mutation.
5. Verify outcomes after execution.

---

## 12. Skill Prose Principles

`SKILL.md` should contain **decision knowledge**, not just API documentation.

Bad:

```text
bpy.ops.mesh.primitive_cube_add() adds a cube.
```

Better:

```text
Use the primitive operator for simple generated geometry.

Avoid it when:
- bulk-generating geometry,
- execution context is unreliable,
- selection/mode state is unclear.

Prefer direct data APIs for context-independent operations.

Common failures:
- wrong mode,
- no active object,
- incorrect scene linkage.
```

Skills should ideally contain:

```text
WHEN TO USE
PREFER
AVOID
EXECUTE
VERIFY
RECOVER
```

---

## 13. Verification First

Verification is a core part of the experiment.

A skill should not only say:

```text
DO
```

but ideally:

```text
DO
VERIFY
RECOVER
```

Example:

```text
Create camera
    ↓
Verify:
- camera exists
- camera linked to scene
- scene active camera assigned
- transform valid
    ↓
Failure?
    ↓
Recover
```

UPBGE is attractive because many states are objectively testable.

---

## 14. Benchmark Tasks

Start with 5–10 tasks of increasing compositional complexity.

Examples:

1. Create a cube.
2. Create a cube with a material.
3. Create a physically simulated object.
4. Create a lit scene with a camera.
5. Create an interactive door.
6. Create a controllable character.
7. Create a simple drivable vehicle.

Run both:

```text
Flat Skills
vs.
Graph Skills
```

Use the same agent/model where possible.

---

## 15. Metrics

Keep measurement simple.

Track:

### Success rate
Did the task complete correctly?

### Context/token usage
How much skill/tool context entered the model? Track separately:
- always-present skill names and descriptions,
- full skill prose loaded on demand,
- graph tool results.

### Tool/agent steps
How many exploration or execution actions were required?

### Recovery success
Can the agent repair a deliberately introduced failure?

Example result format:

| Metric | Flat Skills | Skill Graph |
|---|---:|---:|
| Success | x/10 | x/10 |
| Context tokens | x | x |
| Tool calls | x | x |
| Recovery | x/10 | x/10 |

Do not invent favorable numbers. Let results drive conclusions.

---

## 16. Relation to RLM / Recursive Harnesses

Do not frame Skill Graphs as a replacement for RLM.

A useful distinction:

```text
RLM / recursive harness:
How should the problem be decomposed?

Skill Graph:
What capabilities exist, how are they related, and how can they be verified/recovered?
```

Possible combined architecture:

```text
User goal
    ↓
task decomposition
    ↓
capability selection
    ↓
Skill Graph traversal
    ↓
minimal relevant subgraph
    ↓
execution
    ↓
verification
    ↓
local recovery
```

A useful conceptual framing:

> RLM externalizes problem context.
> Skill Graph externalizes capability context.

---

## 17. Intent Resolver — Deferred Problem

The Intent → Capability mapping problem is important, but explicitly postponed.

Problem:

```text
Natural-language intent
    ↓
???
    ↓
correct graph entry node
```

Naive approaches such as:
- grep,
- aliases,
- BM25,
- guessed repository vocabulary

remain hit-or-miss when the user vocabulary does not match the system vocabulary.

This problem is roughly equal in importance to the Skill Graph itself, but combining both into V0 risks overengineering.

Later experiments may compare:

```text
LLM-native selection
hierarchical navigation
lexical retrieval
semantic retrieval
hybrid approaches
```

For V0, root capabilities can be provided explicitly.

---

## 18. Codebase Exploration Insight

The discussion briefly generalized the resolver problem to coding-agent codebase exploration.

Important insight:

A static learned search-recovery strategy can become stale because a codebase is dynamic and fluid.

Solving that robustly introduces additional problems:

```text
recovery learning
→ persistence
→ staleness
→ invalidation
→ change detection
→ semantic impact
→ ...
```

This is deliberately NOT part of V0.

The broader lesson:

> Do not try to solve dynamic codebase understanding as a side effect of testing Skill Graphs.

---

## 19. Future Phases

Only pursue these if V0 shows measurable value.

### Phase 1
Capability Graph

### Phase 2
Intent → Capability Resolution

### Phase 3
Trajectory-driven graph refinement

Example:

```text
failure
→ successful repair
→ candidate recover_with edge
```

or:

```text
repeated sequence
A → B → C → D
    ↓
candidate macro skill
```

### Phase 4
Continual / self-improving capability system

The graph may eventually store:
- reliability,
- execution cost,
- success/failure counts,
- version compatibility,
- known failure modes.

But none of this belongs in V0.

---

## 20. Public Positioning

Do not market this primarily as an UPBGE project.

Public thesis:

> Agent capabilities may need a graph, not just a folder of SKILL.md files.

Alternative framing:

> Dependency-aware skill composition for agents.

UPBGE is the first visual testbed, not the identity of the project.

Good demo structure:

```text
Prompt
  ↓
Root capability
  ↓
Local skill subgraph
  ↓
Agent execution
  ↓
UPBGE scene appears
  ↓
Verification / recovery
```

This makes a general agent-harness idea visually understandable.

---

## 21. Research Context

Relevant recent directions discussed:

- Graph of Skills (GoS)
- GraSP
- HiSkill
- Recursive Language Models (RLM)
- Recursive Agent Harnesses
- Prime Agent / continual harness ideas

Important:
Do not claim invention of Skill Graphs.

Potential contribution is instead:

- a practical capability-graph harness,
- clear separation of graph metadata / prose / execution,
- local subgraph exposure,
- verification/recovery integration,
- real evaluation against flat skills,
- domain-independent design with UPBGE as first testbed.

---

## 22. Engineering Philosophy

Avoid architecture-first overbuilding.

The project should follow:

```text
one hypothesis
→ one vertical slice
→ measurable result
→ only then add complexity
```

Do not build infrastructure for hypothetical future requirements.

When a new problem layer appears, record it under `docs/open-questions.md` rather than immediately implementing a solution.

---

## 23. Current State and Next Tasks

Completed:

1. Created the Node.js and TypeScript package skeleton.
2. Defined the standard-compliant `metadata.capgraph-*` convention.
3. Implemented TypeScript loading and validation for capability `SKILL.md` frontmatter.
4. Added five initial UPBGE capability skills under `capabilities/`.
5. Added unit tests for loading, metadata validation, references, and duplicate skill names.
6. Implemented reachable `requires` cycle validation and tests that permit verification and recovery cycles and ignore unrelated dependency cycles.
7. Adopted the Agent Skills `name` as the canonical graph node ID and removed the separate `capgraph-id` namespace.
8. Implemented `inspect(skill)` with clear unknown-skill errors and metadata-only output.
9. Implemented `expand(skill)` with deterministic dependency-first ordering, shortest-depth metadata, explicit edges, deduplication, selected skill bodies without frontmatter, terminal verification and recovery inclusion, and reachable `requires` cycle validation.
10. Added unit tests that fix the exact inspection and expansion output contracts, including shared dependencies and non-traversal of outgoing terminal relations.
11. Made the repository a loadable pi package with a package manifest, required peer dependencies, and an extension entry point.
12. Registered `inspect(skill)` and `expand(skill)` through the pi `skill_graph` custom tool.
13. Made graph reads abort-aware, rejected escaping capability paths, enforced pi output limits, and returned execution failures as pi tool errors.
14. Validated local package loading and both tool operations in pi without connecting UPBGE.
15. Added the `create_physics_object` workflow contract and an automated pi SDK integration test that runs without a model, network access, package installation, or persistent sessions.

Next tasks:

1. Connect UPBGE execution and verification.

Do not begin with a separate CLI, intent search, self-learning, or a database.

---

## 24. First Vertical Slice

The first complete end-to-end experiment should be:

```text
Task:
Create a physics-enabled cube in UPBGE.

Known root skill:
physics-object-create

Graph expansion:
physics-object-create
 ├─ requires → object-create
 ├─ requires → rigid-body-add
 ├─ requires → collision-add
 └─ verify_with → physics-object-verify

Each skill uses its Agent Skills `name` as its graph node ID and declares outgoing relationships through standard-compliant string values under `metadata` in its `SKILL.md`. Expansion recursively follows `requires` from the root, then includes direct verification and recovery references from that dependency closure. It does not traverse outgoing relations from those added verification and recovery nodes. The pi extension builds the graph index outside model context, then reads only the selected full `SKILL.md` files and returns structured `skills` and `edges` through the `skill_graph` tool result.

Agent executes task.

Verifier checks expected scene state.
```

This is intentionally boring.

If this pipeline is clean and measurable, expand from there.

---

## 25. Current Working Principle

When uncertain whether to add another system:

> Prefer leaving a problem explicitly unsolved over solving it prematurely with another abstraction layer.

The project succeeds first by proving or disproving the graph hypothesis, not by becoming a complete agent platform.
