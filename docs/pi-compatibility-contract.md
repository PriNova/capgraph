# Pi Compatibility Contract

## 1. Purpose

This document defines what "compatible with pi" means for Skill Graph V0.

The contract keeps the experiment aligned with pi while preserving the main architectural constraint: the complete capability graph and all full skill bodies must not enter the model context. Normal pi skill discovery may expose the flat baseline's skill names and descriptions.

## 2. Supported Integration Surface

Skill Graph V0 must use public pi interfaces only:

- pi extensions for runtime integration
- pi custom tools for graph inspection and expansion
- the pi SDK for automated benchmarks
- the Agent Skills format for `SKILL.md` files
- pi package metadata for installation and distribution

V0 must not depend on pi internal source files or undocumented runtime behavior.

## 3. Package Contract

The repository must be usable as a pi package.

`package.json` must:

- include the `pi-package` keyword
- declare the Skill Graph extension under `pi.extensions`
- list pi-provided extension packages as peer dependencies
- keep non-pi runtime packages in `dependencies` only when required

The package must support local development through:

```text
pi -e .
```

A published package may later support `pi install`, but publication is not part of V0.

## 4. Skill File Contract

Each capability instruction file must use the Agent Skills `SKILL.md` format supported by pi.

Required frontmatter:

```yaml
---
name: object-create
description: Creates an object in the UPBGE editor. Use when a workflow requires a new scene object.
---
```

Requirements:

- `name` uses lowercase letters, numbers, and hyphens only
- `name` is no longer than 64 characters
- `description` is specific and no longer than 1024 characters
- environment requirements use the optional `compatibility` field
- references to scripts, assets, and documents use paths relative to the skill directory
- instructions and executable files are written in English

Capability graph IDs may use domain-oriented dotted names such as `object.create`. Each skill declares its capability ID and outgoing relations through namespaced entries in the standard `metadata` field:

```yaml
metadata:
  capgraph-id: "object.create"
  capgraph-requires: "scene.create"
  capgraph-verify-with: "object.verify"
  capgraph-recover-with: "object.repair"
```

Agent Skills `metadata` is a map from string keys to string values. Custom top-level fields, nested objects, and YAML arrays must not be used. Relation values are whitespace-separated capability IDs. The skill `name` must match its parent directory; the graph loader derives the `SKILL.md` path directly and does not require a central capability-to-skill mapping.

## 5. Discovery and Context Contract

Pi uses progressive disclosure for normally discovered skills:

1. At startup, pi scans skill locations and adds skill names and descriptions from frontmatter to the system prompt.
2. The agent loads a full `SKILL.md` with `read` only when needed.

The flat baseline must use this normal behavior. It must not preload all full skill bodies.

Graph-managed skill files must not be placed in a package resource path that pi automatically discovers. V0 stores them under a non-discovered directory such as:

```text
capabilities/
```

The pi package manifest must not register this complete directory under `pi.skills` for the graph experiment. This prevents all graph-managed capability names and descriptions from becoming an always-present catalog in the system prompt; it is not intended to prevent pi from preloading full skill bodies, because pi does not normally preload them.

The extension must expose only:

1. the requested root capability,
2. its required local dependency subgraph,
3. associated verification capabilities,
4. associated recovery capabilities.

The complete in-memory graph index, unrelated capability metadata, unrelated skill frontmatter, and unrelated full `SKILL.md` contents must remain outside model context.

## 6. Runtime Extension Contract

The V0 extension must register a compact graph tool through `pi.registerTool()`.

Minimum operations:

```text
inspect(id)
expand(id)
```

The tool must:

- accept an explicit capability ID
- scan capability frontmatter and build the graph index outside model context
- return deterministic results
- read only skill files selected by expansion
- report missing nodes, missing skill files, and cycles as tool errors
- throw on execution failure so pi marks the tool result as an error
- honor the provided abort signal during asynchronous work
- limit output before it can exceed pi tool-result limits
- work without TUI-only APIs

The first implementation must work in pi interactive, print, JSON, and RPC modes. Optional visual rendering may be added later without becoming required for operation.

## 7. Graph Expansion Contract

For V0, expansion starts from a known root capability.

`expand(id)` must:

1. include the root node,
2. recursively follow `requires`,
3. include nodes referenced by `verify_with`,
4. include nodes referenced by `recover_with`,
5. detect dependency cycles,
6. produce a stable order for repeatable tests.

V0 does not infer the root capability from natural-language intent.

## 8. Security and Trust Contract

Pi extensions and skills can execute code with user permissions. Therefore:

- project-local integration runs only after pi trusts the project
- graph expansion does not execute capability scripts
- execution requires a separate explicit agent or tool action
- discovered capability paths must remain inside the package root
- malformed or escaping paths must be rejected
- tool output must not expose credentials, environment secrets, or unrelated files

UPBGE mutation and verification tools will define their own execution safety rules in a later contract.

## 9. Benchmark Contract

Flat and graph benchmark variants must use:

- the same pi version
- the same model and reasoning level
- the same task prompt
- the same skill prose
- the same built-in and execution tools
- equivalent clean starting state

Only capability-selection and composition support may differ.

The flat variant must expose the benchmark skill set through normal pi skill discovery: all skill names and descriptions are available in the system prompt, while full `SKILL.md` contents load on demand. The graph variant must bypass normal discovery for graph-managed skills and expose only the expanded local selection through the Skill Graph extension.

Context measurements must distinguish:

- always-present names and descriptions,
- full skill prose loaded on demand,
- graph tool-result content.

Automated benchmark runs should use the pi SDK with in-memory sessions where practical. Benchmark integration is deferred until graph expansion works inside pi.

## 10. V0 Compatibility Acceptance

V0 is pi-compatible when all of these checks pass:

1. Pi loads the local package without extension diagnostics.
2. Every capability `SKILL.md` passes the official Agent Skills validation, including string-only `metadata` values and matching skill/directory names.
3. `inspect` returns one requested graph node.
4. `expand` returns only the expected local capability set.
5. Unrelated skill prose does not appear in the model context or tool result.
6. Missing nodes, invalid paths, missing files, and cycles produce clear errors.
7. The extension works without an interactive UI.
8. Unit tests run independently of UPBGE.

## 11. Deferred Items

This contract does not require:

- natural-language intent resolution
- dynamic pi skill registration
- automatic graph learning
- persistent graph state in pi sessions
- custom TUI components
- UPBGE process control
- package publication
- support for agent harnesses other than pi

These items require separate evidence or a later compatibility contract.
