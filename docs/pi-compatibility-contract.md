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

- include the `pi-package` keyword as a project convention for package discoverability, although pi does not require this keyword to load a package
- declare the Skill Graph extension under `pi.extensions`
- list each imported pi-bundled core package in `peerDependencies` with a `"*"` range and not bundle it; this includes `@earendil-works/pi-ai`, `@earendil-works/pi-agent-core`, `@earendil-works/pi-coding-agent`, `@earendil-works/pi-tui`, and `typebox` when imported
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

The current V1 implementation uses the Agent Skills `name` as its canonical graph node ID. This is the tested identity strategy, not a universal long-term identity design. A separate `capgraph-id` is not supported. Each skill declares outgoing relations through namespaced entries in the standard `metadata` field:

```yaml
metadata:
  capgraph-requires: "scene-create"
  capgraph-verify-with: "object-verify"
  capgraph-recover-with: "object-repair"
```

Agent Skills `metadata` is a map from string keys to string values. Custom top-level fields, nested objects, and YAML arrays must not be used. Relation values are whitespace-separated Agent Skills names. Skills without outgoing relations may omit `metadata`. The skill `name` must match its parent directory; the graph loader derives the `SKILL.md` path directly and does not require an identifier mapping. Stable namespace-aware identity, rename compatibility, and cross-package references remain outside the tested scope.

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

1. metadata for the requested root's local dependency subgraph;
2. full prose for skills explicitly loaded by canonical name;
3. no unrelated capability metadata or prose.

The complete in-memory graph index, unrelated capability metadata, unrelated skill frontmatter, and unrelated full `SKILL.md` contents must remain outside model context.

## 6. Runtime Extension Contract

The V0 extension must register a compact graph tool through `pi.registerTool()`.

Minimum operations:

```text
inspect(skill)
expand(skill)
load(skill)
```

`inspect(skill)` must return exactly one metadata-only node with `skill`, `requires`, `verify_with`, and `recover_with`. It must not return skill prose or internal file paths.

`expand(skill)` must return metadata only:

- `root`: the canonical root skill name
- `skills`: selected skills with `skill` and shortest `depth` from the root
- `edges`: explicit `from`, `to`, and `relation` values for selected graph relationships

`load(skill)` must return exactly one `skill` and its `content` without YAML frontmatter or internal file paths.

The tool must:

- accept an explicit canonical skill name
- scan capability frontmatter and build the graph index outside model context
- return deterministic results
- not return skill bodies during expansion
- return only the one requested skill body during `load`
- report missing nodes, missing skill files, and cycles as tool errors
- throw on execution failure so pi marks the tool result as an error
- honor the provided abort signal during asynchronous work
- limit output before it can exceed pi tool-result limits
- work without TUI-only APIs

The first implementation must work in pi interactive, print, JSON, and RPC modes. Optional visual rendering may be added later without becoming required for operation.

## 7. Graph Expansion Contract

For V0, expansion starts from a known root skill.

`expand(skill)` must:

1. include the root node,
2. recursively follow `requires` from the root to build the required dependency closure,
3. include direct `verify_with` references from the root and every node in that dependency closure,
4. include direct `recover_with` references from the root and every node in that dependency closure,
5. not traverse outgoing relations from the added verification and recovery nodes,
6. detect `requires` cycles reachable from the requested root,
7. include each selected skill exactly once,
8. return explicit edges so shared and transitive relationships retain their source and target,
9. assign each skill its shortest selected-edge depth from the root,
10. order required dependencies before the root, then append verification skills and recovery skills deterministically;
11. not return skill prose.

`load(skill)` returns one known skill body on demand. Execution workflows should expand the root, load the root, load dependency or verification prose only when needed, and load recovery prose only after a relevant failure.

Only `requires` is recursive in V0. `verify_with` and `recover_with` are terminal associations for expansion. Cycles that use only verification or recovery edges are therefore not dependency cycles. Unrelated cycles outside the requested root's `requires` closure must not make that expansion fail. Missing references selected by steps 2–4 remain errors.

V0 does not infer the root skill from natural-language intent.

## 8. Security and Trust Contract

Pi extensions and skills can execute code with user permissions. Therefore:

- automatically discovered project-local extensions, project package resources, and project settings run only after pi trusts the project; an extension explicitly supplied with CLI `-e`, including `pi -e .`, is user-selected and loads before the project trust decision
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

The flat variant must expose the benchmark skill set through normal pi skill discovery: all skill names and descriptions are available in the system prompt, while full `SKILL.md` contents load on demand. The graph variant must bypass normal discovery, expand only local metadata, and load selected full skill bodies on demand through the Skill Graph extension.

Context measurements must distinguish:

- always-present names and descriptions,
- flat skill prose loaded on demand,
- graph metadata results,
- graph skill prose loaded on demand.

Automated benchmark runs should use the pi SDK with in-memory sessions where practical. Benchmark integration is deferred until graph expansion works inside pi.

## 10. V0 Compatibility Acceptance

V0 is pi-compatible when all of these checks pass:

1. Pi loads the local package without extension diagnostics.
2. Every capability `SKILL.md` passes the official Agent Skills validation, including string-only `metadata` values and matching skill/directory names.
3. `inspect` returns one requested metadata-only graph node without prose or internal paths.
4. `expand` returns the expected metadata-only `root`, `skills`, and `edges` output and only the expected local skill set.
5. `load` returns exactly one requested skill body without frontmatter or internal paths.
6. Unrelated skill prose does not appear in the model context or tool result.
7. Missing nodes, invalid paths, missing files, and cycles produce clear errors.
8. The extension works without an interactive UI.
9. Unit tests run independently of UPBGE.

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
